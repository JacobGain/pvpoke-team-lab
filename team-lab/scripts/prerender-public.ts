import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

import { publicSeo } from "../src/app/seo.ts";

const output = resolve(process.argv[2] ?? "dist");
const template = await readFile(resolve(output, "index.html"), "utf8");
const server = await createServer({ server: { middlewareMode: true, ws: false, hmr: false }, appType: "custom" });
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

try {
  const { renderPublicPage } = await server.ssrLoadModule("/src/app/prerender.tsx") as {
    renderPublicPage: (pathname: string, basename: string) => string;
  };
  for (const [pathname, filename, seo] of [
    ["/", "index.html", publicSeo.home],
    ["/team-builder", "team-builder.html", publicSeo.teamBuilder],
    ["/catalog", "catalog.html", publicSeo.rankings],
  ] as const) {
    let html = template.replace('<div id="root"></div>', `<div id="root">${renderPublicPage(pathname, server.config.base)}</div>`);
    const canonical = `https://pogoteamlab.com${pathname}`;
    html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`);
    html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`);
    // Preserve the already-working homepage title, description and social copy.
    if (pathname !== "/") {
      html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(seo.title)}</title>`);
      for (const [attribute, name, value] of [
        ["name", "description", seo.description],
        ["property", "og:title", seo.title],
        ["property", "og:description", seo.description],
        ["name", "twitter:title", seo.title],
        ["name", "twitter:description", seo.description],
      ]) {
        html = html.replace(new RegExp(`<meta\\s+${attribute}="${name}"[^>]*>`), `<meta ${attribute}="${name}" content="${escapeHtml(value)}" />`);
      }
    }
    await writeFile(resolve(output, filename), html);
    process.stdout.write(`Rendered public content: ${pathname}\n`);
  }
} finally {
  await server.close();
}
