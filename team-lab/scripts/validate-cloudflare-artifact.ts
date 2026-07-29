import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const outputArgument = process.argv[2];

if (!outputArgument) {
  throw new Error(
    "Usage: validate-cloudflare-artifact.ts <output-directory>",
  );
}

const outputDirectory = resolve(outputArgument);
const indexHtml = await readFile(
  resolve(outputDirectory, "index.html"),
  "utf8",
);
const headersPolicy = await readFile(
  resolve(outputDirectory, "_headers"),
  "utf8",
);

if (!indexHtml.includes('<div id="root"></div>')) {
  throw new Error(
    `${outputDirectory} does not contain the TeamLab application entry point.`,
  );
}

const requiredHeaderPolicyFragments = [
  "Content-Security-Policy:",
  "default-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "Cross-Origin-Opener-Policy: same-origin",
  "Cross-Origin-Resource-Policy: same-origin",
  "Permissions-Policy:",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Strict-Transport-Security: max-age=31536000",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "X-Permitted-Cross-Domain-Policies: none",
  "https://pvpoke-team-lab.pages.dev/*",
  "https://:deployment.pvpoke-team-lab.pages.dev/*",
  "X-Robots-Tag: noindex",
];
const missingHeaderPolicyFragments = requiredHeaderPolicyFragments.filter(
  (fragment) => !headersPolicy.includes(fragment),
);

if (missingHeaderPolicyFragments.length > 0) {
  throw new Error(
    `The Cloudflare Pages security policy is incomplete: ${missingHeaderPolicyFragments.join(", ")}.`,
  );
}

if (
  headersPolicy.includes("script-src 'self' 'unsafe-inline'") ||
  headersPolicy.includes("'unsafe-eval'")
) {
  throw new Error(
    "The Cloudflare Pages script policy must not permit inline or evaluated scripts.",
  );
}

const entries = await readdir(outputDirectory, {
  recursive: true,
  withFileTypes: true,
});
const files = entries.filter((entry) => entry.isFile());

if (files.length > MAX_FILES) {
  throw new Error(
    `The Cloudflare Pages artifact has ${files.length} files; the limit is ${MAX_FILES}.`,
  );
}

const fileSizes = await Promise.all(
  files.map(async (file) => {
    const path = resolve(file.parentPath, file.name);
    return {
      path,
      size: (await stat(path)).size,
    };
  }),
);
const oversizedFiles = fileSizes.filter(
  (file) => file.size > MAX_FILE_BYTES,
);

if (oversizedFiles.length > 0) {
  throw new Error(
    `Cloudflare Pages rejects files larger than 25 MiB: ${oversizedFiles.map((file) => file.path).join(", ")}.`,
  );
}

const forbiddenStaticFiles = ["404.html", "_worker.js", "_routes.json"].filter(
  (fileName) => files.some(
    (file) =>
      file.parentPath === outputDirectory && file.name === fileName,
  ),
);

if (forbiddenStaticFiles.length > 0) {
  throw new Error(
    `The static-only Cloudflare artifact contains reserved provider files: ${forbiddenStaticFiles.join(", ")}.`,
  );
}

const largestFile = fileSizes.reduce(
  (largest, file) => file.size > largest.size ? file : largest,
  { path: "", size: 0 },
);

process.stdout.write(
  `Cloudflare Pages artifact check passed: ${files.length} files; largest ${largestFile.size} bytes; security headers enforced; SPA fallback delegated to Pages; no Functions entry point.\n`,
);
