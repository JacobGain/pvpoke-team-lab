import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";

import {
  createServer as createViteServer,
  type ViteDevServer,
} from "vite";

const HOST = "127.0.0.1";
const GLOBAL_TIMEOUT_MS = 120_000;
const STEP_TIMEOUT_MS = 20_000;
const ENGINE_TIMEOUT_MS = 45_000;
const MAX_MAIN_THREAD_GAP_MS = 500;
const INVENTORY_SPECIES = [
  "azumarill",
  "altaria",
  "whiscash",
  "clodsire",
  "dunsparce",
  "gastrodon",
  "jumpluff",
  "mandibuzz",
  "dewgong",
  "feraligatr",
  "primeape",
  "toxapex",
] as const;

interface CdpResult {
  readonly result?: {
    readonly value?: unknown;
    readonly description?: string;
  };
  readonly exceptionDetails?: {
    readonly text?: string;
    readonly exception?: {
      readonly description?: string;
    };
  };
}

interface PendingCommand {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface WorkflowTiming {
  readonly elapsedMs: number;
  readonly maxMainThreadGapMs: number;
  readonly renderedText: string;
}

interface BrowserWorkflowReport {
  readonly inventoryRecordsCreated: number;
  readonly savedTeamsBeforeBackup: number;
  readonly backupBytes: number;
  readonly savedTeamSimulation: WorkflowTiming;
  readonly recommendationCancellation: WorkflowTiming;
  readonly recommendation: WorkflowTiming;
  readonly populatedResponsiveStates: readonly string[];
  readonly restoredInventoryRecords: number;
  readonly restoredSavedTeams: number;
}

function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, milliseconds);
  });
}

async function availablePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, HOST, () => resolveListen());
  });
  const address = server.address();
  invariant(
    address && typeof address === "object",
    "Could not allocate a local browser-test port.",
  );
  const port = address.port;

  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });

  return port;
}

function contentType(filePath: string): string {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    }[extname(filePath)] ?? "application/octet-stream"
  );
}

async function startUpstreamServer(
  upstreamRoot: string,
  port: number,
): Promise<Server> {
  const rootPrefix = `${upstreamRoot}${sep}`;
  const server = createServer((request, response) => {
    void (async () => {
      try {
        const pathname = decodeURIComponent(
          new URL(request.url ?? "/", `http://${HOST}`).pathname,
        );

        if (!pathname.startsWith("/pvpoke/")) {
          response.writeHead(404).end("Not found");
          return;
        }

        const filePath = resolve(
          upstreamRoot,
          pathname.slice("/pvpoke/".length),
        );

        if (!filePath.startsWith(rootPrefix)) {
          response.writeHead(403).end("Forbidden");
          return;
        }

        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          response.writeHead(404).end("Not found");
          return;
        }

        response.writeHead(200, {
          "cache-control": "no-store",
          "content-length": fileStat.size,
          "content-type": contentType(filePath),
        });
        createReadStream(filePath).pipe(response);
      } catch {
        response.writeHead(404).end("Not found");
      }
    })();
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, HOST, () => resolveListen());
  });

  return server;
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server?.listening) return;

  await new Promise<void>((resolveClose) => {
    server.close(() => resolveClose());
  });
}

async function resolveChromeExecutable(): Promise<string> {
  const configured = process.env.TEAMLAB_CHROME_PATH;
  const candidates = [
    configured,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next supported Chrome location.
    }
  }

  throw new Error(
    "Chrome was not found. Set TEAMLAB_CHROME_PATH to a Chromium-compatible executable.",
  );
}

function startChrome(
  executable: string,
  port: number,
  profilePath: string,
  appUrl: string,
): {
  readonly process: ChildProcessWithoutNullStreams;
  readonly output: () => string;
} {
  const browserProcess = spawn(
    executable,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--no-default-browser-check",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profilePath}`,
      appUrl,
    ],
    { stdio: "pipe" },
  );
  let recentOutput = "";
  const collect = (chunk: Buffer) => {
    recentOutput = `${recentOutput}${chunk.toString()}`.slice(-8_000);
  };

  browserProcess.stdout.on("data", collect);
  browserProcess.stderr.on("data", collect);

  return {
    process: browserProcess,
    output: () => recentOutput,
  };
}

async function stopChrome(
  browserProcess: ChildProcessWithoutNullStreams | undefined,
): Promise<void> {
  if (!browserProcess || browserProcess.exitCode !== null) return;

  browserProcess.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveExit) => {
      browserProcess.once("exit", () => resolveExit());
    }),
    delay(2_000),
  ]);

  if (browserProcess.exitCode === null) {
    browserProcess.kill("SIGKILL");
  }
}

async function findPageWebSocket(
  debuggingPort: number,
  appUrl: string,
  browserOutput: () => string,
): Promise<string> {
  const endpoint = `http://${HOST}:${debuggingPort}/json`;
  const deadline = Date.now() + STEP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      const targets = (await response.json()) as readonly {
        readonly type: string;
        readonly url: string;
        readonly webSocketDebuggerUrl?: string;
      }[];
      const page = targets.find(
        (target) =>
          target.type === "page" &&
          target.url.startsWith(appUrl) &&
          target.webSocketDebuggerUrl,
      );

      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome is still starting.
    }

    await delay(100);
  }

  throw new Error(
    `Chrome did not expose the TeamLab page.\n${browserOutput()}`,
  );
}

class DevToolsClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingCommand>();
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        readonly id?: number;
        readonly result?: unknown;
        readonly error?: { readonly message?: string };
      };

      if (message.id === undefined) return;
      const command = this.pending.get(message.id);
      if (!command) return;

      clearTimeout(command.timeout);
      this.pending.delete(message.id);
      if (message.error) {
        command.reject(
          new Error(message.error.message ?? "Chrome command failed."),
        );
      } else {
        command.resolve(message.result);
      }
    });
    socket.addEventListener("close", () => {
      for (const command of this.pending.values()) {
        clearTimeout(command.timeout);
        command.reject(new Error("Chrome debugging connection closed."));
      }
      this.pending.clear();
    });
  }

  static async connect(webSocketUrl: string): Promise<DevToolsClient> {
    const socket = new WebSocket(webSocketUrl);

    await new Promise<void>((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", () => resolveOpen(), { once: true });
      socket.addEventListener(
        "error",
        () => rejectOpen(new Error("Could not connect to Chrome debugging.")),
        { once: true },
      );
    });

    return new DevToolsClient(socket);
  }

  call(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = STEP_TIMEOUT_MS,
  ): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;

    return new Promise((resolveCommand, rejectCommand) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectCommand(new Error(`Chrome command ${method} timed out.`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolveCommand,
        reject: rejectCommand,
        timeout,
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.socket.close();
  }
}

class BrowserWorkflow {
  private readonly client: DevToolsClient;
  private readonly appUrl: string;

  constructor(client: DevToolsClient, appUrl: string) {
    this.client = client;
    this.appUrl = appUrl;
  }

  async evaluate<T>(
    expression: string,
    timeoutMs = STEP_TIMEOUT_MS,
  ): Promise<T> {
    const response = (await this.client.call(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      timeoutMs,
    )) as CdpResult;

    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text ??
          "Browser evaluation failed.",
      );
    }

    return response.result?.value as T;
  }

  async waitFor<T>(
    expression: string,
    description: string,
    timeoutMs = STEP_TIMEOUT_MS,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const value = await this.evaluate<T | null>(expression);
      if (value !== null && value !== false && value !== undefined) {
        return value;
      }
      await delay(50);
    }

    throw new Error(`Timed out waiting for ${description}.`);
  }

  async navigate(pathname: string, heading: string): Promise<void> {
    await this.client.call("Page.navigate", {
      url: `${this.appUrl}${pathname}`,
    });
    await this.waitFor(
      `location.pathname === ${JSON.stringify(pathname)} && document.querySelector("h1")?.textContent?.trim() === ${JSON.stringify(heading)}`,
      `${pathname} to render “${heading}”`,
    );
  }

  async clickButton(
    label: string,
    selector = "button",
  ): Promise<void> {
    const clicked = await this.evaluate<boolean>(`(() => {
      const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((candidate) =>
          candidate instanceof HTMLButtonElement &&
          candidate.textContent?.trim() === ${JSON.stringify(label)} &&
          !candidate.disabled
        );
      if (!button) return false;
      button.click();
      return true;
    })()`);

    invariant(clicked, `Enabled button “${label}” was not found.`);
  }

  async setLabeledControl(
    label: string,
    value: string,
    controlSelector = "input, select, textarea",
    labelIndex = 0,
  ): Promise<void> {
    const changed = await this.evaluate<boolean>(`(() => {
      const labels = [...document.querySelectorAll("label")].filter((candidate) =>
        [...candidate.querySelectorAll("span")].some(
          (span) => span.textContent?.trim() === ${JSON.stringify(label)}
        )
      );
      const owner = labels[${labelIndex}];
      const control = owner?.querySelector(${JSON.stringify(controlSelector)});
      if (
        !(control instanceof HTMLInputElement) &&
        !(control instanceof HTMLSelectElement) &&
        !(control instanceof HTMLTextAreaElement)
      ) return false;
      const prototype =
        control instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : control instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (!setter) return false;
      setter.call(control, ${JSON.stringify(value)});
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return control.value === ${JSON.stringify(value)};
    })()`);

    invariant(changed, `Could not set “${label}” to “${value}”.`);
  }

  async setLabeledCheckbox(label: string, checked: boolean): Promise<void> {
    const changed = await this.evaluate<boolean>(`(() => {
      const owner = [...document.querySelectorAll("label")].find(
        (candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)}
      );
      const control = owner?.querySelector('input[type="checkbox"]');
      if (!(control instanceof HTMLInputElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked"
      )?.set;
      if (!setter) return false;
      setter.call(control, ${checked});
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      return control.checked === ${checked};
    })()`);

    invariant(changed, `Could not set checkbox “${label}”.`);
  }

  async setViewport(width: number, height = 900): Promise<void> {
    await this.client.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 520,
    });
  }

  async assertNoHorizontalOverflow(state: string): Promise<void> {
    const metrics = await this.evaluate<{
      readonly clientWidth: number;
      readonly scrollWidth: number;
    }>(`({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    })`);

    invariant(
      metrics.scrollWidth === metrics.clientWidth,
      `${state} overflows horizontally: ${metrics.scrollWidth}px document in ${metrics.clientWidth}px viewport.`,
    );
  }

  async startPulseAndClick(buttonLabel: string): Promise<number> {
    return this.evaluate<number>(`(() => {
      const existing = window.__teamLabBrowserPulse;
      if (existing?.timer) clearInterval(existing.timer);
      const started = performance.now();
      const pulse = {
        started,
        last: started,
        maxGap: 0,
        timer: 0
      };
      pulse.timer = window.setInterval(() => {
        const now = performance.now();
        pulse.maxGap = Math.max(pulse.maxGap, now - pulse.last);
        pulse.last = now;
      }, 16);
      window.__teamLabBrowserPulse = pulse;
      const button = [...document.querySelectorAll("button")].find(
        (candidate) =>
          candidate.textContent?.trim() === ${JSON.stringify(buttonLabel)} &&
          !candidate.disabled
      );
      if (!(button instanceof HTMLButtonElement)) {
        clearInterval(pulse.timer);
        throw new Error("Workflow button was not found.");
      }
      button.click();
      return started;
    })()`);
  }

  async finishPulse(renderedText: string): Promise<WorkflowTiming> {
    return this.evaluate<WorkflowTiming>(`(() => {
      const pulse = window.__teamLabBrowserPulse;
      if (!pulse) throw new Error("Browser pulse was not started.");
      clearInterval(pulse.timer);
      const now = performance.now();
      pulse.maxGap = Math.max(pulse.maxGap, now - pulse.last);
      return {
        elapsedMs: Math.round(now - pulse.started),
        maxMainThreadGapMs: Math.round(pulse.maxGap),
        renderedText: ${JSON.stringify(renderedText)}
      };
    })()`);
  }
}

async function waitForDownload(downloadDirectory: string): Promise<string> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const files = await readdir(downloadDirectory);
    const backupName = files.find(
      (filename) =>
        filename.startsWith("teamlab-backup-") &&
        filename.endsWith(".json"),
    );

    if (backupName) {
      return resolve(downloadDirectory, backupName);
    }
    await delay(50);
  }

  throw new Error("Timed out waiting for the JSON backup download.");
}

async function setFileInput(
  client: DevToolsClient,
  filePath: string,
): Promise<void> {
  const documentResult = (await client.call("DOM.getDocument", {
    depth: 1,
  })) as { readonly root?: { readonly nodeId?: number } };
  const rootNodeId = documentResult.root?.nodeId;
  invariant(rootNodeId !== undefined, "Chrome did not return a DOM root.");
  const queryResult = (await client.call("DOM.querySelector", {
    nodeId: rootNodeId,
    selector: 'input[type="file"]',
  })) as { readonly nodeId?: number };
  invariant(queryResult.nodeId, "Backup file input was not found.");

  await client.call("DOM.setFileInputFiles", {
    files: [filePath],
    nodeId: queryResult.nodeId,
  });
}

async function createInventory(
  browser: BrowserWorkflow,
): Promise<void> {
  for (const [index, speciesId] of INVENTORY_SPECIES.entries()) {
    await browser.navigate("/inventory/new", "Add Pokémon");
    const optionAvailable = await browser.evaluate<boolean>(
      `[...document.querySelectorAll('label select option')].some((option) => option.value === ${JSON.stringify(speciesId)})`,
    );
    invariant(
      optionAvailable,
      `The real catalog does not contain expected species ${speciesId}.`,
    );
    await browser.setLabeledControl(
      "Species, form, and Shadow state",
      speciesId,
      "select",
    );
    await browser.waitFor(
      `document.querySelector('label select')?.value === ${JSON.stringify(speciesId)} && document.querySelector(".level-result")?.textContent?.includes("Level") && !document.querySelector(".level-result .invalid-value")`,
      `${speciesId} to resolve to a legal build`,
    );
    await browser.setLabeledControl(
      "Notes",
      `Browser fixture ${index + 1}: ${speciesId}`,
      "textarea",
    );
    if (index === 0) {
      await browser.setLabeledCheckbox("Favorite", true);
    }
    await browser.clickButton("Add to inventory");
    await browser.waitFor(
      `location.pathname === "/inventory" && document.querySelectorAll(".inventory-card").length === ${index + 1}`,
      `${speciesId} to persist`,
    );
  }
}

async function runCriticalWorkflows(
  browser: BrowserWorkflow,
  client: DevToolsClient,
  downloadDirectory: string,
): Promise<BrowserWorkflowReport> {
  const responsiveStates: string[] = [];

  await browser.setViewport(1440, 1_000);
  await browser.navigate("/", "TeamLab");
  await browser.waitFor(
    `document.querySelector("#pvpoke-data-title")?.textContent?.trim() === "Connected"`,
    "real PvPoke data connection",
  );

  await createInventory(browser);
  const inventoryCount = await browser.evaluate<number>(
    `document.querySelectorAll(".inventory-card").length`,
  );
  invariant(
    inventoryCount === INVENTORY_SPECIES.length,
    `Expected ${INVENTORY_SPECIES.length} inventory records, received ${inventoryCount}.`,
  );
  console.log(
    `[browser-workflows] created ${inventoryCount} inventory records through the UI`,
  );

  await browser.setLabeledControl(
    "Search species or notes",
    "Azumarill",
    "input",
  );
  await browser.waitFor(
    `document.querySelectorAll(".inventory-card").length === 1 && document.querySelector(".inventory-card h2")?.textContent === "Azumarill"`,
    "inventory search result",
  );
  await browser.setLabeledControl(
    "Search species or notes",
    "",
    "input",
  );
  await browser.waitFor(
    `document.querySelectorAll(".inventory-card").length === ${INVENTORY_SPECIES.length}`,
    "inventory search reset",
  );

  const firstRecord = await browser.evaluate<{
    readonly analyzeHref: string;
    readonly editHref: string;
    readonly speciesName: string;
  }>(`(() => {
    const card = document.querySelector(".inventory-card");
    return {
      analyzeHref: card?.querySelector('a[href$="/analysis"]')?.getAttribute("href") ?? "",
      editHref: [...(card?.querySelectorAll("a") ?? [])].find((link) => link.textContent?.trim() === "Edit")?.getAttribute("href") ?? "",
      speciesName: card?.querySelector("h2")?.textContent?.trim() ?? ""
    };
  })()`);
  invariant(
    firstRecord.analyzeHref && firstRecord.editHref && firstRecord.speciesName,
    "Inventory action links were not rendered.",
  );

  await browser.navigate(firstRecord.analyzeHref, firstRecord.speciesName);
  await browser.waitFor(
    `document.querySelectorAll(".analysis-panel").length > 0`,
    "populated inventory analysis",
  );
  await browser.setViewport(320);
  await browser.assertNoHorizontalOverflow("populated inventory analysis");
  responsiveStates.push("inventory analysis");
  await browser.setViewport(1440, 1_000);

  await browser.navigate(firstRecord.editHref, "Edit Pokémon");
  await browser.setLabeledControl(
    "Notes",
    "Edited by durable browser coverage",
    "textarea",
  );
  await browser.clickButton("Save changes");
  await browser.waitFor(
    `location.pathname === "/inventory" && document.body.textContent?.includes("Edited by durable browser coverage")`,
    "inventory edit to persist",
  );

  await browser.navigate("/teams/new", "Create saved team");
  await browser.setLabeledControl(
    "Team name",
    "Browser Coverage Team",
    "input",
  );
  await browser.setLabeledControl(
    "Team notes",
    "Created through the real team editor",
    "textarea",
  );
  await browser.clickButton("Save team");
  await browser.waitFor(
    `location.pathname === "/teams" && document.querySelector(".team-card h2")?.textContent === "Browser Coverage Team"`,
    "saved team creation",
  );

  const teamLinks = await browser.evaluate<{
    readonly editHref: string;
    readonly simulationHref: string;
  }>(`(() => {
    const card = document.querySelector(".team-card");
    return {
      editHref: [...(card?.querySelectorAll("a") ?? [])].find((link) => link.textContent?.trim() === "Edit team")?.getAttribute("href") ?? "",
      simulationHref: [...(card?.querySelectorAll("a") ?? [])].find((link) => link.textContent?.trim() === "Simulate")?.getAttribute("href") ?? ""
    };
  })()`);
  invariant(
    teamLinks.editHref && teamLinks.simulationHref,
    "Saved-team edit and simulation links were not rendered.",
  );

  await browser.navigate(teamLinks.editHref, "Edit saved team");
  await browser.setLabeledControl(
    "Team notes",
    "Edited through populated browser coverage",
    "textarea",
  );
  await browser.clickButton("Save changes");
  await browser.waitFor(
    `location.pathname === "/teams" && document.body.textContent?.includes("Edited through populated browser coverage")`,
    "saved team edit to persist",
  );

  await browser.navigate(teamLinks.simulationHref, "Browser Coverage Team");
  await browser.setLabeledControl(
    "Meta target count",
    "20",
    "select",
  );
  await browser.startPulseAndClick("Run exact team matrix");
  const simulationText = await browser.waitFor<string>(
    `(() => {
      const banner = [...document.querySelectorAll(".diagnostics-banner")]
        .find((candidate) => candidate.textContent?.includes("Measured matrix"));
      const alert = document.querySelector('[role="alert"]');
      if (alert) throw new Error(alert.textContent ?? "Saved-team simulation failed.");
      return banner?.textContent?.replace(/\\s+/g, " ").trim() ?? null;
    })()`,
    "Top-20 saved-team matrix",
    ENGINE_TIMEOUT_MS,
  );
  const savedTeamSimulation = await browser.finishPulse(simulationText);
  invariant(
    savedTeamSimulation.maxMainThreadGapMs <= MAX_MAIN_THREAD_GAP_MS,
    `Saved-team simulation blocked the main thread for ${savedTeamSimulation.maxMainThreadGapMs} ms.`,
  );
  console.log(
    `[browser-workflows] Top-20 saved-team matrix ${JSON.stringify(savedTeamSimulation)}`,
  );
  await browser.setViewport(320);
  await browser.assertNoHorizontalOverflow("populated saved-team simulation");
  responsiveStates.push("saved-team simulation result");
  await browser.setViewport(1440, 1_000);

  await browser.navigate("/recommend", "Build around your anchors");
  await browser.setLabeledControl("Results", "5", "select");
  await browser.setLabeledControl("Meta targets", "48", "select");
  await browser.startPulseAndClick("Generate recommendations");
  await browser.waitFor(
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Cancel after current finalist" && !button.disabled)`,
    "recommendation cancellation control",
  );
  await browser.clickButton("Cancel after current finalist");
  const cancellationText = await browser.waitFor<string>(
    `(() => {
      const progress = document.querySelector(".recommendation-progress");
      return progress?.textContent?.includes("Run cancelled")
        ? progress.textContent.replace(/\\s+/g, " ").trim()
        : null;
    })()`,
    "cooperative recommendation cancellation",
    ENGINE_TIMEOUT_MS,
  );
  const recommendationCancellation =
    await browser.finishPulse(cancellationText);
  invariant(
    recommendationCancellation.maxMainThreadGapMs <=
      MAX_MAIN_THREAD_GAP_MS,
    `Large-scope recommendation blocked the main thread for ${recommendationCancellation.maxMainThreadGapMs} ms.`,
  );
  console.log(
    `[browser-workflows] cancelled a Top-48 recommendation ${JSON.stringify(recommendationCancellation)}`,
  );
  await browser.setLabeledControl("Results", "3", "select");
  await browser.setLabeledControl("Meta targets", "5", "select");
  await browser.waitFor(
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Generate recommendations" && !button.disabled)`,
    "recommendation form to become reusable after cancellation",
  );
  await browser.startPulseAndClick("Generate recommendations");
  const recommendationText = await browser.waitFor<string>(
    `(() => {
      const banner = [...document.querySelectorAll(".diagnostics-banner")]
        .find((candidate) => candidate.textContent?.includes("Exact recommendation result"));
      const alert = document.querySelector('[role="alert"]');
      if (alert) throw new Error(alert.textContent ?? "Recommendation workflow failed.");
      return banner?.textContent?.replace(/\\s+/g, " ").trim() ?? null;
    })()`,
    "default exact recommendation result",
    ENGINE_TIMEOUT_MS,
  );
  const recommendation = await browser.finishPulse(recommendationText);
  invariant(
    recommendation.maxMainThreadGapMs <= MAX_MAIN_THREAD_GAP_MS,
    `Recommendation simulation blocked the main thread for ${recommendation.maxMainThreadGapMs} ms.`,
  );
  console.log(
    `[browser-workflows] default recommendation ${JSON.stringify(recommendation)}`,
  );
  const selectedRecommendations = await browser.evaluate<number>(
    `document.querySelectorAll(".recommendation-result").length`,
  );
  invariant(
    selectedRecommendations > 0,
    "Recommendation workflow returned no selectable teams.",
  );
  await browser.setViewport(320);
  await browser.assertNoHorizontalOverflow("populated recommendation result");
  responsiveStates.push("recommendation result");
  await browser.setViewport(1440, 1_000);
  await browser.clickButton("Save this team");
  await browser.waitFor(
    `[...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Saved to teams")`,
    "recommended team save",
  );

  await browser.navigate("/inventory/backup", "Backup and restore");
  const persistedCounts = await browser.evaluate<{
    readonly inventory: number;
    readonly teams: number;
  }>(`(() => {
    const exportText = document.querySelector(".backup-section")?.textContent ?? "";
    const inventory = Number(exportText.match(/contains (\\d+) inventory/)?.[1] ?? -1);
    const teams = Number(exportText.match(/and (\\d+) saved/)?.[1] ?? -1);
    return { inventory, teams };
  })()`);
  invariant(
    persistedCounts.inventory === INVENTORY_SPECIES.length &&
      persistedCounts.teams === 2,
    `Expected ${INVENTORY_SPECIES.length} inventory records and 2 teams before backup.`,
  );

  await client.call("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDirectory,
    eventsEnabled: true,
  });
  await browser.clickButton("Download JSON backup");
  const backupPath = await waitForDownload(downloadDirectory);
  const backupContents = await readFile(backupPath, "utf8");
  const backup = JSON.parse(backupContents) as {
    readonly inventory?: readonly unknown[];
    readonly savedTeams?: readonly unknown[];
  };
  invariant(
    backup.inventory?.length === INVENTORY_SPECIES.length &&
      backup.savedTeams?.length === 2,
    "Downloaded backup did not contain the complete browser fixture.",
  );
  console.log(
    `[browser-workflows] downloaded ${Buffer.byteLength(backupContents)} byte full-data backup`,
  );

  await browser.clickButton("Reset all data");
  await browser.waitFor(
    `document.querySelector('[role="alertdialog"]')?.textContent?.includes("Reset all TeamLab data?")`,
    "reset confirmation",
  );
  await browser.setViewport(320);
  await browser.assertNoHorizontalOverflow("populated reset confirmation");
  responsiveStates.push("reset confirmation");
  await browser.setViewport(1440, 1_000);
  await browser.setLabeledControl(
    "Type RESET to continue",
    "RESET",
    "input",
  );
  await browser.clickButton(
    "Reset all data",
    ".destructive-confirmation button",
  );
  await browser.waitFor(
    `document.querySelector('[role="status"]')?.textContent?.includes("TeamLab reset complete")`,
    "atomic local-data reset",
  );

  await setFileInput(client, backupPath);
  await browser.waitFor(
    `document.querySelector(".backup-inspection--valid strong")?.textContent?.includes("is valid")`,
    "downloaded backup inspection",
  );
  await browser.clickButton("Restore TeamLab data");
  const restoreStatus = await browser.waitFor<string>(
    `(() => {
      const status = document.querySelector('[role="status"]');
      return status?.textContent?.includes("Restore complete")
        ? status.textContent.replace(/\\s+/g, " ").trim()
        : null;
    })()`,
    "full-data restore",
  );
  const restoredInventoryRecords = Number(
    restoreStatus.match(/Inventory:.*?(\d+) total/)?.[1] ?? -1,
  );
  const restoredSavedTeams = Number(
    restoreStatus.match(/Saved teams:.*?(\d+) total/)?.[1] ?? -1,
  );
  invariant(
    restoredInventoryRecords === INVENTORY_SPECIES.length &&
      restoredSavedTeams === 2,
    `Restore returned ${restoredInventoryRecords} inventory records and ${restoredSavedTeams} teams.`,
  );

  await browser.navigate("/inventory", "Your inventory");
  await browser.waitFor(
    `document.querySelectorAll(".inventory-card").length === ${INVENTORY_SPECIES.length}`,
    "restored inventory dashboard",
  );

  return {
    inventoryRecordsCreated: INVENTORY_SPECIES.length,
    savedTeamsBeforeBackup: persistedCounts.teams,
    backupBytes: Buffer.byteLength(backupContents),
    savedTeamSimulation,
    recommendationCancellation,
    recommendation,
    populatedResponsiveStates: responsiveStates,
    restoredInventoryRecords,
    restoredSavedTeams,
  };
}

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const upstreamRoot = resolve(projectRoot, "..");
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "teamlab-browser-workflows-"),
  );
  const chromeProfile = resolve(temporaryRoot, "chrome-profile");
  const downloadDirectory = resolve(temporaryRoot, "downloads");
  await Promise.all([
    mkdir(chromeProfile, { recursive: true }),
    mkdir(downloadDirectory, { recursive: true }),
  ]);

  let upstreamServer: Server | undefined;
  let viteServer: ViteDevServer | undefined;
  let chromeProcess: ChildProcessWithoutNullStreams | undefined;
  let client: DevToolsClient | undefined;
  const globalTimeout = setTimeout(() => {
    console.error(
      `Browser workflow exceeded ${GLOBAL_TIMEOUT_MS} ms and was terminated.`,
    );
    chromeProcess?.kill("SIGKILL");
    process.exit(2);
  }, GLOBAL_TIMEOUT_MS);

  try {
    const [upstreamPort, appPort, debuggingPort] = await Promise.all([
      availablePort(),
      availablePort(),
      availablePort(),
    ]);
    upstreamServer = await startUpstreamServer(upstreamRoot, upstreamPort);
    process.env.VITE_PVPOKE_BASE_URL = "/pvpoke/src";
    process.env.PVPOKE_DEV_PROXY_TARGET =
      `http://${HOST}:${upstreamPort}`;
    viteServer = await createViteServer({
      configFile: resolve(projectRoot, "vite.config.ts"),
      logLevel: "error",
      server: {
        host: HOST,
        port: appPort,
        strictPort: true,
      },
    });
    await viteServer.listen();

    const appUrl = `http://${HOST}:${appPort}`;
    const chromeExecutable = await resolveChromeExecutable();
    const chrome = startChrome(
      chromeExecutable,
      debuggingPort,
      chromeProfile,
      appUrl,
    );
    chromeProcess = chrome.process;
    const webSocketUrl = await findPageWebSocket(
      debuggingPort,
      appUrl,
      chrome.output,
    );
    client = await DevToolsClient.connect(webSocketUrl);
    const browser = new BrowserWorkflow(client, appUrl);
    const report = await runCriticalWorkflows(
      browser,
      client,
      downloadDirectory,
    );

    console.log(
      `[browser-workflows] ${JSON.stringify(report)}`,
    );
  } finally {
    clearTimeout(globalTimeout);
    client?.close();
    await Promise.race([stopChrome(chromeProcess), delay(3_000)]);
    await Promise.race([
      viteServer?.close() ?? Promise.resolve(),
      delay(3_000),
    ]);
    await Promise.race([closeServer(upstreamServer), delay(3_000)]);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  },
);
