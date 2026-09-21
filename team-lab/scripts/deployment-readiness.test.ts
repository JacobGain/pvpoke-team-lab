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

function readyFetch(indexHtml = INDEX_HTML): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );

    if (url.pathname === "/release.json") {
      return Promise.resolve(releaseResponse());
    }
    if (url.pathname === "/") {
      return Promise.resolve(
        new Response(indexHtml, {
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

function indexableFetch(xRobotsTag?: string): typeof fetch {
  return vi.fn((input: string | URL | Request) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (url.protocol === "http:") {
      return Promise.resolve(new Response(null, {
        status: 301,
        headers: { location: ORIGIN },
      }));
    }
    if (url.pathname === "/release.json") {
      return Promise.resolve(releaseResponse());
    }
    if (url.pathname.startsWith("/assets/")) {
      return Promise.resolve(new Response("asset contents"));
    }
    if (url.pathname === "/robots.txt") {
      return Promise.resolve(new Response(
        `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}sitemap.xml\n`,
      ));
    }
    if (url.pathname === "/sitemap.xml") {
      return Promise.resolve(new Response(
        ["/", "/catalog", "/team-builder"]
          .map((pathname) => `<loc>${new URL(pathname, ORIGIN).href}</loc>`)
          .join("\n"),
      ));
    }
    if (["/", "/catalog", "/team-builder"].includes(url.pathname)) {
      const canonical = new URL(url.pathname, ORIGIN).href;
      return Promise.resolve(new Response(
        INDEX_HTML
          .replace("<head>", `<head><link rel="canonical" href="${canonical}"><meta name="robots" content="index, follow">`)
          .replace('<div id="root"></div>', '<div id="root"><main><h1>TeamLab</h1></main></div>'),
        { headers: xRobotsTag ? { "x-robots-tag": xRobotsTag } : undefined },
      ));
    }
    return Promise.resolve(new Response("missing", { status: 404 }));
  });
}

describe("deployment readiness", () => {
  it("fails immediately on an interactive challenge instead of retrying for two minutes", async () => {
    const fetchImplementation = vi.fn(() => Promise.resolve(new Response("challenge", {
      status: 403,
      headers: { "cf-mitigated": "challenge", "cf-ray": "blocked-YYZ" },
    })));
    const onRetry = vi.fn();
    await expect(waitForDeploymentReadiness({
      origin: ORIGIN, expectedCommitSha: COMMIT_SHA, fetchImplementation, onRetry,
      timeoutMs: 100, retryDelayMs: 0,
    })).rejects.toThrow("Inspect this Ray ID in Cloudflare Security Events");
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("reports Cloudflare denial details for a blocked release request", async () => {
    const fetchImplementation = vi.fn(() => Promise.resolve(new Response("blocked", {
      status: 403,
      headers: {
        "cf-ray": "abc123-YYZ",
        "cf-mitigated": "challenge",
      },
    })));

    await expect(checkDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      fetchImplementation,
    })).rejects.toThrow(
      "/release.json returned HTTP 403; Cloudflare Ray ID abc123-YYZ; Cloudflare mitigation challenge.",
    );
  });

  it("accepts prerendered content inside the application root", async () => {
    const fetchImplementation = readyFetch(
      INDEX_HTML.replace(
        '<div id="root"></div>',
        '<div id="root"><main><h1>Pokémon GO PvP Team Builder</h1></main></div>',
      ),
    );

    const result = await checkDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      fetchImplementation,
    });

    expect(result.assetCount).toBe(2);
    expect(fetchImplementation).toHaveBeenCalledTimes(4);
  });

  it("rejects an index without the application root", async () => {
    const fetchImplementation = readyFetch(
      INDEX_HTML.replace('<div id="root"></div>', '<main>Unavailable</main>'),
    );

    await expect(
      checkDeploymentReadiness({
        origin: ORIGIN,
        expectedCommitSha: COMMIT_SHA,
        fetchImplementation,
      }),
    ).rejects.toThrow("Deployment index did not contain the TeamLab application entry point.");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

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

  it("verifies the canonical origin's redirect and search discovery contract", async () => {
    const fetchImplementation = indexableFetch();
    const result = await checkDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      requireIndexablePublicPages: true,
      fetchImplementation,
    });

    expect(result.commitSha).toBe(COMMIT_SHA);
    expect(fetchImplementation).toHaveBeenCalledWith(
      new URL("http://deployment.example/"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects a noindex header on canonical public pages", async () => {
    await expect(checkDeploymentReadiness({
      origin: ORIGIN,
      expectedCommitSha: COMMIT_SHA,
      requireIndexablePublicPages: true,
      fetchImplementation: indexableFetch("noindex"),
    })).rejects.toThrow("conflicting X-Robots-Tag: noindex");
  });
});
