import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import { CatalogIntroduction, HomeIntroduction, HomeOverview } from "@/app/routes/PublicContent";
import { TeamBuilderPage } from "@/app/routes/TeamBuilderPage";

// Render only shared public copy. Browser storage and interactive data stay in
// the client app, which replaces this initial content when it starts.
export function renderPublicPage(pathname: string, basename: string) {
  return renderToString(
    <StaticRouter location={`${basename.replace(/\/$/, "")}${pathname}`} basename={basename}>
      {pathname === "/team-builder" ? <TeamBuilderPage /> : pathname === "/catalog" ? (
        <main className="catalog-page">
          <PageHeader eyebrow="Pokémon catalog" title="Pokémon GO PvP Rankings" description={<CatalogIntroduction />} />
        </main>
      ) : (
        <main className="dashboard-page">
          <section className="dashboard-hero"><div className="dashboard-hero__copy"><HomeIntroduction /></div></section>
          <HomeOverview />
        </main>
      )}
    </StaticRouter>,
  );
}
