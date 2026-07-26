import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import {
  recommendationRequestSchema,
  type RecommendationAnchorPosition,
  type RecommendationBuildStatusScope,
} from "@/domain/recommendations/contracts";
import { explainRecommendation } from "@/domain/recommendations/explanations";
import {
  RecommendationFinalistSimulationService,
  type RecommendationFinalistProgress,
  type RecommendationFinalistSimulation,
  type SimulatedRecommendationFinalist,
} from "@/domain/recommendations/finalistSimulation";
import {
  generateStaticRecommendationTeams,
  type StaticRecommendationGeneration,
} from "@/domain/recommendations/staticTeamGeneration";
import type { ShieldCount } from "@/domain/simulation/contracts";
import {
  META_TARGET_LIMITS,
  type MetaTargetLimit,
} from "@/domain/simulation/teamRanker";
import { createSavedTeam } from "@/domain/teams/factory";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useCreateSavedTeam } from "@/features/teams/savedTeamQueries";
import {
  createPvpokeTeamBuilderLink,
  pvpokeBaseUrl,
} from "@/pvpoke/links";
import { createPvpokeTeamRankerAdapter } from "@/pvpoke/simulation";
import {
  formatIdentifier,
  formatMoveList,
  formatMoveName,
} from "@/utils/formatters";

const anchorPositions: readonly {
  readonly value: RecommendationAnchorPosition;
  readonly label: string;
}[] = [
  { value: "flex", label: "Best-fit role" },
  { value: "lead", label: "Lock Lead" },
  { value: "switch", label: "Lock Safe Switch" },
  { value: "closer", label: "Lock Closer" },
];

function selectedSpeciesId(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

function inventoryLabel(
  record: InventoryPokemon,
  catalogById: ReadonlyMap<string, PokemonCatalog["entries"][number]>,
): string {
  const speciesId = selectedSpeciesId(record);
  const pokemon = catalogById.get(speciesId);
  const cp =
    record.buildStatus === "planned"
      ? (record.plannedBuild.targetCp ?? "derived")
      : record.currentBuild.cp;

  return `${pokemon?.speciesName ?? speciesId} · CP ${cp} · ${record.buildStatus}`;
}

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not generate recommendations.";
}

function formatBuildRequirement(
  message: string,
  moveIds: readonly string[],
): string {
  return moveIds.reduce(
    (formatted, moveId) =>
      formatted.replaceAll(moveId, formatMoveName(moveId)),
    message,
  );
}

function RecommendationResultCard({
  finalist,
  index,
  saving,
  saved,
  onSave,
}: {
  readonly finalist: SimulatedRecommendationFinalist;
  readonly index: number;
  readonly saving: boolean;
  readonly saved: boolean;
  readonly onSave: () => void;
}) {
  const explanation = explainRecommendation(finalist);
  const members = [
    {
      position: "Lead",
      candidate: finalist.staticTeam.orderedMembers.lead,
    },
    {
      position: "Safe Switch",
      candidate: finalist.staticTeam.orderedMembers.switch,
    },
    {
      position: "Closer",
      candidate: finalist.staticTeam.orderedMembers.closer,
    },
  ] as const;
  const rankedDefaultCount = members.filter(
    ({ candidate }) => candidate.source === "ranked-default-build",
  ).length;
  const canSave = rankedDefaultCount === 0;

  return (
    <article className="recommendation-result">
      <header className="recommendation-result__heading">
        <div>
          <p className="eyebrow">Recommendation {index + 1}</p>
          <h2>{explanation.headline}</h2>
          <p>{explanation.scope}</p>
        </div>
        <span className="recommendation-score">
          {finalist.finalScore.score.toFixed(1)}
        </span>
      </header>

      <div className="recommendation-members">
        {members.map(({ position, candidate }) => (
          <section key={position}>
            <PokemonSprite
              size="large"
              speciesId={candidate.exactBuild.speciesId}
              speciesName={candidate.speciesName}
            />
            <p className="eyebrow">{position}</p>
            <h3>{candidate.speciesName}</h3>
            <p>
              CP {candidate.exactBuild.cp} · level{" "}
              {candidate.exactBuild.level} · {candidate.exactBuild.ivs.attack}/
              {candidate.exactBuild.ivs.defense}/
              {candidate.exactBuild.ivs.hp}
            </p>
            <p>
              {formatMoveName(candidate.exactBuild.fastMoveId)} ·{" "}
              {formatMoveList(candidate.exactBuild.chargedMoveIds)}
            </p>
            <small>
              {candidate.source === "ranked-default-build"
                ? "Ranked option · not owned"
                : formatIdentifier(candidate.readiness)}
              {candidate.favorite ? " · favorite" : ""}
            </small>
            {candidate.source === "ranked-default-build" ? (
              <small>
                Simulated with PvPoke’s recommended moves and default Great
                League IVs.
              </small>
            ) : candidate.buildRequirements.length > 0 ? (
              <ul>
                {candidate.buildRequirements.map((requirement) => (
                  <li key={`${requirement.code}-${requirement.message}`}>
                    {formatBuildRequirement(requirement.message, [
                      candidate.exactBuild.fastMoveId,
                      ...candidate.exactBuild.chargedMoveIds,
                    ])}
                  </li>
                ))}
              </ul>
            ) : (
              <small>No qualitative build changes required.</small>
            )}
          </section>
        ))}
      </div>

      <div className="team-scorecard">
        {[
          ["Coverage", finalist.analysis.coverage.grade, finalist.analysis.coverage.score],
          ["Bulk", finalist.analysis.bulk.grade, finalist.analysis.bulk.score],
          ["Safety", finalist.analysis.safety.grade, finalist.analysis.safety.score],
          [
            "Consistency",
            finalist.analysis.consistency.grade,
            finalist.analysis.consistency.score,
          ],
        ].map(([label, grade, score]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{grade}</strong>
            <small>{Number(score).toFixed(1)} / 100</small>
          </article>
        ))}
      </div>

      <div className="recommendation-evidence">
        <section>
          <h3>Why this team</h3>
          <ul>
            {explanation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Tradeoffs</h3>
          <ul>
            {explanation.tradeoffs.map((tradeoff) => (
              <li key={tradeoff}>{tradeoff}</li>
            ))}
          </ul>
        </section>
      </div>

      {finalist.analysis.majorThreats.length > 0 ? (
        <section className="recommendation-threats">
          <h3>Highest-priority threats</h3>
          <div>
            {finalist.analysis.majorThreats.slice(0, 3).map((threat) => (
              <span key={threat.speciesId}>
                {threat.speciesName} ·{" "}
                {formatIdentifier(threat.threatLevel)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {finalist.alternatives.threats.length > 0 ? (
        <details className="recommendation-details">
          <summary>Threat alternatives</summary>
          {finalist.alternatives.threats.slice(0, 3).map((threat) => (
            <div key={threat.threatSpeciesId}>
              <strong>{threat.threatSpeciesName}</strong>
              <span>
                Owned:{" "}
                {threat.owned.map((candidate) => candidate.speciesName).join(", ") ||
                  "none"}
              </span>
              <span>
                Unowned:{" "}
                {threat.unowned
                  .map((candidate) => candidate.speciesName)
                  .join(", ") || "none"}
              </span>
            </div>
          ))}
        </details>
      ) : null}

      <details className="recommendation-details">
        <summary>Methods and assumptions</summary>
        <p>{finalist.finalScore.method}</p>
        <p>{finalist.staticTeam.preScore.assumptions.join(" · ")}</p>
        <p>{finalist.analysis.assumptions.join(" · ")}</p>
      </details>

      <footer className="recommendation-result__actions">
        {!canSave ? (
          <p className="recommendation-save-notice">
            Add the {rankedDefaultCount} ranked{" "}
            {rankedDefaultCount === 1 ? "option" : "options"} to inventory
            before saving this team.
          </p>
        ) : null}
        {finalist.run.request ? (
          <a
            className="secondary-link"
            href={createPvpokeTeamBuilderLink(finalist.run.request.team, {
              baseUrl: pvpokeBaseUrl,
            })}
            target="_blank"
            rel="noreferrer"
          >
            Open exact team in PvPoke ↗
          </a>
        ) : null}
        <button
          className="primary-button"
          type="button"
          disabled={saving || saved || !canSave}
          onClick={onSave}
        >
          <Save size={18} />
          {saved
            ? "Saved to teams"
            : saving
              ? "Saving…"
              : canSave
                ? "Save this team"
                : "Inventory required to save"}
        </button>
      </footer>
    </article>
  );
}

export function RecommendationPage() {
  const inventoryResult = useInventoryList();
  const catalogResult = usePokemonCatalog();
  const createTeamMutation = useCreateSavedTeam();
  const abortController = useRef<AbortController | undefined>(undefined);
  const [anchorOneId, setAnchorOneId] = useState("");
  const [anchorOnePosition, setAnchorOnePosition] =
    useState<RecommendationAnchorPosition>("flex");
  const [useSecondAnchor, setUseSecondAnchor] = useState(false);
  const [anchorTwoId, setAnchorTwoId] = useState("");
  const [anchorTwoPosition, setAnchorTwoPosition] =
    useState<RecommendationAnchorPosition>("flex");
  const [resultCount, setResultCount] = useState(3);
  const [buildStatusScope, setBuildStatusScope] =
    useState<RecommendationBuildStatusScope>("all");
  const [includeRankedPartners, setIncludeRankedPartners] = useState(false);
  const [targetLimit, setTargetLimit] = useState<MetaTargetLimit>(5);
  const [teamShields, setTeamShields] = useState<ShieldCount>(1);
  const [targetShields, setTargetShields] = useState<ShieldCount>(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] =
    useState<RecommendationFinalistProgress>();
  const [generation, setGeneration] =
    useState<StaticRecommendationGeneration>();
  const [candidateExclusionCount, setCandidateExclusionCount] = useState(0);
  const [simulation, setSimulation] =
    useState<RecommendationFinalistSimulation>();
  const [workflowError, setWorkflowError] = useState<unknown>();
  const [saveError, setSaveError] = useState<unknown>();
  const [savingTeamKey, setSavingTeamKey] = useState<string>();
  const [savedTeamKeys, setSavedTeamKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [requestStep, setRequestStep] = useState(0);
  const inventory = inventoryResult.data ?? [];

  if (inventoryResult.isPending || catalogResult.isLoading) {
    return <main className="recommendation-page">Preparing recommendations…</main>;
  }

  const loadingError = inventoryResult.error ?? catalogResult.error;

  if (!catalogResult.data || loadingError) {
    return (
      <main className="recommendation-page">
        <Link to="/">← Home</Link>
        <p className="inventory-error" role="alert">
          {formatError(loadingError)}
        </p>
      </main>
    );
  }

  const catalog = catalogResult.data;
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const inventoryOptions = [...inventory].sort((left, right) =>
    inventoryLabel(left, catalogById).localeCompare(
      inventoryLabel(right, catalogById),
    ),
  );
  const resolvedAnchorOneId =
    anchorOneId || inventoryOptions[0]?.inventoryId || "";
  const resolvedAnchorTwoId =
    anchorTwoId && anchorTwoId !== resolvedAnchorOneId
      ? anchorTwoId
      : inventoryOptions.find(
          (record) => record.inventoryId !== resolvedAnchorOneId,
        )?.inventoryId ?? "";

  async function runRecommendations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkflowError(undefined);
    setSaveError(undefined);
    setSimulation(undefined);
    setGeneration(undefined);
    setCandidateExclusionCount(0);
    setProgress(undefined);

    try {
      const anchors = [
        { inventoryId: resolvedAnchorOneId, position: anchorOnePosition },
        ...(useSecondAnchor
          ? [{ inventoryId: resolvedAnchorTwoId, position: anchorTwoPosition }]
          : []),
      ];
      const request = recommendationRequestSchema.parse({
        formatId: "great-league",
        anchors,
        resultCount,
        buildStatusScope,
        partnerScope: includeRankedPartners
          ? "owned-and-ranked"
          : "owned-only",
      });
      const pool = buildRecommendationCandidatePool(
        request,
        inventory,
        catalog,
      );
      setCandidateExclusionCount(pool.exclusions.length);
      const nextGeneration = generateStaticRecommendationTeams(pool);
      setGeneration(nextGeneration);

      if (nextGeneration.finalists.length === 0) {
        throw new Error(
          "No eligible species-distinct finalist teams remain under the current anchors and teammate scope.",
        );
      }

      const controller = new AbortController();
      abortController.current = controller;
      setRunning(true);
      const service = new RecommendationFinalistSimulationService(
        createPvpokeTeamRankerAdapter(catalog.dataVersion),
      );
      const nextSimulation = await service.simulate(
        nextGeneration,
        inventory,
        catalog,
        { targetLimit, teamShields, targetShields },
        {
          signal: controller.signal,
          onProgress: setProgress,
          yieldBetweenFinalists: () =>
            new Promise((resolve) => {
              window.setTimeout(() => resolve(), 0);
            }),
        },
      );
      setSimulation(nextSimulation);
      setRequestStep(nextSimulation.cancelled ? 1 : 2);
    } catch (error) {
      setWorkflowError(error);
    } finally {
      setRunning(false);
      abortController.current = undefined;
    }
  }

  function saveResult(finalist: SimulatedRecommendationFinalist) {
    setSaveError(undefined);
    setSavingTeamKey(finalist.staticTeam.teamKey);

    try {
      const members = finalist.staticTeam.orderedMembers;
      const candidates = [members.lead, members.switch, members.closer];

      if (
        candidates.some(
          (candidate) => candidate.source === "ranked-default-build",
        )
      ) {
        throw new Error(
          "Add ranked-default teammates to inventory before saving this team.",
        );
      }
      const name = `TeamLab: ${members.lead.speciesName} / ${members.switch.speciesName} / ${members.closer.speciesName}`.slice(
        0,
        100,
      );
      const team = createSavedTeam(
        {
          name,
          members: {
            leadInventoryId: members.lead.inventoryId,
            switchInventoryId: members.switch.inventoryId,
            closerInventoryId: members.closer.inventoryId,
          },
          notes: `Generated by TeamLab from data ${finalist.analysis.dataVersion}. Final selection score ${finalist.finalScore.score.toFixed(1)}. ${explainRecommendation(finalist).headline}`,
        },
        { inventory, catalog },
      );

      createTeamMutation.mutate(team, {
        onSuccess: () => {
          setSavedTeamKeys(
            (keys) => new Set([...keys, finalist.staticTeam.teamKey]),
          );
          setSavingTeamKey(undefined);
        },
        onError: (error) => {
          setSaveError(error);
          setSavingTeamKey(undefined);
        },
      });
    } catch (error) {
      setSaveError(error);
      setSavingTeamKey(undefined);
    }
  }

  return (
    <main className="recommendation-page">
      <PageHeader
        description={
          <p>
            Choose one or two exact owned anchors, then compare lineups made
            from your inventory, ranked PvPoke options, or both.
          </p>
        }
        eyebrow="Guided team discovery"
        title="Build around your anchors"
      />

      {inventory.length < 1 ? (
        <section className="form-section">
          <h2>Add one Pokémon to choose an anchor</h2>
          <p>
            Your anchor always uses an exact owned build. Ranked Pokémon can
            fill the remaining positions once an anchor exists.
          </p>
          <Link className="primary-link" to="/inventory/new">
            Add Pokémon
          </Link>
        </section>
      ) : (
        <>
        <nav
          className="form-stepper recommendation-stepper"
          aria-label="Recommendation progress"
        >
          {[
            ["Anchors", "Choose your core"],
            ["Experiment", "Set the scope"],
            ["Results", "Compare teams"],
          ].map(([label, hint], index) => (
            <button
              aria-current={requestStep === index ? "step" : undefined}
              className={
                requestStep === index
                  ? "form-step form-step--active"
                  : index < requestStep
                    ? "form-step form-step--complete"
                    : "form-step"
              }
              disabled={index > requestStep || running}
              key={label}
              onClick={() => {
                if (index <= requestStep) setRequestStep(index);
              }}
              type="button"
            >
              <span>{index < requestStep ? <Check size={16} /> : index + 1}</span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </nav>
        <form
          className="recommendation-form"
          onSubmit={(event) => void runRecommendations(event)}
        >
          {requestStep === 0 ? (
          <section className="form-section">
            <div className="form-section__heading">
              <div>
                <p className="eyebrow">Required constraints</p>
                <h2>Anchors</h2>
              </div>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={useSecondAnchor}
                  disabled={running}
                  onChange={(event) =>
                    setUseSecondAnchor(event.target.checked)
                  }
                />
                Use two anchors
              </label>
            </div>
            <div className="recommendation-anchor-grid">
              <label className="form-field">
                <span>First anchor</span>
                <select
                  required
                  value={resolvedAnchorOneId}
                  disabled={running}
                  onChange={(event) => setAnchorOneId(event.target.value)}
                >
                  {inventoryOptions.map((record) => (
                    <option key={record.inventoryId} value={record.inventoryId}>
                      {inventoryLabel(record, catalogById)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>First anchor position</span>
                <select
                  value={anchorOnePosition}
                  disabled={running}
                  onChange={(event) =>
                    setAnchorOnePosition(
                      event.target.value as RecommendationAnchorPosition,
                    )
                  }
                >
                  {anchorPositions.map((position) => (
                    <option key={position.value} value={position.value}>
                      {position.label}
                    </option>
                  ))}
                </select>
              </label>
              {useSecondAnchor ? (
                <>
                  <label className="form-field">
                    <span>Second anchor</span>
                    <select
                      required
                      value={resolvedAnchorTwoId}
                      disabled={running}
                      onChange={(event) => setAnchorTwoId(event.target.value)}
                    >
                      {inventoryOptions.map((record) => (
                        <option
                          key={record.inventoryId}
                          value={record.inventoryId}
                          disabled={
                            record.inventoryId === resolvedAnchorOneId
                          }
                        >
                          {inventoryLabel(record, catalogById)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Second anchor position</span>
                    <select
                      value={anchorTwoPosition}
                      disabled={running}
                      onChange={(event) =>
                        setAnchorTwoPosition(
                          event.target.value as RecommendationAnchorPosition,
                        )
                      }
                    >
                      {anchorPositions.map((position) => (
                        <option key={position.value} value={position.value}>
                          {position.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>
            <div className="recommendation-run-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setRequestStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                type="button"
              >
                Continue to experiment
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
          ) : null}

          {requestStep === 1 ? (
          <section className="form-section">
            <p className="eyebrow">Discovery and exact scope</p>
            <h2>Recommendation settings</h2>
            <div className="recommendation-settings-grid">
              <label className="form-field">
                <span>Results</span>
                <select
                  value={resultCount}
                  disabled={running}
                  onChange={(event) =>
                    setResultCount(Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Owned build scope</span>
                <select
                  value={buildStatusScope}
                  disabled={running}
                  onChange={(event) =>
                    setBuildStatusScope(
                      event.target.value as RecommendationBuildStatusScope,
                    )
                  }
                >
                  <option value="all">Ready now and planned</option>
                  <option value="ready-now-only">Ready now only</option>
                  <option value="planned-only">Planned only</option>
                </select>
              </label>
              <label className="form-field">
                <span>Meta targets</span>
                <select
                  value={targetLimit}
                  disabled={running}
                  onChange={(event) =>
                    setTargetLimit(
                      Number(event.target.value) as MetaTargetLimit,
                    )
                  }
                >
                  {META_TARGET_LIMITS.map((limit) => (
                    <option key={limit} value={limit}>
                      Top {limit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Team shields</span>
                <select
                  value={teamShields}
                  disabled={running}
                  onChange={(event) =>
                    setTeamShields(
                      Number(event.target.value) as ShieldCount,
                    )
                  }
                >
                  {[0, 1, 2].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Target shields</span>
                <select
                  value={targetShields}
                  disabled={running}
                  onChange={(event) =>
                    setTargetShields(
                      Number(event.target.value) as ShieldCount,
                    )
                  }
                >
                  {[0, 1, 2].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="recommendation-partner-scope">
              <input
                type="checkbox"
                checked={includeRankedPartners}
                disabled={running}
                onChange={(event) =>
                  setIncludeRankedPartners(event.target.checked)
                }
              />
              <span>
                <strong>Include ranked Pokémon not in my inventory</strong>
                <small>
                  Uses PvPoke’s recommended moves and default Great League IVs.
                  These teams can be simulated now, but ranked picks must be
                  added to inventory before saving.
                </small>
              </span>
            </label>
            {targetLimit >= 20 ? (
              <p className="analysis-notice">
                Large scopes can run hundreds or thousands of synchronous
                battles and temporarily block this tab.
              </p>
            ) : null}
            <div className="recommendation-run-actions">
              <button
                className="secondary-button"
                disabled={running}
                onClick={() => setRequestStep(0)}
                type="button"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={running}
              >
                <Sparkles size={18} />
                {running ? "Simulating finalists…" : "Generate recommendations"}
              </button>
              {running ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => abortController.current?.abort()}
                >
                  Cancel after current finalist
                </button>
              ) : null}
            </div>
          </section>
          ) : null}
        </form>
        </>
      )}

      {progress ? (
        <section className="recommendation-progress" aria-live="polite">
          <div>
            <strong>
              {progress.status === "cancelled"
                ? "Run cancelled"
                : `Finalists ${progress.completedFinalists}/${progress.totalFinalists}`}
            </strong>
            <span>{formatIdentifier(progress.status)}</span>
          </div>
          <progress
            value={progress.completedFinalists}
            max={Math.max(progress.totalFinalists, 1)}
          />
        </section>
      ) : null}

      {workflowError ? (
        <p className="inventory-error" role="alert">
          {formatError(workflowError)}
        </p>
      ) : null}

      {generation ? (
        <section className="recommendation-summary">
          <div>
            <span>Eligible partners</span>
            <strong>{generation.eligiblePartnerCount}</strong>
          </div>
          <div>
            <span>Unique static teams</span>
            <strong>{generation.uniqueTeamCount}</strong>
          </div>
          <div>
            <span>Exact finalists</span>
            <strong>{generation.finalists.length}</strong>
          </div>
          <div>
            <span>Discovery exclusions</span>
            <strong>{candidateExclusionCount}</strong>
          </div>
          <div>
            <span>Evidence exclusions</span>
            <strong>{generation.eligibilityExclusions.length}</strong>
          </div>
        </section>
      ) : null}

      {simulation ? (
        <>
          <div className="results-toolbar">
            <div>
              <p className="eyebrow">Experiment complete</p>
              <h2>Recommended teams</h2>
            </div>
            <button
              className="secondary-button"
              onClick={() => setRequestStep(0)}
              type="button"
            >
              Adjust inputs
            </button>
          </div>
          <section
            className={`diagnostics-banner ${
              simulation.selected.length > 0
                ? "diagnostics-banner--pass"
                : "diagnostics-banner--fail"
            }`}
          >
            <div>
              <p className="eyebrow">Exact recommendation result</p>
              <h2>
                {simulation.selected.length} of{" "}
                {simulation.requestedResultCount} requested teams
              </h2>
              <p>
                {simulation.completed.length} finalists completed ·{" "}
                {simulation.failures.length} failed · data{" "}
                {simulation.dataVersion}
              </p>
            </div>
            <Link className="secondary-link" to="/teams">
              View saved teams
            </Link>
          </section>

          {simulation.selectionShortfall > 0 ||
          simulation.selectionDiversityRelaxed ||
          simulation.cancelled ? (
            <p className="analysis-notice">
              {simulation.cancelled
                ? "The run stopped before all finalists were attempted. "
                : ""}
              {simulation.selectionShortfall > 0
                ? `${simulation.selectionShortfall} requested result slots could not be filled. `
                : ""}
              {simulation.selectionDiversityRelaxed
                ? "Optional-core diversity was relaxed only enough to fill the requested count."
                : ""}
            </p>
          ) : null}

          {saveError ? (
            <p className="inventory-error" role="alert">
              {formatError(saveError)}
            </p>
          ) : null}

          <div className="recommendation-results">
            {simulation.selected.map((finalist, index) => (
              <RecommendationResultCard
                key={finalist.staticTeam.teamKey}
                finalist={finalist}
                index={index}
                saving={savingTeamKey === finalist.staticTeam.teamKey}
                saved={savedTeamKeys.has(finalist.staticTeam.teamKey)}
                onSave={() => saveResult(finalist)}
              />
            ))}
          </div>

          {simulation.failures.length > 0 ? (
            <details className="recommendation-details recommendation-failures">
              <summary>Failed finalists ({simulation.failures.length})</summary>
              <ul>
                {simulation.failures.map((failure) => (
                  <li key={failure.teamKey}>{failure.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
