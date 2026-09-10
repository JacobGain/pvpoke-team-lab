import { Link } from "react-router";

export function HomeIntroduction() {
  return (
    <>
      <h1>Pokémon GO PvP Team Builder <span>for Your Own Roster</span></h1>
      <p>
        Build Great League, Ultra League, and Master League teams from the Pokémon
        you actually own. TeamLab uses bundled PvPoke rankings and battle data to
        analyze your builds and help you plan teams.
      </p>
    </>
  );
}

export function HomeOverview() {
  return (
    <section className="data-card seo-content" aria-labelledby="roster-team-building">
      <h2 id="roster-team-building">Turn your Pokémon GO roster into PvP teams</h2>
      <p>
        Global rankings show how Pokémon compare in the meta. TeamLab connects
        that information to your own collection: record CP, IVs, and moves,
        distinguish ready Pokémon from planned builds, and save ordered teams.
      </p>
      <div className="seo-content__grid">
        <div>
          <h3>Plan for all three leagues</h3>
          <p>Explore Great League, Ultra League, and Master League rankings,
            then review the builds you have available for your chosen format.</p>
        </div>
        <div>
          <h3>Compare moves and team options</h3>
          <p>Use PvPoke-derived moves, rankings, and battle simulations to examine
            your roster. Choose an anchor Pokémon to explore team recommendations
            and review matchups before saving a lineup.</p>
        </div>
      </div>
      <p><Link className="text-link" to="/team-builder">Explore the Pokémon GO PvP Team Builder</Link>
        {" · "}<Link className="text-link" to="/catalog">Browse PvP rankings and Pokémon builds</Link></p>
    </section>
  );
}

export function CatalogIntroduction() {
  return (
    <p>
      Explore Pokémon GO PvP rankings, recommended moves, and builds for Great,
      Ultra, and Master League using bundled PvPoke data. Use the{" "}
      <Link className="text-link" to="/team-builder">Pokémon GO PvP Team Builder</Link>
      {" "}to turn your own roster into team options.
    </p>
  );
}
