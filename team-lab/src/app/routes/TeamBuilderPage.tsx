import { Link } from "react-router";

import { PageHeader } from "@/components/PageHeader";

export function TeamBuilderPage() {
  return (
    <main className="catalog-page">
      <PageHeader
        eyebrow="Your roster. Your battle plan."
        title="Pokémon GO PvP Team Builder"
        description={<p>Build a lineup around Pokémon you actually own. TeamLab
          brings your exact builds, league rankings, and matchup analysis together
          so you can compare team options beyond theoretical meta teams.</p>}
        actions={<>
          <Link className="primary-link" to="/inventory/new">Start Building a Team</Link>
          <Link className="secondary-link" to="/recommend">Find teams from your saved roster</Link>
        </>}
      />
      <section className="data-card seo-content">
        <h2>Build teams from your own Pokémon</h2>
        <p>A species ranking is only a starting point. Your Pokémon’s CP, IVs,
          and moves affect the build you can bring to battle. Record those details
          in TeamLab, choose an anchor, and explore recommended lineups from your
          inventory. You can also assemble and save a team manually.</p>
        <div className="seo-content__grid">
          <div><h3>Great League team building</h3>
            <p>Plan within the 1,500 CP limit. Compare your eligible builds with
              Great League rankings and examine how teammates cover matchups.</p></div>
          <div><h3>Ultra League team building</h3>
            <p>Switch to Ultra League to plan teams up to 2,500 CP. Review your
              available Pokémon and planned builds against this league’s meta.</p></div>
          <div><h3>Master League team building</h3>
            <p>Explore the uncapped format with Master League rankings. Keep track
              of your Pokémon’s actual builds as you plan upgrades and lineups.</p></div>
        </div>
      </section>
      <section className="data-card seo-content">
        <h2>Use PvPoke rankings and battle data</h2>
        <p>TeamLab bundles PvPoke data for its rankings, recommended moves, and
          simulation foundations. Check the catalog’s update date for the data
          available in this release. Team analysis helps you compare matchups;
          it does not guarantee results in live battles.</p>
        <p><Link className="text-link" to="/catalog">Explore Pokémon GO PvP rankings and moves</Link></p>
        <h2>Plan your PvP roster</h2>
        <p>Keep current and planned Pokémon builds together, review build
          information, and save teams in lead, safe switch, and closer order.
          Your inventory and saved teams stay in this browser; use backups to
          keep a copy or transfer them to another device.</p>
      </section>
      <section className="data-card seo-content">
        <h2>How TeamLab works</h2>
        <ol>
          <li>Select Great League, Ultra League, or Master League.</li>
          <li>Add your Pokémon with their CP, IVs, and moves.</li>
          <li>Choose an anchor for recommendations or build a team manually.</li>
          <li>Review team matchups and save the lineup you want to try.</li>
        </ol>
        <p><Link className="primary-link" to="/inventory/new">Add your first Pokémon</Link></p>
      </section>
    </main>
  );
}
