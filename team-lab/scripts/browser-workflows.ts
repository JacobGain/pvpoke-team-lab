import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  createServer as createViteServer,
  preview as createVitePreviewServer,
  type PreviewServer,
  type ViteDevServer,
} from "vite";
import sharp from "sharp";

const HOST = "127.0.0.1";
const GLOBAL_TIMEOUT_MS = 120_000;
const STEP_TIMEOUT_MS = 20_000;
const PERSISTENCE_TIMEOUT_MS = 45_000;
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

type DevToolsEventListener = (
  params: Record<string, unknown>,
) => void;

interface NavigationOptions {
  readonly attempts?: number;
}

interface NavigationDocumentState {
  readonly bodyText: string;
  readonly heading: string;
  readonly readyState: string;
  readonly rootChildCount: number;
  readonly title: string;
  readonly url: string;
}

interface WorkflowTiming {
  readonly elapsedMs: number;
  readonly maxMainThreadGapMs: number;
  readonly renderedText: string;
}

interface BrowserWorkflowReport {
  readonly buildTarget: BrowserTestTarget;
  readonly releaseId: string;
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
type BrowserTestTarget = "development" | "production";

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
  const exitedAfterTerm = await waitForProcessExit(browserProcess, 2_000);
  if (exitedAfterTerm) return;

  if (browserProcess.exitCode === null) {
    browserProcess.kill("SIGKILL");
    await waitForProcessExit(browserProcess, 2_000);
  }
}

async function waitForProcessExit(
  browserProcess: ChildProcessWithoutNullStreams,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (browserProcess.exitCode !== null) return true;

  return Promise.race([
    new Promise<true>((resolveExit) => {
      browserProcess.once("exit", () => resolveExit(true));
    }),
    delay(timeoutMilliseconds).then(() => false),
  ]);
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
  private readonly eventListeners = new Map<
    string,
    Set<DevToolsEventListener>
  >();
  private readonly socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        readonly id?: number;
        readonly result?: unknown;
        readonly error?: { readonly message?: string };
        readonly method?: string;
        readonly params?: Record<string, unknown>;
      };

      if (message.method) {
        for (
          const listener of
          this.eventListeners.get(message.method) ?? []
        ) {
          listener(message.params ?? {});
        }
        return;
      }
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

  on(
    method: string,
    listener: DevToolsEventListener,
  ): () => void {
    const listeners =
      this.eventListeners.get(method) ??
      new Set<DevToolsEventListener>();
    listeners.add(listener);
    this.eventListeners.set(method, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(method);
      }
    };
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
  private readonly networkRequests = new Map<string, string>();
  private readonly recentBrowserErrors: string[] = [];

  constructor(client: DevToolsClient, appUrl: string) {
    this.client = client;
    this.appUrl = appUrl;
  }

  async initializeDiagnostics(): Promise<void> {
    this.client.on("Network.requestWillBeSent", (params) => {
      const event = params as {
        readonly requestId?: string;
        readonly request?: { readonly url?: string };
      };
      if (event.requestId && event.request?.url) {
        this.networkRequests.set(event.requestId, event.request.url);
      }
    });
    this.client.on("Network.loadingFailed", (params) => {
      const event = params as {
        readonly requestId?: string;
        readonly errorText?: string;
        readonly canceled?: boolean;
      };
      if (!event.canceled) {
        this.recordBrowserError(
          `Network load failed for ${this.networkRequests.get(event.requestId ?? "") ?? "unknown request"}: ${event.errorText ?? "unknown error"}`,
        );
      }
    });
    this.client.on("Network.responseReceived", (params) => {
      const event = params as {
        readonly response?: {
          readonly status?: number;
          readonly url?: string;
        };
      };
      const status = event.response?.status;
      if (status !== undefined && status >= 400) {
        this.recordBrowserError(
          `HTTP ${status} from ${event.response?.url ?? "unknown request"}`,
        );
      }
    });
    this.client.on("Runtime.exceptionThrown", (params) => {
      const event = params as {
        readonly exceptionDetails?: {
          readonly text?: string;
          readonly exception?: {
            readonly description?: string;
          };
        };
      };
      this.recordBrowserError(
        `Runtime exception: ${
          event.exceptionDetails?.exception?.description ??
          event.exceptionDetails?.text ??
          "unknown exception"
        }`,
      );
    });
    this.client.on("Runtime.consoleAPICalled", (params) => {
      const event = params as {
        readonly type?: string;
        readonly args?: readonly {
          readonly value?: unknown;
          readonly description?: string;
        }[];
      };
      if (event.type === "error") {
        const message = event.args
          ?.map((argument) =>
            argument.description ??
            (typeof argument.value === "string"
              ? argument.value
              : JSON.stringify(argument.value)),
          )
          .filter(Boolean)
          .join(" ");
        this.recordBrowserError(
          `Console error: ${message || "unknown error"}`,
        );
      }
    });
    this.client.on("Log.entryAdded", (params) => {
      const event = params as {
        readonly entry?: {
          readonly level?: string;
          readonly text?: string;
          readonly url?: string;
        };
      };
      if (event.entry?.level === "error") {
        this.recordBrowserError(
          `Browser log: ${event.entry.text ?? "unknown error"}${event.entry.url ? ` (${event.entry.url})` : ""}`,
        );
      }
    });

    await Promise.all([
      this.client.call("Network.enable"),
      this.client.call("Runtime.enable"),
      this.client.call("Log.enable"),
    ]);
  }

  private recordBrowserError(message: string): void {
    this.recentBrowserErrors.push(message);
    if (this.recentBrowserErrors.length > 20) {
      this.recentBrowserErrors.splice(
        0,
        this.recentBrowserErrors.length - 20,
      );
    }
  }

  private async navigationDiagnostic(
    attempt: number,
    failure: unknown,
  ): Promise<string> {
    let documentState: NavigationDocumentState | undefined;
    let diagnosticFailure: string | undefined;

    try {
      documentState = await this.evaluate<NavigationDocumentState>(`({
        bodyText: (document.body?.innerText ?? "")
          .replace(/\\s+/g, " ")
          .trim()
          .slice(0, 500),
        heading:
          document.querySelector("h1, h2")?.textContent?.trim() ?? "",
        readyState: document.readyState,
        rootChildCount:
          document.querySelector("#root")?.childElementCount ?? -1,
        title: document.title,
        url: location.href
      })`);
    } catch (error) {
      diagnosticFailure =
        error instanceof Error ? error.message : String(error);
    }

    return JSON.stringify({
      attempt,
      failure:
        failure instanceof Error ? failure.message : String(failure),
      document: documentState,
      diagnosticFailure,
      browserErrors: this.recentBrowserErrors,
    });
  }

  resolveUrl(pathname: string): string {
    const appBase = new URL(this.appUrl);
    const supplied = new URL(pathname, appBase.origin);
    const appPath = appBase.pathname.replace(/\/+$/, "");

    invariant(
      supplied.origin === appBase.origin,
      `Navigation must remain within TeamLab: ${pathname}.`,
    );

    if (
      appPath &&
      (supplied.pathname === appPath ||
        supplied.pathname.startsWith(`${appPath}/`))
    ) {
      return supplied.href;
    }

    const relativePath = `${supplied.pathname}${supplied.search}${supplied.hash}`
      .replace(/^\/+/, "");
    return new URL(`${appPath}/${relativePath}`, appBase.origin).href;
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

  async navigate(
    pathname: string,
    heading: string,
    headingSelector = "h1",
    options: NavigationOptions = {},
  ): Promise<void> {
    const destination = this.resolveUrl(pathname);
    const destinationPath = new URL(destination).pathname;
    const attempts = options.attempts ?? 1;
    const diagnostics: string[] = [];

    invariant(
      Number.isInteger(attempts) && attempts >= 1 && attempts <= 3,
      "Browser navigation attempts must be an integer between 1 and 3.",
    );

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      this.recentBrowserErrors.length = 0;

      if (attempt > 1) {
        await delay(1_000 * 2 ** (attempt - 2));
        await this.client.call("Network.clearBrowserCache");
      }

      const attemptUrl = new URL(destination);
      if (attempt > 1) {
        attemptUrl.searchParams.set(
          "__teamlab_navigation_attempt",
          String(attempt),
        );
      }

      try {
        await this.client.call("Page.navigate", {
          url: attemptUrl.href,
        });
        await this.waitFor(
          `location.pathname === ${JSON.stringify(destinationPath)} && document.querySelector(${JSON.stringify(headingSelector)})?.textContent?.trim() === ${JSON.stringify(heading)}`,
          `${pathname} to render “${heading}”`,
        );
        return;
      } catch (error) {
        diagnostics.push(
          await this.navigationDiagnostic(attempt, error),
        );
        if (attempt < attempts) {
          console.warn(
            `[browser-workflows] navigation attempt ${attempt}/${attempts} failed; retrying ${pathname}: ${diagnostics.at(-1)}`,
          );
        }
      }
    }

    throw new Error(
      `Failed waiting for ${pathname} to render “${heading}” after ${attempts} attempt(s).\n${diagnostics.join("\n")}`,
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

function resolveBrowserTestTarget(): BrowserTestTarget {
  return process.argv.includes("--production")
    ? "production"
    : "development";
}

function resolveDeploymentBaseUrl(): string | undefined {
  const deploymentMode = process.argv.includes("--deployment");
  const argument = process.argv.find((value) =>
    value.startsWith("--origin="),
  );

  if (!deploymentMode) {
    invariant(
      !argument,
      "--origin requires the --deployment browser-test mode.",
    );
    return undefined;
  }

  invariant(
    argument,
    "Deployment browser tests require --origin=https://deployed.example.",
  );
  const value = argument.slice("--origin=".length);
  const deploymentUrl = new URL(value);

  invariant(
    (deploymentUrl.protocol === "https:" ||
      deploymentUrl.protocol === "http:") &&
      !deploymentUrl.username &&
      !deploymentUrl.password &&
      !deploymentUrl.search &&
      !deploymentUrl.hash,
    "The deployment URL must be an HTTP(S) application base without credentials, a query, or a fragment.",
  );

  return `${deploymentUrl.origin}${deploymentUrl.pathname.replace(/\/+$/, "")}`;
}

function resolveConfiguredBasePath(): string {
  const configuredBasePath = process.env.VITE_BASE_PATH?.trim() || "/";
  const baseUrl = new URL(configuredBasePath, "http://teamlab.invalid");

  invariant(
    baseUrl.origin === "http://teamlab.invalid" &&
      !baseUrl.search &&
      !baseUrl.hash,
    "VITE_BASE_PATH must be an application-rooted path without a query or fragment.",
  );

  return baseUrl.pathname.replace(/\/+$/, "");
}

function resolveExpectedCommitSha(
  deploymentBaseUrl: string | undefined,
): string | undefined {
  const expectedCommitSha =
    process.env.TEAMLAB_EXPECTED_COMMIT_SHA?.trim().toLowerCase();

  invariant(
    deploymentBaseUrl || !expectedCommitSha,
    "TEAMLAB_EXPECTED_COMMIT_SHA is only valid for deployment browser tests.",
  );
  invariant(
    !expectedCommitSha || /^[a-f0-9]{7,64}$/.test(expectedCommitSha),
    "TEAMLAB_EXPECTED_COMMIT_SHA must be a 7-64 character hexadecimal Git commit ID.",
  );

  return expectedCommitSha || undefined;
}

async function assertBuildTarget(
  browser: BrowserWorkflow,
  target: BrowserTestTarget,
  expectedCommitSha?: string,
): Promise<string> {
  if (target === "development") {
    const diagnosticsAvailable = await browser.evaluate<boolean>(
      `Boolean(
        document.querySelector('a[href$="/diagnostics/simulation"]') &&
        [...document.querySelectorAll(".app-nav a")].some(
          (link) => link.textContent?.trim() === "Engine diagnostics"
        )
      )`,
    );
    invariant(
      diagnosticsAvailable,
      "Development mode did not expose engine diagnostics.",
    );
    return "development";
  }

  const productionState = await browser.evaluate<{
    readonly dataHealthTag: string;
    readonly diagnosticsLinks: number;
    readonly release: {
      readonly formatVersion?: number;
      readonly releaseId?: string;
      readonly target?: string;
      readonly source?: { readonly commitSha?: string };
      readonly capabilities?: { readonly diagnostics?: boolean };
      readonly schemas?: {
        readonly database?: number;
        readonly backup?: number;
        readonly inventoryRecord?: number;
        readonly savedTeam?: number;
      };
      readonly pvpoke?: {
        readonly dataVersion?: string;
        readonly manifestSha256?: string;
      };
    };
  }>(`(async () => ({
    dataHealthTag:
      document.querySelector(".app-rail .data-health")?.tagName ?? "",
    diagnosticsLinks:
      document.querySelectorAll('a[href$="/diagnostics/simulation"]').length,
    release: await fetch(${JSON.stringify(browser.resolveUrl("/release.json"))}, { cache: "no-store" }).then(
      (response) => {
        if (!response.ok) {
          throw new Error(\`release.json returned \${response.status}\`);
        }
        return response.json();
      }
    )
  }))()`);
  const release = productionState.release;

  invariant(
    productionState.dataHealthTag === "DIV" &&
      productionState.diagnosticsLinks === 0,
    `Production exposed diagnostics navigation: ${JSON.stringify(productionState)}.`,
  );
  invariant(
    release.formatVersion === 1 &&
      Boolean(release.releaseId) &&
      release.target === "public" &&
      Boolean(release.source?.commitSha) &&
      release.capabilities?.diagnostics === false &&
      Boolean(release.schemas?.database) &&
      Boolean(release.schemas?.backup) &&
      Boolean(release.schemas?.inventoryRecord) &&
      Boolean(release.schemas?.savedTeam) &&
      Boolean(release.pvpoke?.dataVersion) &&
      /^[a-f0-9]{64}$/.test(release.pvpoke?.manifestSha256 ?? ""),
    `Production release metadata is incomplete: ${JSON.stringify(release)}.`,
  );
  invariant(
    !expectedCommitSha ||
      release.source!.commitSha!.toLowerCase().startsWith(expectedCommitSha),
    `Deployment commit mismatch: expected ${expectedCommitSha}, received ${release.source?.commitSha ?? "missing"}.`,
  );
  await browser.navigate(
    "/diagnostics/simulation",
    "Page not found",
    "h2",
  );
  await browser.navigate("/", "Turn your roster into a battle plan.");

  return release.releaseId!;
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
    try {
      await browser.waitFor(
        `location.pathname.endsWith("/inventory") && document.querySelectorAll(".inventory-card").length === ${index + 1}`,
        `${speciesId} to persist`,
        PERSISTENCE_TIMEOUT_MS,
      );
    } catch (error) {
      const persistenceState = await browser.evaluate<{
        readonly alert: string;
        readonly cardCount: number;
        readonly pathname: string;
        readonly submitText: string;
      }>(`(() => {
        const submit = [...document.querySelectorAll("button")].find(
          (button) =>
            button instanceof HTMLButtonElement &&
            (button.name === "save-intent" || button.type === "submit")
        );
        return {
          alert:
            document.querySelector('[role="alert"]')?.textContent?.trim() ?? "",
          cardCount: document.querySelectorAll(".inventory-card").length,
          pathname: location.pathname,
          submitText: submit?.textContent?.trim() ?? ""
        };
      })()`);
      const message =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message} Inventory persistence state: ${JSON.stringify(persistenceState)}.`,
        { cause: error },
      );
    }
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

interface MobileAuditResult {
  readonly clippedElements: readonly string[];
  readonly undersizedControls: readonly string[];
  readonly uncontainedOverflow: readonly string[];
}

async function auditMobilePage(
  browser: BrowserWorkflow,
  pathname: string,
  heading: string,
  viewportWidth: number,
  headingSelector = "h1",
): Promise<MobileAuditResult> {
  await browser.navigate(pathname, heading, headingSelector);
  await browser.setViewport(viewportWidth, 900);
  await browser.assertNoHorizontalOverflow(`${pathname} at ${viewportWidth}px`);

  return browser.evaluate<MobileAuditResult>(`(() => {
    const descriptor = (element) => {
      const tag = element.tagName.toLocaleLowerCase();
      const name =
        element.getAttribute("aria-label") ??
        element.textContent?.replace(/\\s+/g, " ").trim().slice(0, 45) ??
        "";
      const bounds = element.getBoundingClientRect();
      const size =
        \`\${Math.round(bounds.width)}x\${Math.round(bounds.height)}\` +
        \` client:\${element.clientWidth} scroll:\${element.scrollWidth}\`;
      return name ? \`\${tag} "\${name}" (\${size})\` : \`\${tag} (\${size})\`;
    };
    const isRendered = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    };
    const clippedElements = [...document.querySelectorAll(
      "main *, .app-content > *, .mobile-tabbar *, .app-topbar *"
    )]
      .filter((element) => {
        if (!(element instanceof HTMLElement) || !isRendered(element)) {
          return false;
        }
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > window.innerWidth + 1;
      })
      .slice(0, 12)
      .map(descriptor);
    const undersizedControls = [...document.querySelectorAll(
      "button, summary, input:not([type=radio]):not([type=checkbox]):not([type=hidden]), select, textarea, .primary-link, .secondary-link, .mobile-tabbar__link"
    )]
      .filter((element) => {
        if (!(element instanceof HTMLElement) || !isRendered(element)) {
          return false;
        }
        const bounds = element.getBoundingClientRect();
        return bounds.width < 44 || bounds.height < 44;
      })
      .slice(0, 12)
      .map(descriptor);
    const uncontainedOverflow = [...document.querySelectorAll(
      "main *, .app-content *"
    )]
      .filter((element) => {
        if (!(element instanceof HTMLElement) || !isRendered(element)) {
          return false;
        }
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          return false;
        }
        const style = getComputedStyle(element);
        return (
          element.scrollWidth > element.clientWidth + 1 &&
          !["auto", "scroll", "hidden", "clip"].includes(style.overflowX)
        );
      })
      .slice(0, 12)
      .map(descriptor);
    return {
      clippedElements,
      undersizedControls,
      uncontainedOverflow
    };
  })()`);
}

async function assertStickyControls(
  browser: BrowserWorkflow,
  selector: ".catalog-controls" | ".inventory-controls",
  viewportWidth: number,
): Promise<void> {
  await browser.setViewport(viewportWidth, 900);
  const sticky = await browser.evaluate<{
    readonly actualTop: number;
    readonly expectedTop: number;
    readonly position: string;
    readonly scrollY: number;
  }>(`(async () => {
    window.scrollTo({ left: 0, top: 700, behavior: "instant" });
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    );
    const controls = document.querySelector(${JSON.stringify(selector)});
    const topbar = document.querySelector(".app-topbar--mobile");
    const topbarStyle = topbar ? getComputedStyle(topbar) : null;
    const topbarVisible =
      topbar instanceof HTMLElement &&
      topbarStyle?.display !== "none" &&
      topbar.getBoundingClientRect().height > 0;
    return {
      actualTop: controls?.getBoundingClientRect().top ?? -1,
      expectedTop: topbarVisible ? topbar.getBoundingClientRect().bottom : 0,
      position: controls ? getComputedStyle(controls).position : "",
      scrollY: window.scrollY
    };
  })()`);
  invariant(
    sticky.scrollY > 0 &&
      sticky.position === "sticky" &&
      Math.abs(sticky.actualTop - sticky.expectedTop) <= 1.5,
    `${selector} was not flush with the active top chrome at ${viewportWidth}px: ${JSON.stringify(sticky)}.`,
  );
  await browser.evaluate(
    `window.scrollTo({ left: 0, top: 0, behavior: "instant" })`,
  );
}

async function assertStickyActionSurface(
  browser: BrowserWorkflow,
  viewportWidth: number,
  state: string,
): Promise<void> {
  await browser.setViewport(viewportWidth, 900);
  const sticky = await browser.evaluate<{
    readonly actualBottom: number;
    readonly backdropFilter: string;
    readonly backgroundColor: string;
    readonly expectedBottom: number;
    readonly opaque: boolean;
    readonly position: string;
    readonly scrollY: number;
  }>(`(async () => {
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      0
    );
    window.scrollTo({
      left: 0,
      top: Math.min(160, Math.max(1, maxScroll - 1)),
      behavior: "instant"
    });
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    );
    const actions = document.querySelector(".form-actions");
    const tabbar = document.querySelector(".mobile-tabbar");
    const tabbarStyle = tabbar ? getComputedStyle(tabbar) : null;
    const tabbarVisible =
      tabbar instanceof HTMLElement &&
      tabbarStyle?.display !== "none" &&
      tabbar.getBoundingClientRect().height > 0;
    const style = actions ? getComputedStyle(actions) : null;
    const backgroundColor = style?.backgroundColor ?? "";
    const alphaMatch = backgroundColor.match(
      /rgba?\\([^)]*[, /]([\\d.]+)\\)$/
    );
    return {
      actualBottom: actions?.getBoundingClientRect().bottom ?? -1,
      backdropFilter: style?.backdropFilter ?? "",
      backgroundColor,
      expectedBottom: tabbarVisible
        ? tabbar.getBoundingClientRect().top
        : window.innerHeight,
      opaque: !backgroundColor.startsWith("rgba") ||
        Number(alphaMatch?.[1] ?? 1) === 1,
      position: style?.position ?? "",
      scrollY: window.scrollY
    };
  })()`);
  invariant(
    sticky.scrollY > 0 &&
      sticky.position === "sticky" &&
      sticky.opaque &&
      sticky.backdropFilter === "none" &&
      Math.abs(sticky.actualBottom - sticky.expectedBottom) <= 1.5,
    `${state} sticky actions did not form an opaque, flush surface at ${viewportWidth}px: ${JSON.stringify(sticky)}.`,
  );
  await browser.evaluate(
    `window.scrollTo({ left: 0, top: 0, behavior: "instant" })`,
  );
}

async function runCriticalWorkflows(
  browser: BrowserWorkflow,
  client: DevToolsClient,
  downloadDirectory: string,
  visual: VisualRegression,
  buildTarget: BrowserTestTarget,
  initialNavigationAttempts: number,
  expectedCommitSha?: string,
): Promise<BrowserWorkflowReport> {
  const responsiveStates: string[] = [];

  await browser.setViewport(1440, 1_000);
  await browser.navigate(
    "/",
    "Turn your roster into a battle plan.",
    "h1",
    { attempts: initialNavigationAttempts },
  );
  await browser.waitFor(
    `document.querySelector("#pvpoke-data-title")?.textContent?.trim() === "Ready"`,
    "bundled PvPoke data",
  );
  const releaseId = await assertBuildTarget(
    browser,
    buildTarget,
    expectedCommitSha,
  );
  await browser.waitFor(
    `document.querySelectorAll(".dashboard-meta-watch li").length === 3 &&
      document.querySelectorAll(
        ".dashboard-meta-watch li .pokemon-sprite img"
      ).length === 3`,
    "dashboard meta watch",
  );
  const dashboardContent = await browser.evaluate<{
    readonly hasBattleProtocol: boolean;
    readonly hasDisclaimer: boolean;
    readonly hasLicenseLink: boolean;
    readonly metaRows: number;
    readonly spriteRows: number;
  }>(`({
    hasBattleProtocol: document.body.textContent?.includes("Battle protocol") === true,
    hasDisclaimer:
      document.querySelector(".app-footer__legal")?.textContent
        ?.includes("TeamLab is an independent, unofficial project") === true,
    hasLicenseLink:
      document.querySelector('.app-footer a[href*="pvpoke/pvpoke"][href*="LICENSE"]')
        ?.textContent?.trim() === "MIT License",
    metaRows: document.querySelectorAll(".dashboard-meta-watch li").length,
    spriteRows: document.querySelectorAll(
      ".dashboard-meta-watch li .pokemon-sprite img"
    ).length
  })`);
  invariant(
    !dashboardContent.hasBattleProtocol &&
      dashboardContent.hasDisclaimer &&
      dashboardContent.hasLicenseLink &&
      dashboardContent.metaRows === 3 &&
      dashboardContent.spriteRows === 3,
    `The dashboard meta watch or shared attribution was incomplete: ${JSON.stringify(dashboardContent)}.`,
  );
  await visual.capture(
    browser,
    "dashboard-desktop",
    1440,
    1_000,
  );
  await visual.capture(
    browser,
    "dashboard-mobile",
    320,
    900,
  );
  await browser.setViewport(1440, 1_000);
  const rankingsInDesktopNavigation = await browser.evaluate<boolean>(
    `[...document.querySelectorAll(".app-nav--rail a")].some(
      (link) =>
        link.getAttribute("href")?.endsWith("/catalog") &&
        link.textContent?.trim() === "Rankings"
    ) && Boolean(document.querySelector(".app-rail .app-rail__format"))`,
  );
  invariant(
    rankingsInDesktopNavigation,
    "The desktop command rail did not expose Rankings and format context.",
  );
  await browser.navigate("/catalog", "Rankings");
  await browser.waitFor(
    `document.querySelectorAll(".ranking-row").length > 0`,
    "ranking rows",
  );
  const rankingPagination = await browser.evaluate<{
    readonly count: number;
    readonly hasRefineCopy: boolean;
    readonly hasXlBuild: boolean;
  }>(`({
    count: document.querySelectorAll(".ranking-row").length,
    hasRefineCopy:
      document.querySelector(".catalog-pagination")?.textContent
        ?.includes("Refine the search to narrow the catalog") === true,
    hasXlBuild: Boolean(document.querySelector(".ranking-row .xl-badge"))
  })`);
  invariant(
    rankingPagination.count === 100 &&
      rankingPagination.hasRefineCopy &&
      rankingPagination.hasXlBuild,
    `Rankings pagination or XL labeling was incomplete: ${JSON.stringify(rankingPagination)}.`,
  );
  await assertStickyControls(browser, ".catalog-controls", 1440);
  await assertStickyControls(browser, ".catalog-controls", 768);
  const rankingHeaderLayout = await browser.evaluate<{
    readonly asideTop: number;
    readonly mainBottom: number;
    readonly summaryWidth: number;
  }>(`(() => {
    const main = document.querySelector(".catalog-page .page-header__main");
    const aside = document.querySelector(".catalog-page .page-header__aside");
    const summary = document.querySelector(".catalog-page .catalog-summary");
    return {
      asideTop: aside?.getBoundingClientRect().top ?? -1,
      mainBottom: main?.getBoundingClientRect().bottom ?? -1,
      summaryWidth: summary?.getBoundingClientRect().width ?? -1
    };
  })()`);
  invariant(
    rankingHeaderLayout.asideTop >= rankingHeaderLayout.mainBottom &&
      rankingHeaderLayout.summaryWidth >= 600,
    `The Rankings count was cramped at 768px: ${JSON.stringify(rankingHeaderLayout)}.`,
  );
  await browser.setViewport(1440, 1_000);
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
      detail?.querySelector(".ranking-detail__collapse") &&
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
  await browser.evaluate(`(() => {
    const button = document.querySelector(
      ".ranking-row[open] .ranking-detail__collapse"
    );
    if (button instanceof HTMLButtonElement) button.click();
  })()`);
  await browser.waitFor(
    `!document.querySelector(".ranking-row[open]")`,
    "collapsed ranking details",
  );
  const rankingCollapseFocus = await browser.evaluate<boolean>(`(() => {
    const summary = document.querySelector(".ranking-row__summary");
    return document.activeElement === summary;
  })()`);
  invariant(
    rankingCollapseFocus,
    "Collapsing ranking details did not return focus to the row summary.",
  );
  await browser.evaluate(`(() => {
    const pageTwo = [...document.querySelectorAll(
      ".catalog-pagination__pages button"
    )].find((button) => button.textContent?.trim() === "2");
    if (pageTwo instanceof HTMLButtonElement) pageTwo.click();
  })()`);
  await browser.waitFor(
    `document.querySelector(".ranking-row__rank strong")?.textContent?.trim() === "#101"`,
    "rankings page two",
  );

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
  const inventoryTimestampLabels = await browser.evaluate<boolean>(
    `[...document.querySelectorAll(".inventory-card__content > small")].every(
      (metadata) =>
        metadata.textContent?.trim().startsWith("Created ") === true &&
        metadata.textContent.includes(" · updated ")
    )`,
  );
  invariant(
    inventoryTimestampLabels,
    "Inventory records did not distinguish created and updated timestamps.",
  );
  await assertStickyControls(browser, ".inventory-controls", 1440);
  await assertStickyControls(browser, ".inventory-controls", 768);
  await browser.setViewport(1440, 1_000);

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
  await assertStickyActionSurface(
    browser,
    1440,
    "Inventory edit",
  );
  await assertStickyActionSurface(
    browser,
    320,
    "Mobile inventory edit",
  );
  await browser.setViewport(1440, 1_000);
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
    `location.pathname.endsWith("/inventory") && document.body.textContent?.includes("Edited by durable browser coverage")`,
    "inventory edit to persist",
  );

  await browser.navigate("/teams/new", "Create saved team");
  await assertStickyActionSurface(
    browser,
    1440,
    "Saved-team form",
  );
  await assertStickyActionSurface(
    browser,
    320,
    "Mobile saved-team form",
  );
  await browser.setViewport(1440, 1_000);
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
    `location.pathname.endsWith("/teams") && document.querySelector(".team-card h2")?.textContent === "Browser Coverage Team"`,
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
    `location.pathname.endsWith("/teams") && document.body.textContent?.includes("Edited through populated browser coverage")`,
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
  const pvpokeGradeEvidence = await browser.evaluate<boolean>(`(() => {
    const scorecard = document.querySelector(".team-scorecard");
    const grades = [...(scorecard?.querySelectorAll("article > strong") ?? [])]
      .map((grade) => grade.textContent?.trim() ?? "");
    const text = document.body.textContent ?? "";
    return (
      grades.length === 4 &&
      grades.every((grade) => /^[A-F]$/.test(grade)) &&
      !grades.includes("S") &&
      text.includes("PvPoke threat-score goal") &&
      text.includes("exact-moveset score")
    );
  })()`);
  invariant(
    pvpokeGradeEvidence,
    "Team grades did not use PvPoke A–F goals and exact-moveset evidence.",
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
  await visual.capture(
    browser,
    "recommendation-result-desktop",
    1440,
    1_000,
    ".recommendation-result",
  );
  await visual.capture(
    browser,
    "recommendation-result-mobile",
    320,
    900,
    ".recommendation-result",
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
    `[...document.querySelectorAll('[role="status"]')].some((status) =>
      status.textContent?.includes("TeamLab reset complete")
    )`,
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
      const status = [...document.querySelectorAll('[role="status"]')]
        .find((candidate) => candidate.textContent?.includes("Restore complete"));
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

  const diagnosticsMobileRoute =
    buildTarget === "production"
      ? ([
          "/diagnostics/simulation",
          "Page not found",
          "h2",
        ] as const)
      : ([
          "/diagnostics/simulation",
          "PvPoke engine diagnostics",
        ] as const);
  const mobileRoutes = [
    ["/", "Turn your roster into a battle plan."],
    ["/catalog", "Rankings"],
    ["/inventory", "Your inventory"],
    ["/inventory/new", "Add Pokémon"],
    ["/inventory/backup", "Backup and restore"],
    [firstRecord.analyzeHref, firstRecord.speciesName],
    [firstRecord.editHref, "Edit Pokémon"],
    ["/teams", "Saved teams"],
    ["/teams/new", "Create saved team"],
    [teamLinks.editHref, "Edit saved team"],
    diagnosticsMobileRoute,
    [teamLinks.simulationHref, "Browser Coverage Team"],
    ["/recommend", "Build around your anchors"],
    ["/route-that-does-not-exist", "Page not found", "h2"],
  ] as const;
  const mobileAuditWidths = [320, 430, 540, 680] as const;
  const mobileAuditIssues: string[] = [];

  for (const [pathname, heading, headingSelector = "h1"] of mobileRoutes) {
    for (const width of mobileAuditWidths) {
      const audit = await auditMobilePage(
        browser,
        pathname,
        heading,
        width,
        headingSelector,
      );
      const issues = [
        ...audit.clippedElements.map((item) => `clipped: ${item}`),
        ...audit.undersizedControls.map((item) => `undersized: ${item}`),
        ...audit.uncontainedOverflow.map((item) => `overflow: ${item}`),
      ];
      if (issues.length > 0) {
        mobileAuditIssues.push(
          `${pathname} at ${width}px: ${issues.join("; ")}`,
        );
      }
    }
  }

  await browser.navigate("/", "Turn your roster into a battle plan.");
  await browser.setViewport(320, 900);
  await browser.clickButton("More", ".mobile-tabbar button");
  const mobileMenuAudit = await browser.evaluate<{
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly viewportHeight: number;
    readonly viewportWidth: number;
  }>(`(() => {
    const menu = document.querySelector(".mobile-menu--open");
    const bounds = menu?.getBoundingClientRect();
    return {
      bottom: bounds?.bottom ?? -1,
      left: bounds?.left ?? -1,
      right: bounds?.right ?? -1,
      top: bounds?.top ?? -1,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  })()`);
  if (
    mobileMenuAudit.left < 0 ||
    mobileMenuAudit.right > mobileMenuAudit.viewportWidth ||
    mobileMenuAudit.top < 0 ||
    mobileMenuAudit.bottom > mobileMenuAudit.viewportHeight
  ) {
    mobileAuditIssues.push(
      `mobile More menu escaped the viewport: ${JSON.stringify(mobileMenuAudit)}`,
    );
  }
  invariant(
    mobileAuditIssues.length === 0,
    `Mobile route audit found issues:\n${mobileAuditIssues.join("\n")}`,
  );

  return {
    buildTarget,
    releaseId,
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
  const buildTarget = resolveBrowserTestTarget();
  const deploymentBaseUrl = resolveDeploymentBaseUrl();
  const expectedCommitSha = resolveExpectedCommitSha(deploymentBaseUrl);
  const visual = new VisualRegression(visualMode, projectRoot);
  const temporaryRoot = await mkdtemp(
    resolve(tmpdir(), "teamlab-browser-workflows-"),
  );
  const chromeProfile = resolve(temporaryRoot, "chrome-profile");
  const downloadDirectory = resolve(temporaryRoot, "downloads");
  await Promise.all([
    mkdir(chromeProfile, { recursive: true }),
    mkdir(downloadDirectory, { recursive: true }),
  ]);

  let viteServer: ViteDevServer | PreviewServer | undefined;
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
    const debuggingPort = await availablePort();
    const appPort = deploymentBaseUrl
      ? undefined
      : await availablePort();
    let appUrl = deploymentBaseUrl;

    if (!deploymentBaseUrl && buildTarget === "production") {
      viteServer = await createVitePreviewServer({
        configFile: resolve(projectRoot, "vite.config.ts"),
        logLevel: "error",
        mode: "production",
        preview: {
          host: HOST,
          port: appPort!,
          strictPort: true,
        },
      });
    } else if (!deploymentBaseUrl) {
      viteServer = await createViteServer({
        configFile: resolve(projectRoot, "vite.config.ts"),
        logLevel: "error",
        server: {
          host: HOST,
          port: appPort!,
          strictPort: true,
        },
      });
      await viteServer.listen();
    }

    appUrl ??= `http://${HOST}:${appPort!}${resolveConfiguredBasePath()}`;
    if (deploymentBaseUrl) {
      console.log(
        `[browser-workflows] testing deployed application ${deploymentBaseUrl}`,
      );
    }
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
    await browser.initializeDiagnostics();
    const report = await runCriticalWorkflows(
      browser,
      client,
      downloadDirectory,
      visual,
      buildTarget,
      deploymentBaseUrl ? 3 : 1,
      expectedCommitSha,
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
    await rm(temporaryRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  },
);
