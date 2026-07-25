import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  META_TARGET_LIMITS,
  prepareSavedTeamRankerRequest,
  SavedTeamRankingService,
  type MetaTargetLimit,
  type SavedTeamRankerRun,
} from "@/domain/simulation/savedTeamRanking";
import type { ShieldCount } from "@/domain/simulation/contracts";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useSavedTeam } from "@/features/teams/savedTeamQueries";
import { createPvpokeTeamRankerAdapter } from "@/pvpoke/simulation";

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not rank this saved team.";
}

export function SavedTeamSimulationPage() {
  const { teamId } = useParams();
  const teamResult = useSavedTeam(teamId);
  const inventoryResult = useInventoryList();
  const catalogResult = usePokemonCatalog();
  const [targetLimit, setTargetLimit] = useState<MetaTargetLimit>(5);
  const [teamShields, setTeamShields] = useState<ShieldCount>(1);
  const [targetShields, setTargetShields] = useState<ShieldCount>(1);
  const [run, setRun] = useState<SavedTeamRankerRun>();
  const [runError, setRunError] = useState<unknown>();
  const [running, setRunning] = useState(false);
  const service = useMemo(
    () =>
      catalogResult.data
        ? new SavedTeamRankingService(
            createPvpokeTeamRankerAdapter(catalogResult.data.dataVersion),
          )
        : undefined,
    [catalogResult.data],
  );

  if (
    teamResult.isPending ||
    inventoryResult.isPending ||
    catalogResult.isLoading
  ) {
    return <main className="diagnostics-page">Preparing saved team…</main>;
  }

  const loadingError =
    teamResult.error ?? inventoryResult.error ?? catalogResult.error;

  if (
    !teamResult.data ||
    !inventoryResult.data ||
    !catalogResult.data ||
    !service
  ) {
    return (
      <main className="diagnostics-page">
        <Link to="/teams">← Saved teams</Link>
        <p className="inventory-error" role="alert">
          {loadingError
            ? formatError(loadingError)
            : "Saved team could not be found."}
        </p>
      </main>
    );
  }

  const team = teamResult.data;
  const inventory = inventoryResult.data;
  const catalog = catalogResult.data;
  const rankingService = service;

  async function runRanking() {
    setRunning(true);
    setRun(undefined);
    setRunError(undefined);

    try {
      const prepared = prepareSavedTeamRankerRequest(
        team,
        inventory,
        catalog,
        { targetLimit, teamShields, targetShields },
      );
      setRun(await rankingService.rank(prepared));
    } catch (error) {
      setRunError(error);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="diagnostics-page">
      <header className="form-page-header">
        <Link to="/teams">← Saved teams</Link>
        <p className="eyebrow">Phase 5 engine evidence</p>
        <h1>{team.name}</h1>
        <p>
          Rank this exact ordered team against explicit PvPoke Open Great
          League meta targets. This is a raw matrix view, not the Phase 6
          scorecard.
        </p>
      </header>

      <section className="form-section simulation-controls">
        <label className="form-field">
          <span>Meta target count</span>
          <select
            value={targetLimit}
            onChange={(event) =>
              setTargetLimit(Number(event.target.value) as MetaTargetLimit)
            }
          >
            {META_TARGET_LIMITS.map((limit) => (
              <option value={limit} key={limit}>
                Top {limit}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Your shields</span>
          <select
            value={teamShields}
            onChange={(event) =>
              setTeamShields(Number(event.target.value) as ShieldCount)
            }
          >
            <option value={0}>0 shields</option>
            <option value={1}>1 shield</option>
            <option value={2}>2 shields</option>
          </select>
        </label>
        <label className="form-field">
          <span>Opponent shields</span>
          <select
            value={targetShields}
            onChange={(event) =>
              setTargetShields(Number(event.target.value) as ShieldCount)
            }
          >
            <option value={0}>0 shields</option>
            <option value={1}>1 shield</option>
            <option value={2}>2 shields</option>
          </select>
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={running}
          onClick={() => void runRanking()}
        >
          {running
            ? `Simulating ${targetLimit * 3} battles…`
            : "Run exact team matrix"}
        </button>
      </section>

      {targetLimit >= 20 ? (
        <p className="analysis-notice">
          Larger scopes run synchronously in the upstream browser engine and
          may temporarily make this tab unresponsive.
        </p>
      ) : null}

      {runError ? (
        <p className="inventory-error" role="alert">
          {formatError(runError)}
        </p>
      ) : null}

      {run ? (
        <>
          <section className="diagnostics-banner diagnostics-banner--pass">
            <div>
              <p className="eyebrow">Measured matrix</p>
              <h2>{run.performance.replaceAll("-", " ")}</h2>
              <p>
                {run.result.battleCount} battles ·{" "}
                {Math.round(run.durationMs)} ms ·{" "}
                {run.scope.selectedTargetCount} of{" "}
                {run.scope.availableTargetCount} simulation-ready meta targets
                · data {run.result.dataVersion}
              </p>
            </div>
          </section>

          <section className="diagnostics-grid">
            {run.result.rankings.map((ranking) => (
              <article className="team-card" key={ranking.speciesId}>
                <div className="team-card__heading">
                  <div>
                    <p className="eyebrow">Meta target</p>
                    <h2>{ranking.speciesName}</h2>
                  </div>
                  <span className="rank-badge">
                    {ranking.averageRating}
                  </span>
                </div>
                <dl className="analysis-detail-list">
                  {ranking.matchups.map((matchup, index) => (
                    <div key={`${matchup.opponentSpeciesId}-${index}`}>
                      <dt>
                        vs. {matchup.opponentSpeciesId} · team slot {index + 1}
                      </dt>
                      <dd>
                        Rating {matchup.rating} · fast damage{" "}
                        {matchup.fastMoveDamage}/{matchup.incomingFastMoveDamage}
                        {" · "}Attack Δ{" "}
                        {matchup.attackDifferential.toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>

          <aside className="analysis-scope">
            <strong>Scope and assumptions</strong>
            <p>{run.result.assumptions.join(" · ")}</p>
          </aside>
        </>
      ) : null}
    </main>
  );
}
