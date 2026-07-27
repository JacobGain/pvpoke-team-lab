import { useMemo, useState } from "react";
import {
  CircleCheck,
  CircleX,
  Gauge,
  Heart,
  Hourglass,
  Minus,
  Pencil,
  Play,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
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
import {
  createPvpokeBattleLink,
  createPvpokeTeamBuilderLink,
  pvpokeBaseUrl,
} from "@/pvpoke/links";
import { deriveTeamAlternatives } from "@/domain/teamAnalysis/alternatives";
import { analyzeSavedTeamMatrix } from "@/domain/teamAnalysis/teamAnalysis";
import {
  formatIdentifier,
  formatMoveList,
  formatTeamPosition,
} from "@/utils/formatters";

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
  const [targetLimit, setTargetLimit] = useState<MetaTargetLimit>(48);
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
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const previewMembers = [
    ["Lead", team.members.leadInventoryId],
    ["Safe switch", team.members.switchInventoryId],
    ["Closer", team.members.closerInventoryId],
  ].map(([position, inventoryId]) => {
    const record = inventory.find(
      (candidate) => candidate.inventoryId === inventoryId,
    );
    const speciesId = record
      ? record.buildStatus === "planned"
        ? record.plannedBuild.targetSpeciesId
        : record.speciesId
      : "";
    return {
      position,
      record,
      pokemon: catalog.entries.find(
        (candidate) => candidate.speciesId === speciesId,
      ),
    };
  });

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
      <PageHeader
        actions={
          <Link className="secondary-link" to={`/teams/${team.teamId}`}>
            <Pencil size={18} />
            Edit team
          </Link>
        }
        back={{ to: "/teams", label: "Saved teams" }}
        description={
          <p>
            Evaluate this exact ordered team against a selected slice of the
            current PvPoke Open Great League meta.
          </p>
        }
        eyebrow="Team experiment"
        title={team.name}
      />

      <section className="simulation-team-lineup" aria-label="Team lineup">
        {previewMembers.map(({ position, record, pokemon }) => (
          <article key={position}>
            {pokemon ? (
              <PokemonSprite
                size="large"
                speciesId={pokemon.speciesId}
                speciesName={pokemon.speciesName}
              />
            ) : null}
            <span>
              <small>{position}</small>
              <strong>{pokemon?.speciesName ?? "Missing Pokémon"}</strong>
              <span>
                {record
                  ? `CP ${record.currentBuild.cp} · ${record.buildStatus}`
                  : "Repair this team"}
              </span>
            </span>
          </article>
        ))}
      </section>

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
                {limit === 48
                  ? "Greater Meta (48) · closest PvPoke grade comparison"
                  : `Top ${limit} · faster`}
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
          <Play size={18} />
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
              <h2>{formatIdentifier(run.performance)}</h2>
              <p>
                {run.result.battleCount} battles ·{" "}
                {Math.round(run.durationMs)} ms ·{" "}
                {run.scope.selectedTargetCount} of{" "}
                {run.scope.availableTargetCount} simulation-ready meta targets
                · data {run.result.dataVersion}
              </p>
            </div>
            {run.request ? (
              <a
                className="upstream-link"
                href={createPvpokeTeamBuilderLink(run.request.team, {
                  baseUrl: pvpokeBaseUrl,
                })}
                target="_blank"
                rel="noreferrer"
              >
                Open exact team in PvPoke ↗
              </a>
            ) : null}
          </section>

          {analysis ? (
            <>
              <section className="team-scorecard">
                <article>
                  <div className="team-scorecard__label">
                    <span className="team-scorecard__icon">
                      <Target aria-hidden="true" size={20} />
                    </span>
                    <span>Coverage</span>
                  </div>
                  <strong>{analysis.coverage.grade}</strong>
                  <small>
                    {analysis.coverage.score.toFixed(1)} / 100 · PvPoke
                    threat-score goal
                  </small>
                </article>
                <article>
                  <div className="team-scorecard__label">
                    <span className="team-scorecard__icon">
                      <Heart aria-hidden="true" size={20} />
                    </span>
                    <span>Bulk</span>
                  </div>
                  <strong>{analysis.bulk.grade}</strong>
                  <small>
                    {Math.round(analysis.bulk.pvpokeValue).toLocaleString()} /{" "}
                    {analysis.bulk.pvpokeGoal.toLocaleString()} bulk
                  </small>
                </article>
                <article>
                  <div className="team-scorecard__label">
                    <span className="team-scorecard__icon">
                      <Shield aria-hidden="true" size={20} />
                    </span>
                    <span>Safety</span>
                  </div>
                  <strong>{analysis.safety.grade}</strong>
                  <small>
                    {analysis.safety.pvpokeValue.toFixed(1)} /{" "}
                    {analysis.safety.pvpokeGoal} switch score
                  </small>
                </article>
                <article>
                  <div className="team-scorecard__label">
                    <span className="team-scorecard__icon">
                      <Hourglass aria-hidden="true" size={20} />
                    </span>
                    <span>Consistency</span>
                  </div>
                  <strong>{analysis.consistency.grade}</strong>
                  <small>
                    {analysis.consistency.pvpokeValue.toFixed(1)} /{" "}
                    {analysis.consistency.pvpokeGoal} exact-moveset score
                  </small>
                </article>
              </section>

              <section className="analysis-panel">
                <p className="eyebrow">Score evidence</p>
                <h2>What each score means</h2>
                <p className="analysis-panel__intro">
                  These grades summarize different qualities. Use them
                  together; no single score determines whether a team is good.
                </p>
                <div className="score-evidence-grid">
                  <article>
                    <span className="score-evidence-grid__icon">
                      <Target aria-hidden="true" size={22} />
                    </span>
                    <div>
                      <h3>Coverage</h3>
                      <p>
                        {analysis.coverage.method}.{" "}
                        {analysis.coverage.coveredTargets} of{" "}
                        {analysis.coverage.totalTargets} selected targets still
                        have at least one favorable team member.
                      </p>
                      <small>
                        Evidence: exact simulated matchups · use Greater Meta
                        for the closest PvPoke Team Builder comparison
                      </small>
                    </div>
                  </article>
                  {[
                    {
                      label: "Bulk",
                      icon: Heart,
                      evidence: analysis.bulk,
                    },
                    {
                      label: "Safety",
                      icon: Shield,
                      evidence: analysis.safety,
                    },
                    {
                      label: "Consistency",
                      icon: Hourglass,
                      evidence: analysis.consistency,
                    },
                  ].map(({ label, icon: Icon, evidence }) => (
                    <article key={label}>
                      <span className="score-evidence-grid__icon">
                        <Icon aria-hidden="true" size={22} />
                      </span>
                      <div>
                        <h3>{label}</h3>
                        <p>{evidence.method}</p>
                        <small>
                          Evidence:{" "}
                          {formatIdentifier(evidence.evidenceSource)}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="analysis-panel">
                <div className="analysis-panel__heading">
                  <div>
                    <p className="eyebrow">Threat evidence</p>
                    <h2>Major threats and core breakers</h2>
                    <p>
                      Start with team walls and core breakers. Each row names
                      the winner and shows that team member’s battle score:
                      above 500 is a win, below 500 is a loss.
                    </p>
                  </div>
                  <span className="rank-badge">
                    {analysis.shieldScenario} shields
                  </span>
                </div>
                {analysis.majorThreats.length > 0 ? (
                  <div className="threat-card-list">
                    {analysis.majorThreats.map((threat) => (
                      <article className="threat-card" key={threat.speciesId}>
                        <header className="threat-card__header">
                          <PokemonSprite
                            size="medium"
                            speciesId={threat.speciesId}
                            speciesName={threat.speciesName}
                          />
                          <div>
                            <p className="eyebrow">
                              {formatIdentifier(threat.threatLevel)}
                            </p>
                            <h3>{threat.speciesName}</h3>
                            <p>
                              Favored against {threat.targetWins} of{" "}
                              {threat.matchupRatings.length} team members
                            </p>
                          </div>
                          <span className="threat-card__rating">
                            {threat.targetWins}-{threat.targetLosses}-
                            {threat.ties}
                            <small>wins · losses · ties</small>
                          </span>
                        </header>
                        <div className="threat-matchups">
                          {threat.matchupRatings.map((matchup) => {
                            const memberName =
                              catalogById.get(matchup.teamSpeciesId)
                                ?.speciesName ?? matchup.teamSpeciesId;
                            const outcome =
                              matchup.teamMemberRating > 500
                                ? "win"
                                : matchup.teamMemberRating < 500
                                  ? "loss"
                                  : "tie";
                            const OutcomeIcon =
                              outcome === "win"
                                ? CircleCheck
                                : outcome === "loss"
                                  ? CircleX
                                  : Minus;

                            return (
                              <div
                                className="threat-matchup"
                                key={matchup.teamSpeciesId}
                              >
                                {catalogById.get(matchup.teamSpeciesId) ? (
                                  <PokemonSprite
                                    size="small"
                                    speciesId={matchup.teamSpeciesId}
                                    speciesName={memberName}
                                  />
                                ) : null}
                                <span>
                                  <strong>{memberName}</strong>
                                  <small>
                                    {outcome === "win"
                                      ? "Wins this matchup"
                                      : outcome === "loss"
                                        ? "Loses this matchup"
                                        : "Ties this matchup"}
                                  </small>
                                </span>
                                <span
                                  className={`matchup-result matchup-result--${outcome}`}
                                  title="Team member battle score"
                                >
                                  <OutcomeIcon aria-hidden="true" size={16} />
                                  <strong>{matchup.teamMemberRating}</strong>
                                  <small>battle score</small>
                                </span>
                              </div>
                            );
                          })}
                        </div>
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
                              {formatIdentifier(threat.threatLevel)}
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
                                      <div className="alternative-card__identity">
                                        <PokemonSprite
                                          size="small"
                                          speciesId={candidate.speciesId}
                                          speciesName={candidate.speciesName}
                                        />
                                        <span>
                                          <strong>{candidate.speciesName}</strong>
                                          <small>
                                            {candidate.buildStatus}
                                            {candidate.cp
                                              ? ` · CP ${candidate.cp}`
                                              : ""}
                                          </small>
                                        </span>
                                      </div>
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
                                      <div className="alternative-card__identity">
                                        <PokemonSprite
                                          size="small"
                                          speciesId={candidate.speciesId}
                                          speciesName={candidate.speciesName}
                                        />
                                        <span>
                                          <strong>{candidate.speciesName}</strong>
                                          <small>
                                            Level {candidate.defaultIvs.level} ·{" "}
                                            {candidate.defaultIvs.attack}/
                                            {candidate.defaultIvs.defense}/
                                            {candidate.defaultIvs.hp}
                                          </small>
                                        </span>
                                      </div>
                                      <small>
                                        {formatMoveList(
                                          candidate.recommendedMoveIds,
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
                    {formatIdentifier(alternatives.counterEvidenceSource)}{" "}
                    · data {alternatives.dataVersion}
                  </small>
                </section>
              ) : null}

              <section className="analysis-panel">
                <p className="eyebrow">Member coverage</p>
                <h2>Individual records in this scope</h2>
                <div className="threat-grid">
                  {analysis.members.map((member) => (
                    <article className="member-coverage-card" key={member.position}>
                      {catalogById.get(member.speciesId) ? (
                        <PokemonSprite
                          size="medium"
                          speciesId={member.speciesId}
                          speciesName={
                            catalogById.get(member.speciesId)!.speciesName
                          }
                        />
                      ) : null}
                      <p className="eyebrow">
                        {formatTeamPosition(member.position)}
                      </p>
                      <h3>
                        {catalogById.get(member.speciesId)?.speciesName ??
                          member.speciesId}
                      </h3>
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

          <details className="analysis-panel simulation-matrix">
            <summary>
              <span>
                <strong>Exact battle matrix</strong>
                <small>
                  {run.result.rankings.length} targets ·{" "}
                  {run.result.battleCount} battles
                </small>
              </span>
              <span>Show details</span>
            </summary>
            <p className="analysis-panel__intro">
              Open this technical detail when you need individual ratings,
              fast-move damage, Attack differential, or PvPoke battle links.
            </p>
            <section className="diagnostics-grid">
              {run.result.rankings.map((ranking) => (
                <article className="team-card" key={ranking.speciesId}>
                  <div className="team-card__heading">
                    <PokemonSprite
                      size="medium"
                      speciesId={ranking.speciesId}
                      speciesName={ranking.speciesName}
                    />
                    <div>
                      <p className="eyebrow">Meta target</p>
                      <h2>{ranking.speciesName}</h2>
                    </div>
                    <span className="rank-badge">
                      Avg target score {ranking.averageRating}
                    </span>
                  </div>
                  <dl className="analysis-detail-list">
                    {ranking.matchups.map((matchup, index) => {
                      const member = analysis?.members[index];
                      const memberName = member
                        ? catalogById.get(member.speciesId)?.speciesName ??
                          member.speciesId
                        : `Team slot ${index + 1}`;

                      return (
                        <div key={`${matchup.opponentSpeciesId}-${index}`}>
                          <dt>
                            vs. {memberName}
                            {member
                              ? ` · ${formatTeamPosition(member.position)}`
                              : ""}
                          </dt>
                          <dd className="battle-metrics">
                            <span
                              className={
                                matchup.rating > 500
                                  ? "battle-metric battle-metric--danger"
                                  : matchup.rating < 500
                                    ? "battle-metric battle-metric--success"
                                    : "battle-metric"
                              }
                            >
                              {matchup.rating === 500 ? (
                                <Minus aria-hidden="true" size={16} />
                              ) : matchup.rating > 500 ? (
                                <CircleX aria-hidden="true" size={16} />
                              ) : (
                                <CircleCheck aria-hidden="true" size={16} />
                              )}
                              <span>
                                <small>Simulated result</small>
                                <strong>
                                  {matchup.rating === 500
                                    ? "Tie"
                                    : matchup.rating > 500
                                      ? `${ranking.speciesName} wins`
                                      : `${memberName} wins`}
                                </strong>
                              </span>
                            </span>
                            <span className="battle-metric">
                              <Target aria-hidden="true" size={16} />
                              <span>
                                <small>Target battle score</small>
                                <strong>{matchup.rating}</strong>
                              </span>
                            </span>
                            <span className="battle-metric">
                              <Zap aria-hidden="true" size={16} />
                              <span>
                                <small>{ranking.speciesName} fast move</small>
                                <strong>{matchup.fastMoveDamage} damage</strong>
                              </span>
                            </span>
                            <span className="battle-metric">
                              <Shield aria-hidden="true" size={16} />
                              <span>
                                <small>{memberName} fast move</small>
                                <strong>
                                  {matchup.incomingFastMoveDamage} damage
                                </strong>
                              </span>
                            </span>
                            <span className="battle-metric">
                              <Gauge aria-hidden="true" size={16} />
                              <span>
                                <small>Attack difference</small>
                                <strong>
                                  {matchup.attackDifferential > 0 ? "+" : ""}
                                  {matchup.attackDifferential.toFixed(2)}
                                </strong>
                              </span>
                            </span>
                            {run.request?.team[index] &&
                            run.request.targets.find(
                              (target) =>
                                target.speciesId === ranking.speciesId,
                            ) ? (
                              <a
                                  className="inline-upstream-link battle-metric__link"
                                  href={createPvpokeBattleLink(
                                    run.request.team[index],
                                    run.request.targets.find(
                                      (target) =>
                                        target.speciesId === ranking.speciesId,
                                    )!,
                                    [
                                      run.scope.teamShields,
                                      run.scope.targetShields,
                                    ],
                                    { baseUrl: pvpokeBaseUrl },
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open exact battle ↗
                                </a>
                            ) : null}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </article>
              ))}
            </section>
          </details>

          <aside className="analysis-scope">
            <strong>Scope and assumptions</strong>
            <p>{analysis?.assumptions.join(" · ")}</p>
          </aside>
        </>
      ) : null}
    </main>
  );
}
