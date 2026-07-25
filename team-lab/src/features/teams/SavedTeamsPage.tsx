import { Link } from "react-router-dom";

import { resolveSavedTeam } from "@/domain/teams/resolution";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import {
  useDeleteSavedTeam,
  useSavedTeamList,
} from "@/features/teams/savedTeamQueries";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load saved teams.";
}

export function SavedTeamsPage() {
  const teamsResult = useSavedTeamList();
  const inventoryResult = useInventoryList();
  const catalogResult = usePokemonCatalog();
  const deleteMutation = useDeleteSavedTeam();

  if (
    teamsResult.isPending ||
    inventoryResult.isPending ||
    catalogResult.isLoading
  ) {
    return <main className="teams-page">Loading saved teams…</main>;
  }

  const error =
    teamsResult.error ??
    inventoryResult.error ??
    catalogResult.error ??
    deleteMutation.error;

  if (
    !teamsResult.data ||
    !inventoryResult.data ||
    !catalogResult.data
  ) {
    return (
      <main className="teams-page">
        <Link to="/">← Home</Link>
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      </main>
    );
  }
  const teams = teamsResult.data;
  const inventory = inventoryResult.data;
  const catalog = catalogResult.data;

  const resolvedTeams = teams.map((team) =>
    resolveSavedTeam(team, inventory, catalog.entries),
  );

  return (
    <main className="teams-page">
      <header className="inventory-header">
        <div>
          <Link to="/">← Home</Link>
          <p className="eyebrow">Open Great League</p>
          <h1>Saved teams</h1>
          <p>
            Build ordered teams from your exact inventory. Lead, safe switch,
            and closer positions remain explicit.
          </p>
          <Link className="primary-link" to="/teams/new">
            Create team
          </Link>
        </div>
        <div className="catalog-summary">
          <strong>{resolvedTeams.length}</strong>
          <span>teams saved locally</span>
          <small>References live inventory builds</small>
        </div>
      </header>

      {error ? (
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      ) : null}

      <section className="team-grid" aria-label="Saved teams">
        {resolvedTeams.map(({ team, members, isComplete }) => (
          <article className="team-card" key={team.teamId}>
            <div className="team-card__heading">
              <div>
                <p className="eyebrow">
                  {isComplete ? "Ready to analyze" : "Needs attention"}
                </p>
                <h2>{team.name}</h2>
              </div>
              <span className="rank-badge">Great League</span>
            </div>
            <ol className="team-members">
              {members.map((member) => (
                <li key={member.position}>
                  <span>{member.position.replace("-", " ")}</span>
                  {member.status === "resolved" ? (
                    <strong>
                      {member.pokemon.speciesName}
                      {member.inventory.buildStatus === "planned"
                        ? " · planned"
                        : ""}
                    </strong>
                  ) : (
                    <strong className="invalid-value">
                      {member.status === "missing-inventory"
                        ? "Inventory record deleted or unavailable"
                        : "Species unavailable in current catalog"}
                    </strong>
                  )}
                </li>
              ))}
            </ol>
            {team.notes ? <p className="inventory-notes">{team.notes}</p> : null}
            <small>
              Updated {new Date(team.updatedAt).toLocaleString()}
              {team.lastAnalyzedDataVersion
                ? ` · analyzed with ${team.lastAnalyzedDataVersion}`
                : " · not yet analyzed"}
            </small>
            <div className="inventory-card__actions">
              <Link className="primary-link" to={`/teams/${team.teamId}`}>
                {isComplete ? "Edit team" : "Repair team"}
              </Link>
              {isComplete ? (
                <Link
                  className="secondary-link"
                  to={`/teams/${team.teamId}/simulation`}
                >
                  Simulate
                </Link>
              ) : null}
              <Link
                className="secondary-link"
                to={`/teams/new?duplicate=${team.teamId}`}
              >
                Duplicate
              </Link>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete saved team “${team.name}”?`)) {
                    deleteMutation.mutate(team.teamId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>

      {resolvedTeams.length === 0 ? (
        <p className="catalog-empty">
          No saved teams yet. Create one from three inventory Pokémon.
        </p>
      ) : null}
    </main>
  );
}
