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
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";

import {
  createServer as createViteServer,
  type ViteDevServer,
} from "vite";
import sharp from "sharp";

const HOST = "127.0.0.1";
const GLOBAL_TIMEOUT_MS = 120_000;
const STEP_TIMEOUT_MS = 20_000;
const ENGINE_TIMEOUT_MS = 45_000;
const MAX_MAIN_THREAD_GAP_MS = 500;
const MAX_VISUAL_CHANGED_PIXEL_RATIO = 0.01;
const VISUAL_CHANNEL_TOLERANCE = 20;
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

type VisualMode = "off" | "verify" | "update";

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
    verifyImmediateValue = true,
  ): Promise<void> {
    const changed = await this.evaluate<boolean>(`(() => {
      const labels = [...document.querySelectorAll("label")].filter((candidate) =>
        [...candidate.querySelectorAll("span")].some(
          (span) => span.textContent?.trim() === ${JSON.stringify(label)}
        )
      );
      const owner = labels[${labelIndex}];
      const nestedControl = owner?.querySelector(${JSON.stringify(controlSelector)});
      const associatedControl =
        owner instanceof HTMLLabelElement && owner.htmlFor
          ? document.getElementById(owner.htmlFor)
          : null;
      const control = nestedControl ?? associatedControl;
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
      return ${
        verifyImmediateValue
          ? `control.value === ${JSON.stringify(value)}`
          : "true"
      };
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

  async captureViewport(
    width: number,
    height: number,
    scrollSelector?: string,
  ): Promise<Buffer> {
    await this.setViewport(width, height);
    await this.client.call("Emulation.setEmulatedMedia", {
      features: [
        { name: "prefers-reduced-motion", value: "reduce" },
        { name: "prefers-color-scheme", value: "light" },
      ],
    });
    await this.evaluate(`(async () => {
      let style = document.querySelector("#teamlab-visual-regression-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "teamlab-visual-regression-style";
        style.textContent = \`
          *, *::before, *::after {
            animation: none !important;
            caret-color: transparent !important;
            scroll-behavior: auto !important;
            transition: none !important;
          }
        \`;
        document.head.append(style);
      }
      await document.fonts.ready;
      await Promise.race([
        Promise.all(
          [...document.images].map((image) =>
            image.decode().catch(() => undefined)
          )
        ),
        new Promise((resolveImages) => window.setTimeout(resolveImages, 3_000))
      ]);
      const selector = ${JSON.stringify(scrollSelector)};
      if (selector) {
        document.querySelector(selector)?.scrollIntoView({
          block: "start",
          behavior: "instant"
        });
        window.scrollBy(0, -80);
      } else {
        window.scrollTo({ left: 0, top: 0, behavior: "instant" });
      }
      await new Promise((resolveFrame) =>
        requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
      );
      return true;
    })()`);
    const screenshot = (await this.client.call("Page.captureScreenshot", {
      captureBeyondViewport: false,
      format: "png",
      fromSurface: true,
    })) as { readonly data?: string };
    invariant(screenshot.data, "Chrome did not return screenshot data.");
    const image = Buffer.from(screenshot.data, "base64");
    await this.client.call("Emulation.setEmulatedMedia", {
      features: [],
      media: "",
    });
    await this.client.call("Emulation.clearDeviceMetricsOverride");
    return image;
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

class VisualRegression {
  private readonly baselineDirectory: string;
  private readonly artifactDirectory: string;
  private readonly mode: VisualMode;

  constructor(
    mode: VisualMode,
    projectRoot: string,
  ) {
    this.mode = mode;
    this.baselineDirectory = resolve(
      projectRoot,
      "tests/visual/baselines",
    );
    this.artifactDirectory = resolve(projectRoot, "artifacts/visual");
  }

  async capture(
    browser: BrowserWorkflow,
    name: string,
    width: number,
    height: number,
    scrollSelector?: string,
  ): Promise<void> {
    if (this.mode === "off") return;

    const actual = await browser.captureViewport(
      width,
      height,
      scrollSelector,
    );
    const baselinePath = resolve(
      this.baselineDirectory,
      `${name}.png`,
    );

    if (this.mode === "update") {
      await mkdir(this.baselineDirectory, { recursive: true });
      await writeFile(baselinePath, actual);
      console.log(`[visual-regression] updated ${name}`);
      return;
    }

    let expected: Buffer;
    try {
      expected = await readFile(baselinePath);
    } catch {
      throw new Error(
        `Visual baseline ${name} is missing. Run npm run update:visual.`,
      );
    }

    const [actualImage, expectedImage] = await Promise.all([
      sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(expected)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true }),
    ]);
    const actualInfo = actualImage.info;
    const expectedInfo = expectedImage.info;

    if (
      actualInfo.width !== expectedInfo.width ||
      actualInfo.height !== expectedInfo.height ||
      actualInfo.channels !== expectedInfo.channels
    ) {
      await this.writeFailureArtifacts(name, actual);
      throw new Error(
        `Visual snapshot ${name} changed dimensions from ` +
          `${expectedInfo.width}×${expectedInfo.height} to ` +
          `${actualInfo.width}×${actualInfo.height}.`,
      );
    }

    const diff = Buffer.alloc(actualImage.data.length);
    let changedPixels = 0;
    for (
      let offset = 0;
      offset < actualImage.data.length;
      offset += actualInfo.channels
    ) {
      let changed = false;
      for (let channel = 0; channel < actualInfo.channels; channel += 1) {
        if (
          Math.abs(
            actualImage.data[offset + channel] -
              expectedImage.data[offset + channel],
          ) > VISUAL_CHANNEL_TOLERANCE
        ) {
          changed = true;
          break;
        }
      }

      if (changed) changedPixels += 1;
      diff[offset] = changed ? 239 : actualImage.data[offset] * 0.35;
      diff[offset + 1] = changed ? 68 : actualImage.data[offset + 1] * 0.35;
      diff[offset + 2] = changed ? 68 : actualImage.data[offset + 2] * 0.35;
      diff[offset + 3] = 255;
    }

    const totalPixels = actualInfo.width * actualInfo.height;
    const changedPixelRatio = changedPixels / totalPixels;
    if (changedPixelRatio > MAX_VISUAL_CHANGED_PIXEL_RATIO) {
      await mkdir(this.artifactDirectory, { recursive: true });
      const diffPng = await sharp(diff, {
        raw: {
          width: actualInfo.width,
          height: actualInfo.height,
          channels: actualInfo.channels,
        },
      })
        .png()
        .toBuffer();
      await Promise.all([
        writeFile(
          resolve(this.artifactDirectory, `${name}.actual.png`),
          actual,
        ),
        writeFile(
          resolve(this.artifactDirectory, `${name}.diff.png`),
          diffPng,
        ),
      ]);
      throw new Error(
        `Visual snapshot ${name} changed ` +
          `${(changedPixelRatio * 100).toFixed(2)}% of pixels; ` +
          `the limit is ${(MAX_VISUAL_CHANGED_PIXEL_RATIO * 100).toFixed(2)}%. ` +
          "Review artifacts/visual.",
      );
    }

    console.log(
      `[visual-regression] ${name} passed ` +
        `(${(changedPixelRatio * 100).toFixed(3)}% changed pixels)`,
    );
  }

  private async writeFailureArtifacts(
    name: string,
    actual: Buffer,
  ): Promise<void> {
    await mkdir(this.artifactDirectory, { recursive: true });
    await writeFile(
      resolve(this.artifactDirectory, `${name}.actual.png`),
      actual,
    );
  }
}

function resolveVisualMode(): VisualMode {
  const argument = process.argv.find((value) =>
    value.startsWith("--visual="),
  );
  const value = argument?.slice("--visual=".length) ?? "off";

  if (value === "off" || value === "verify" || value === "update") {
    return value;
  }

  throw new Error(
    `Unsupported visual mode “${value}”. Use off, verify, or update.`,
  );
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
    await browser.setLabeledControl(
      "Species, form, and Shadow state",
      speciesId,
      "input",
      0,
      false,
    );
    await browser.waitFor(
      `document.querySelector('[data-selected-species-id="${speciesId}"]') && document.querySelector(".level-result")?.textContent?.includes("Level") && !document.querySelector(".level-result .invalid-value")`,
      `${speciesId} to resolve to a legal build`,
    );
    if (index === 0) {
      const radioSizes = await browser.evaluate<
        readonly { readonly width: number; readonly height: number }[]
      >(`[
        ...document.querySelectorAll('input[type="radio"]')
      ].map((control) => {
        const bounds = control.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      })`);
      invariant(
        radioSizes.every(
          ({ width, height }) => width <= 24 && height <= 24,
        ),
        "Inventory IV radio controls exceeded their compact control bounds.",
      );
      await browser.setViewport(320);
      await browser.assertNoHorizontalOverflow(
        "inventory autocomplete and IV controls",
      );
      await browser.setViewport(1440, 1_000);
      const defaultMoves = await browser.evaluate<readonly string[]>(`[
        ...["Fast move", "Charged move 1", "Charged move 2"]
      ].map((label) => {
        const owner = [...document.querySelectorAll("label")].find(
          (candidate) =>
            candidate.querySelector("span")?.textContent?.trim() === label
        );
        const control = owner?.querySelector("select");
        return control instanceof HTMLSelectElement ? control.value : "";
      })`);
      invariant(
        JSON.stringify(defaultMoves) ===
          JSON.stringify(["BUBBLE", "ICE_BEAM", "PLAY_ROUGH"]),
        `Azumarill did not default to its published PvPoke moveset: ${defaultMoves.join(", ")}.`,
      );
      await browser.setLabeledCheckbox("Favorite", true);
    }
    await browser.clickButton("Continue");
    await browser.waitFor(
      `document.querySelector(".guided-form-panel h2")?.textContent?.trim() === "Current or planned"`,
      "inventory build-intent step",
    );
    await browser.clickButton("Continue");
    await browser.waitFor(
      `Boolean(document.querySelector('textarea[placeholder="Optional build context"]'))`,
      "inventory review step",
    );
    await browser.setLabeledControl(
      "Notes Optional",
      `Browser fixture ${index + 1}: ${speciesId}`,
      "textarea",
    );
    await browser.clickButton("Add to inventory");
    await browser.waitFor(
      `location.pathname === "/inventory" && document.querySelectorAll(".inventory-card").length === ${index + 1}`,
      `${speciesId} to persist`,
    );
    if (index === 0) {
      const inventoryBadges = await browser.evaluate<boolean>(`(() => {
        const card = document.querySelector(".inventory-card");
        return (
          card?.querySelector(".context-badge")?.textContent?.trim() ===
            "CP 1499" &&
          card?.querySelector(".xl-badge")?.textContent?.trim() === "XL"
        );
      })()`);
      invariant(
        inventoryBadges,
        "Inventory did not render the subtle CP badge and Candy XL marker.",
      );
    }
  }
}

async function runCriticalWorkflows(
  browser: BrowserWorkflow,
  client: DevToolsClient,
  downloadDirectory: string,
  visual: VisualRegression,
): Promise<BrowserWorkflowReport> {
  const responsiveStates: string[] = [];

  await browser.setViewport(1440, 1_000);
  await browser.navigate("/", "Build with what you actually own.");
  await browser.waitFor(
    `document.querySelector("#pvpoke-data-title")?.textContent?.trim() === "Connected"`,
    "real PvPoke data connection",
  );
  const rankingsInDesktopNavigation = await browser.evaluate<boolean>(
    `[...document.querySelectorAll(".app-nav--desktop a")].some(
      (link) =>
        link.getAttribute("href") === "/catalog" &&
        link.textContent?.trim() === "Rankings"
    )`,
  );
  invariant(
    rankingsInDesktopNavigation,
    "Rankings was not present in desktop primary navigation.",
  );
  await browser.navigate("/catalog", "Rankings");
  await browser.waitFor(
    `document.querySelectorAll(".ranking-row").length > 0`,
    "ranking rows",
  );
  const rankingRowSummary = await browser.evaluate<boolean>(`(() => {
    const row = document.querySelector(".ranking-row");
    const text = row?.querySelector(".ranking-row__summary")
      ?.textContent ?? "";
    return Boolean(
      row?.querySelector(".pokemon-sprite img") &&
      row?.querySelector(".ranking-row__identity h2") &&
      row?.querySelector(".ranking-row__rank strong") &&
      text.includes("Typing") &&
      text.includes("Recommended moves") &&
      text.includes("Optimal IVs")
    );
  })()`);
  invariant(
    rankingRowSummary,
    "A ranking row did not expose its critical summary information.",
  );
  await browser.evaluate(`(() => {
    const summary = document.querySelector(".ranking-row summary");
    if (summary instanceof HTMLElement) summary.click();
  })()`);
  await browser.waitFor(
    `Boolean(document.querySelector(".ranking-row[open] .ranking-detail"))`,
    "expanded ranking details",
  );
  const rankingDetails = await browser.evaluate<boolean>(`(() => {
    const detail = document.querySelector(".ranking-row[open] .ranking-detail");
    const text = detail?.textContent ?? "";
    return Boolean(
      detail?.querySelector(".performance-graph__chart") &&
      detail?.querySelector(".ranking-stats") &&
      detail?.querySelector(".ranking-matchups .pokemon-sprite") &&
      text.includes("Key wins") &&
      text.includes("Key losses") &&
      text.includes("Defensive typing") &&
      text.includes("Full movepool")
    );
  })()`);
  invariant(
    rankingDetails,
    "Expanded ranking details were missing an upstream ranking section.",
  );
  await visual.capture(
    browser,
    "rankings-desktop",
    1440,
    1_000,
  );
  const invalidRankingTags = await browser.evaluate<number>(
    `[...document.querySelectorAll(".ranking-row .type-pill")].filter(
      (pill) => ["shadow", "meta", "none"].includes(
        pill.textContent?.trim().toLocaleLowerCase() ?? ""
      )
    ).length`,
  );
  invariant(
    invalidRankingTags === 0,
    "Rankings rendered Shadow, Meta, or None as a type tag.",
  );
  await browser.setViewport(320);
  await visual.capture(
    browser,
    "rankings-mobile",
    320,
    900,
  );
  await visual.capture(
    browser,
    "rankings-mobile-expanded",
    320,
    900,
    ".ranking-detail",
  );
  await browser.assertNoHorizontalOverflow("rankings");
  responsiveStates.push("rankings");
  await browser.setViewport(1440, 1_000);

  await browser.navigate("/inventory/new", "Add Pokémon");
  const blankPokemonSelection = await browser.evaluate<boolean>(`(() => {
    const input = document.querySelector('[role="combobox"]');
    return input instanceof HTMLInputElement &&
      input.value === "" &&
      input.placeholder === "Enter a Pokémon name or form" &&
      !input.dataset.selectedSpeciesId &&
      document.querySelector(".selected-pokemon-preview--empty")
        ?.textContent?.includes("No Pokémon selected") === true;
  })()`);
  invariant(
    blankPokemonSelection,
    "A new inventory form did not start with a blank Pokémon autocomplete.",
  );
  await visual.capture(
    browser,
    "inventory-form-tablet",
    768,
    1_000,
    ".selected-pokemon-preview",
  );
  await browser.setViewport(1440, 1_000);

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
  await visual.capture(
    browser,
    "inventory-card-desktop",
    1440,
    800,
    ".inventory-card",
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
  await browser.clickButton("Continue");
  await browser.waitFor(
    `document.querySelector(".guided-form-panel h2")?.textContent?.trim() === "Current or planned"`,
    "inventory edit build-intent step",
  );
  await browser.clickButton("Continue");
  await browser.waitFor(
    `Boolean(document.querySelector('textarea[placeholder="Optional build context"]'))`,
    "inventory edit review step",
  );
  await browser.setLabeledControl(
    "Notes Optional",
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
  const renderedTeamRoles = await browser.evaluate<readonly string[]>(
    `[...document.querySelectorAll(".team-member__role")].map(
      (role) => role.textContent?.trim() ?? ""
    )`,
  );
  invariant(
    JSON.stringify(renderedTeamRoles) ===
      JSON.stringify(["Lead", "Safe switch", "Closer"]),
    `Saved-team roles were not separated and humanized: ${renderedTeamRoles.join(", ")}.`,
  );
  const savedTeamLeagueBadge = await browser.evaluate<boolean>(
    `document.querySelector(".team-card .context-badge")
      ?.textContent?.trim() === "Great League"`,
  );
  invariant(
    savedTeamLeagueBadge,
    "Saved teams did not render the subtle Great League badge.",
  );
  await visual.capture(
    browser,
    "saved-team-card-desktop",
    1440,
    800,
    ".team-card",
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
  await visual.capture(
    browser,
    "simulation-evidence-desktop",
    1440,
    1_000,
    ".team-scorecard",
  );
  await visual.capture(
    browser,
    "simulation-evidence-mobile",
    320,
    900,
    ".team-scorecard",
  );
  await browser.setViewport(320);
  await browser.assertNoHorizontalOverflow("populated saved-team simulation");
  responsiveStates.push("saved-team simulation result");
  await browser.setViewport(1440, 1_000);
  const readableThreatEvidence = await browser.evaluate<boolean>(`(() => {
    const threatSection = [...document.querySelectorAll(".analysis-panel")]
      .find((panel) => panel.textContent?.includes("Threat evidence"));
    if (!threatSection) return false;
    const text = threatSection.textContent ?? "";
    const results = [...threatSection.querySelectorAll(".matchup-result")];
    return !text.includes("At risk") &&
      !text.includes("Team rating") &&
      results.length > 0 &&
      results.every((result) =>
        /Wins this matchup|Loses this matchup|Ties this matchup/.test(
          result.parentElement?.textContent ?? ""
        ) &&
        result.textContent?.includes("battle score")
      );
  })()`);
  invariant(
    readableThreatEvidence,
    "Threat evidence did not expose plain-language outcomes and battle scores.",
  );
  const alternativeSpritesComplete = await browser.evaluate<boolean>(`(() => {
    const cards = [...document.querySelectorAll(".alternative-card")];
    return cards.length === 0 ||
      cards.every((card) => Boolean(card.querySelector(".pokemon-sprite")));
  })()`);
  invariant(
    alternativeSpritesComplete,
    "A threat-alternative card rendered without a Pokémon sprite.",
  );
  await browser.evaluate(`(() => {
    const details = document.querySelector(".simulation-matrix");
    if (details instanceof HTMLDetailsElement) details.open = true;
    return true;
  })()`);
  await browser.waitFor(
    `document.querySelectorAll(".battle-metric").length > 0`,
    "labeled exact-battle metrics",
  );
  const legacyFastDamageNotation = await browser.evaluate<boolean>(
    `document.querySelector(".simulation-matrix")?.textContent?.includes("fast damage") ?? false`,
  );
  invariant(
    !legacyFastDamageNotation,
    "Exact battle details retained the ambiguous fast-damage slash notation.",
  );

  await browser.navigate("/recommend", "Build around your anchors");
  await browser.clickButton("Continue to experiment");
  const rankedPartnerSetting = await browser.evaluate<boolean>(`(() => {
    const label = [...document.querySelectorAll("label")].find((candidate) =>
      candidate.textContent?.includes("Include ranked Pokémon not in my inventory")
    );
    return label?.querySelector('input[type="checkbox"]') instanceof HTMLInputElement;
  })()`);
  invariant(
    rankedPartnerSetting,
    "Recommendation settings did not expose the ranked teammate scope.",
  );
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
  const visualMode = resolveVisualMode();
  const visual = new VisualRegression(visualMode, projectRoot);
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
      visual,
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
