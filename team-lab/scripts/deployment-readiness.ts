const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5_000;

interface DeploymentReleaseMetadata {
  readonly formatVersion?: number;
  readonly releaseId?: string;
  readonly target?: string;
  readonly source?: {
    readonly commitSha?: string;
  };
  readonly capabilities?: {
    readonly diagnostics?: boolean;
  };
}

export interface DeploymentReadiness {
  readonly origin: string;
  readonly releaseId: string;
  readonly commitSha: string;
  readonly assetCount: number;
  readonly attempts: number;
}

export interface DeploymentReadinessOptions {
  readonly origin: string;
  readonly expectedCommitSha: string;
  readonly timeoutMs?: number;
  readonly requestTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly fetchImplementation?: typeof fetch;
  readonly onRetry?: (message: string) => void;
}

interface DeploymentAttemptResult {
  readonly origin: string;
  readonly releaseId: string;
  readonly commitSha: string;
  readonly assetCount: number;
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

function normalizeOrigin(value: string): URL {
  const origin = new URL(value);

  invariant(
    (origin.protocol === "https:" || origin.protocol === "http:") &&
      !origin.username &&
      !origin.password &&
      !origin.search &&
      !origin.hash,
    "Deployment readiness requires an HTTP(S) application base without credentials, a query, or a fragment.",
  );

  if (!origin.pathname.endsWith("/")) {
    origin.pathname = `${origin.pathname}/`;
  }

  return origin;
}

function normalizeExpectedCommitSha(value: string): string {
  const expectedCommitSha = value.trim().toLowerCase();

  invariant(
    /^[a-f0-9]{7,64}$/.test(expectedCommitSha),
    "Deployment readiness requires a 7-64 character hexadecimal expected commit SHA.",
  );

  return expectedCommitSha;
}

function requestUrl(url: URL, token: string): URL {
  const requested = new URL(url);
  requested.searchParams.set("__teamlab_readiness", token);
  return requested;
}

async function fetchAvailableResponse(
  fetchImplementation: typeof fetch,
  url: URL,
  requestTimeoutMs: number,
): Promise<Response> {
  const response = await fetchImplementation(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  invariant(
    response.ok,
    `${url.pathname} returned HTTP ${response.status}.`,
  );

  return response;
}

function deploymentAssetUrls(indexHtml: string, indexUrl: URL): URL[] {
  const references = [
    ...indexHtml.matchAll(/\b(?:src|href)=["']([^"']+)["']/gu),
  ].map((match) => match[1]);
  const assets = references
    .filter((reference): reference is string => Boolean(reference))
    .map((reference) => new URL(reference, indexUrl))
    .filter((url) => url.origin === indexUrl.origin);
  const uniqueAssets = [
    ...new Map(assets.map((url) => [url.href, url])).values(),
  ];

  invariant(
    uniqueAssets.some((url) => url.pathname.endsWith(".js")),
    "Deployment index did not reference a JavaScript entry point.",
  );
  invariant(
    uniqueAssets.some((url) => url.pathname.endsWith(".css")),
    "Deployment index did not reference a stylesheet.",
  );

  return uniqueAssets;
}

export async function checkDeploymentReadiness(
  options: DeploymentReadinessOptions,
  attempt = 1,
): Promise<DeploymentAttemptResult> {
  const origin = normalizeOrigin(options.origin);
  const expectedCommitSha = normalizeExpectedCommitSha(
    options.expectedCommitSha,
  );
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const token = `${Date.now()}-${attempt}`;
  const releaseUrl = requestUrl(new URL("release.json", origin), token);
  const releaseResponse = await fetchAvailableResponse(
    fetchImplementation,
    releaseUrl,
    requestTimeoutMs,
  );
  const release = await releaseResponse.json() as DeploymentReleaseMetadata;
  const commitSha = release.source?.commitSha?.toLowerCase() ?? "";

  invariant(
    release.formatVersion === 1 &&
      Boolean(release.releaseId) &&
      release.target === "public" &&
      release.capabilities?.diagnostics === false &&
      /^[a-f0-9]{7,64}$/.test(commitSha),
    `Deployment release metadata is incomplete: ${JSON.stringify(release)}.`,
  );
  invariant(
    commitSha.startsWith(expectedCommitSha),
    `Deployment commit mismatch: expected ${expectedCommitSha}, received ${commitSha || "missing"}.`,
  );

  const indexUrl = requestUrl(origin, token);
  const indexResponse = await fetchAvailableResponse(
    fetchImplementation,
    indexUrl,
    requestTimeoutMs,
  );
  const indexHtml = await indexResponse.text();

  invariant(
    indexHtml.includes('<div id="root"></div>'),
    "Deployment index did not contain the TeamLab application entry point.",
  );

  const assets = deploymentAssetUrls(indexHtml, indexUrl);
  await Promise.all(
    assets.map(async (asset) => {
      const response = await fetchAvailableResponse(
        fetchImplementation,
        requestUrl(asset, token),
        requestTimeoutMs,
      );
      const contents = await response.arrayBuffer();
      invariant(
        contents.byteLength > 0,
        `${asset.pathname} returned an empty response.`,
      );
    }),
  );

  return {
    origin: origin.href,
    releaseId: release.releaseId!,
    commitSha,
    assetCount: assets.length,
  };
}

export async function waitForDeploymentReadiness(
  options: DeploymentReadinessOptions,
): Promise<DeploymentReadiness> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  let lastFailure = "No readiness request was attempted.";

  while (Date.now() < deadline) {
    attempt += 1;

    try {
      const ready = await checkDeploymentReadiness(options, attempt);
      return {
        ...ready,
        attempts: attempt,
      };
    } catch (error) {
      lastFailure =
        error instanceof Error ? error.message : String(error);
      options.onRetry?.(
        `attempt ${attempt} was not ready: ${lastFailure}`,
      );
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    const backoffMs = Math.min(
      retryDelayMs * 2 ** (attempt - 1),
      MAX_RETRY_DELAY_MS,
      remainingMs,
    );
    await delay(backoffMs);
  }

  throw new Error(
    `Deployment did not become ready within ${timeoutMs} ms after ${attempt} attempts. Last check: ${lastFailure}`,
  );
}
