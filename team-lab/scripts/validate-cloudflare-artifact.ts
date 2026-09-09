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
const [indexHtml, headersPolicy, robotsText, sitemapXml, securityText] = await Promise.all([
  readFile(resolve(outputDirectory, "index.html"), "utf8"),
  readFile(resolve(outputDirectory, "_headers"), "utf8"),
  readFile(resolve(outputDirectory, "robots.txt"), "utf8"),
  readFile(resolve(outputDirectory, "sitemap.xml"), "utf8"),
  readFile(resolve(outputDirectory, ".well-known/security.txt"), "utf8"),
]);

if (!indexHtml.includes('<div id="root"></div>')) {
  throw new Error(
    `${outputDirectory} does not contain the TeamLab application entry point.`,
  );
}

const requiredSeoFragments = [
  "Pokémon GO PvP Team Builder &amp; Roster Planner | TeamLab",
  'name="description"',
  'meta name="robots" content="index, follow"',
  'property="og:title"',
  'name="twitter:card"',
  'rel="icon"',
  'type="image/webp"',
];
const missingSeoFragments = requiredSeoFragments.filter(
  (fragment) => !indexHtml.includes(fragment),
);
if (missingSeoFragments.length > 0) {
  throw new Error(
    `The application entry point is missing SEO metadata: ${missingSeoFragments.join(", ")}.`,
  );
}

if (
  !robotsText.includes("Sitemap: https://pogoteamlab.com/sitemap.xml") ||
  !robotsText.includes("Disallow: /diagnostics") ||
  !robotsText.includes("Disallow: /inventory") ||
  !robotsText.includes("Disallow: /recommend") ||
  !robotsText.includes("Disallow: /teams") ||
  !sitemapXml.includes("https://pogoteamlab.com/") ||
  !sitemapXml.includes("https://pogoteamlab.com/catalog")
) {
  throw new Error("The production robots.txt or sitemap.xml is incomplete.");
}

const requiredSecurityTextFragments = [
  "Contact: https://github.com/JacobGain/pvpoke-team-lab/security/advisories/new",
  "Preferred-Languages: en",
  "Canonical: https://pogoteamlab.com/.well-known/security.txt",
  "Policy: https://github.com/JacobGain/pvpoke-team-lab/security/policy",
];
const missingSecurityTextFragments = requiredSecurityTextFragments.filter(
  (fragment) => !securityText.includes(fragment),
);
const expiresMatch = securityText.match(/^Expires: (.+)$/m);
const expiresAt = Date.parse(expiresMatch?.[1] ?? "");
const minimumExpiry = Date.now() + 30 * 24 * 60 * 60 * 1_000;
const maximumExpiry = Date.now() + 366 * 24 * 60 * 60 * 1_000;

if (
  missingSecurityTextFragments.length > 0 ||
  !Number.isFinite(expiresAt) ||
  expiresAt < minimumExpiry ||
  expiresAt > maximumExpiry
) {
  throw new Error(
    "The RFC 9116 security.txt contact, policy, canonical URL, or expiration is invalid.",
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
  "/.well-known/security.txt",
  "Content-Type: text/plain; charset=utf-8",
  "/vendor/pvpoke/data/*",
  "Cache-Control: public, max-age=31536000, immutable",
  "https://pvpoke-team-lab.pages.dev/*",
  "https://:deployment.pvpoke-team-lab.pages.dev/*",
  "X-Robots-Tag: noindex",
  "/inventory*",
  "/teams*",
  "/recommend*",
  "/diagnostics*",
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

const nonWebpRasterImages = files.filter((file) =>
  /\.(?:avif|gif|jpe?g|png)$/i.test(file.name),
);
if (nonWebpRasterImages.length > 0) {
  throw new Error(
    `The production artifact contains raster images that are not WebP: ${nonWebpRasterImages.map((file) => resolve(file.parentPath, file.name)).join(", ")}.`,
  );
}

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
