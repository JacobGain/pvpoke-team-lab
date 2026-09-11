# Public SEO pages

The public build (`npm run build`) renders shared React landing-page content to
`dist/index.html`, `dist/team-builder.html`, and `dist/catalog.html`. Cloudflare
Pages serves the latter files at their extensionless URLs. No 404.html or
catch-all redirect is added, so other routes retain the Pages SPA fallback.

`src/app/routes/PublicContent.tsx` supplies the homepage introduction, overview,
and catalog introduction to both the browser app and the build-time renderer.
The team-builder page uses the same component in both environments. Metadata is
shared through `src/app/seo.ts`; the existing homepage metadata in `index.html`
is preserved. The artifact validator checks initial content, canonicals, social
URLs, sitemap entries, and referenced static assets.

This is public-content prerendering, not full application SSR or hydration.
The existing client root replaces the static content after browser storage opens.
Personal dashboards, catalog tables, and simulations remain client-rendered.
The catalog's initial HTML explains the catalog; it does not contain rankings.
The admin build remains client-rendered. No new dependency or server is needed.

Robots and HTTP noindex rules continue excluding inventory, teams,
recommendations, and diagnostics. The sitemap lists only the three public pages.

The existing 48px and 96px PNGs have alpha channels; the ICO includes a 48px
entry. All three production root URLs returned HTTP 200 with image content types
on September 10, 2026. The assets and icon links therefore need no replacement.

After deployment:

1. Verify the three public URLs, favicon URLs, and sitemap on pogoteamlab.com.
2. In Google Search Console URL Inspection, test the live homepage and
   `/team-builder`, then request indexing for each. Check `/catalog` as well.
3. Submit or recheck `https://pogoteamlab.com/sitemap.xml` in Sitemaps.
4. Monitor indexing and search performance. Google controls recrawl timing,
   favicon selection, and rankings; deployment does not guarantee an immediate
   change in search results.
