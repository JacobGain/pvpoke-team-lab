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
import { deriveTeamAlternatives } from "@/domain/teamAnalysis/alternatives";
import { analyzeSavedTeamMatrix } from "@/domain/teamAnalysis/teamAnalysis";

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
  const analysis = useMemo(
    () => (run ? analyzeSavedTeamMatrix(run) : undefined),
    [run],
  );
  const alternatives = useMemo(
    () =>
      analysis && inventoryResult.data && catalogResult.data
        ? deriveTeamAlternatives(
            analysis,
            inventoryResult.data,
            catalogResult.data,
          )
        : undefined,
    [analysis, catalogResult.data, inventoryResult.data],
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

          {analysis ? (
            <>
              <section className="team-scorecard">
                <article>
                  <span>Coverage grade</span>
                  <strong>{analysis.coverage.grade}</strong>
                  <small>
                    {analysis.coverage.coveredTargetPercentage.toFixed(1)}% ·{" "}
                    {analysis.coverage.coveredTargets}/
                    {analysis.coverage.totalTargets} targets covered
                  </small>
                </article>
                <article>
                  <span>Bulk grade</span>
                  <strong>{analysis.bulk.grade}</strong>
                  <small>
                    {analysis.bulk.score.toFixed(1)} ·{" "}
                    {analysis.bulk.evidenceSource.replaceAll("-", " ")}
                  </small>
                </article>
                <article>
                  <span>Safety grade</span>
                  <strong>{analysis.safety.grade}</strong>
                  <small>
                    {analysis.safety.score.toFixed(1)} ·{" "}
                    {analysis.safety.evidenceSource.replaceAll("-", " ")}
                  </small>
                </article>
                <article>
                  <span>Consistency grade</span>
                  <strong>{analysis.consistency.grade}</strong>
                  <small>
                    {analysis.consistency.score.toFixed(1)} ·{" "}
                    {analysis.consistency.evidenceCount}/
                    {analysis.consistency.evidenceTotal} ranked members
                  </small>
                </article>
              </section>

              <section className="analysis-panel">
                <p className="eyebrow">Score evidence</p>
                <h2>How these grades were calculated</h2>
                <dl className="analysis-detail-list">
                  <div>
                    <dt>Coverage</dt>
                    <dd>
                      {analysis.coverage.coveredTargets}/
                      {analysis.coverage.totalTargets} selected targets have at
                      least one favorable team member.
                    </dd>
                  </div>
                  <div>
                    <dt>Bulk · {analysis.bulk.evidenceSource}</dt>
                    <dd>{analysis.bulk.method}</dd>
                  </div>
                  <div>
                    <dt>Safety · {analysis.safety.evidenceSource}</dt>
                    <dd>{analysis.safety.method}</dd>
                  </div>
                  <div>
                    <dt>
                      Consistency · {analysis.consistency.evidenceSource}
                    </dt>
                    <dd>{analysis.consistency.method}</dd>
                  </div>
                </dl>
              </section>

              <section className="analysis-panel">
                <div className="analysis-panel__heading">
                  <div>
                    <p className="eyebrow">Threat evidence</p>
                    <h2>Major threats and core breakers</h2>
                    <p>
                      Targets are ordered by how many team members they beat,
                      then by their average target-side rating.
                    </p>
                  </div>
                  <span className="rank-badge">
                    {analysis.shieldScenario} shields
                  </span>
                </div>
                {analysis.majorThreats.length > 0 ? (
                  <div className="threat-grid">
                    {analysis.majorThreats.map((threat) => (
                      <article key={threat.speciesId}>
                        <p className="eyebrow">
                          {threat.threatLevel.replaceAll("-", " ")}
                        </p>
                        <h3>{threat.speciesName}</h3>
                        <p>
                          Favored against {threat.targetWins}/
                          {threat.matchupRatings.length} members · average
                          target rating {threat.targetAverageRating}
                        </p>
                        <ul>
                          {threat.matchupRatings.map((matchup) => (
                            <li key={matchup.teamSpeciesId}>
                              {matchup.teamSpeciesId}: team rating{" "}
                              {matchup.teamMemberRating}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>
                    No selected target is favored against multiple members or
                    averages above a neutral rating.
                  </p>
                )}
              </section>

              {alternatives ? (
                <section className="analysis-panel">
                  <div className="analysis-panel__heading">
                    <div>
                      <p className="eyebrow">Threat alternatives</p>
                      <h2>Owned and theoretical answers</h2>
                      <p>
                        Candidates follow PvPoke’s published overall-ranking
                        counter evidence. Owned cards reference your exact
                        saved record; unowned cards use PvPoke’s default Great
                        League build.
                      </p>
                    </div>
                    <span className="rank-badge">
                      {alternatives.consideredThreats} threats
                    </span>
                  </div>
                  <p className="analysis-notice">
                    These candidates have not been substituted into this team
                    and resimulated. Their displayed rating is the published
                    counter matchup viewed from the alternative’s side.
                  </p>
                  {alternatives.threats.length > 0 ? (
                    <div className="alternative-threat-list">
                      {alternatives.threats.map((threat) => (
                        <article
                          className="alternative-threat"
                          key={threat.threatSpeciesId}
                        >
                          <div>
                            <p className="eyebrow">
                              {threat.threatLevel.replaceAll("-", " ")}
                            </p>
                            <h3>Answers to {threat.threatSpeciesName}</h3>
                          </div>
                          <div className="alternative-columns">
                            <div>
                              <h4>Owned exact records</h4>
                              {threat.owned.length > 0 ? (
                                <div className="alternative-card-list">
                                  {threat.owned.map((candidate) => (
                                    <Link
                                      className="alternative-card alternative-card--owned"
                                      key={candidate.inventoryId}
                                      to={`/inventory/${candidate.inventoryId}/analysis`}
                                    >
                                      <strong>{candidate.speciesName}</strong>
                                      <span>
                                        {candidate.buildStatus}
                                        {candidate.cp
                                          ? ` · CP ${candidate.cp}`
                                          : ""}
                                      </span>
                                      <small>
                                        Published matchup rating{" "}
                                        {candidate.alternativeRating}
                                      </small>
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <p>No eligible exact owned counter found.</p>
                              )}
                            </div>
                            <div>
                              <h4>Unowned PvPoke defaults</h4>
                              {threat.unowned.length > 0 ? (
                                <div className="alternative-card-list">
                                  {threat.unowned.map((candidate) => (
                                    <article
                                      className="alternative-card alternative-card--unowned"
                                      key={candidate.speciesId}
                                    >
                                      <strong>{candidate.speciesName}</strong>
                                      <span>
                                        Level {candidate.defaultIvs.level} ·{" "}
                                        {candidate.defaultIvs.attack}/
                                        {candidate.defaultIvs.defense}/
                                        {candidate.defaultIvs.hp}
                                      </span>
                                      <small>
                                        {candidate.recommendedMoveIds.join(
                                          " · ",
                                        )}
                                      </small>
                                      <small>
                                        Published matchup rating{" "}
                                        {candidate.alternativeRating}
                                      </small>
                                    </article>
                                  ))}
                                </div>
                              ) : (
                                <p>No eligible unowned default found.</p>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>
                      No published counter list was available for the major
                      threats in this selected scope.
                    </p>
                  )}
                  <small className="analysis-provenance">
                    Source:{" "}
                    {alternatives.counterEvidenceSource.replaceAll("-", " ")}{" "}
                    · data {alternatives.dataVersion}
                  </small>
                </section>
              ) : null}

              <section className="analysis-panel">
                <p className="eyebrow">Member coverage</p>
                <h2>Individual records in this scope</h2>
                <div className="threat-grid">
                  {analysis.members.map((member) => (
                    <article key={member.position}>
                      <p className="eyebrow">{member.position}</p>
                      <h3>{member.speciesId}</h3>
                      <p>
                        {member.wins}-{member.losses}-{member.ties} ·{" "}
                        {member.positiveMatchupPercentage.toFixed(1)}% positive
                      </p>
                      <small>
                        Average member-side rating{" "}
                        {member.averageMemberRating.toFixed(1)}
                      </small>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}

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
            <p>{analysis?.assumptions.join(" · ")}</p>
          </aside>
        </>
      ) : null}
    </main>
  );
}
