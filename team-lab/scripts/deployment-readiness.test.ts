import { describe, expect, it, vi } from "vitest";

import {
  checkDeploymentReadiness,
  waitForDeploymentReadiness,
} from "./deployment-readiness.ts";

const ORIGIN = "https://deployment.example/";
const COMMIT_SHA = "a".repeat(40);
const INDEX_HTML = `<!doctype html>
<html>
  <head>
    <script type="module" src="/assets/index-123.js"></script>
    <link rel="stylesheet" href="/assets/index-123.css">
  </head>
  <body><div id="root"></div></body>
</html>`;

function releaseResponse(commitSha = COMMIT_SHA): Response {
  return Response.json({
    formatVersion: 1,
    releaseId: "0.0.4-public-aaaaaaaaaaaa-data",
    target: "public",
    source: {
      commitSha,
    },
    capabilities: {
      diagnostics: false,
    },
  });
}

function readyFetch(): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.pathname === "/release.json") {
      return Promise.resolve(releaseResponse());
    }
    if (url.pathname === "/") {
      return Promise.resolve(
        new Response(INDEX_HTML, {
          headers: { "content-type": "text/html" },
        }),
      );
    }
    if (url.pathname.startsWith("/assets/")) {
      return Promise.resolve(new Response("asset contents"));
    }

    return Promise.resolve(new Response("missing", { status: 404 }));
  });
}

describe("deployment readiness", () => {
  it("requires the expected public release and every index asset", async () => {
    const fetchImplementation = readyFetch();
    const result = await checkDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      fetchImplementation,
    });

    expect(result).toEqual({
      origin: ORIGIN,
      releaseId: "0.0.4-public-aaaaaaaaaaaa-data",
      commitSha: COMMIT_SHA,
      assetCount: 2,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it("retries a stale deployment until the expected commit is ready", async () => {
    const retryMessages: string[] = [];
    let releaseRequests = 0;
    const fetchImplementation = vi.fn(
      (input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );

        if (url.pathname === "/release.json") {
          releaseRequests += 1;
          return Promise.resolve(
            releaseResponse(
              releaseRequests === 1 ? "b".repeat(40) : COMMIT_SHA,
            ),
          );
        }
        if (url.pathname === "/") {
          return Promise.resolve(new Response(INDEX_HTML));
        }
        return Promise.resolve(new Response("asset contents"));
      },
    );

    const result = await waitForDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      timeoutMs: 1_000,
      retryDelayMs: 0,
      fetchImplementation,
      onRetry: (message) => retryMessages.push(message),
    });

    expect(result.attempts).toBe(2);
    expect(retryMessages).toEqual([
      expect.stringContaining("Deployment commit mismatch"),
    ]);
  });

  it("rejects an index whose referenced assets are unavailable", async () => {
    const fetchImplementation = readyFetch();
    vi.mocked(fetchImplementation).mockImplementation(
      (input: string | URL | Request) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
        );

        if (url.pathname === "/release.json") {
          return Promise.resolve(releaseResponse());
        }
        if (url.pathname === "/") {
          return Promise.resolve(new Response(INDEX_HTML));
        }
        if (url.pathname.endsWith(".js")) {
          return Promise.resolve(
            new Response("missing", { status: 404 }),
          );
        }
        return Promise.resolve(new Response("asset contents"));
      },
    );

    await expect(
      checkDeploymentReadiness({
        origin: ORIGIN,
        expectedCommitSha: COMMIT_SHA,
        fetchImplementation,
      }),
    ).rejects.toThrow("/assets/index-123.js returned HTTP 404");
  });
});
