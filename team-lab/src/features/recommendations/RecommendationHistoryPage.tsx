import { useRef, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import { LEAGUES } from "@/domain/leagues";
import { buildRecommendationCandidatePool } from "@/domain/recommendations/candidatePool";
import {
  createRecommendationHistoryRecord,
  snapshotRecommendationFinalist,
  type RecommendationHistoryRecord,
  type RecommendationHistoryResult,
} from "@/domain/recommendations/history";
import { RecommendationFinalistSimulationService } from "@/domain/recommendations/finalistSimulation";
import { generateStaticRecommendationTeams } from "@/domain/recommendations/staticTeamGeneration";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { useLeague } from "@/features/leagues/leagueStore";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import {
  useClearRecommendationHistory,
  useCreateRecommendationHistory,
  useDeleteRecommendationHistory,
  useRecommendationHistoryList,
} from "@/features/recommendations/recommendationHistoryQueries";
import { createPvpokeTeamRankerAdapter } from "@/pvpoke/simulation";
import {
  formatIdentifier,
  formatMoveList,
  formatMoveName,
} from "@/utils/formatters";

interface ComparisonRun {
  readonly dataVersion: string;
  readonly policyVersions: RecommendationHistoryRecord["policyVersions"];
  readonly results: readonly RecommendationHistoryResult[];
  readonly cancelled: boolean;
  readonly failureCount: number;
  readonly archived: boolean;
}

const scoreDimensions = [
  ["Coverage", "coverage"],
  ["Bulk", "bulk"],
  ["Safety", "safety"],
  ["Consistency", "consistency"],
] as const;

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not open recommendation history.";
}

function formatRunTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function teamLineup(result: RecommendationHistoryResult): string {
  const members = result.staticTeam.orderedMembers;
  return [members.lead.speciesName, members.switch.speciesName, members.closer.speciesName].join(" / ");
}

function HistoryResultCard({
  result,
  index,
}: {
  readonly result: RecommendationHistoryResult;
  readonly index: number;
}) {
  const members = [
    ["Lead", result.staticTeam.orderedMembers.lead],
    ["Safe Switch", result.staticTeam.orderedMembers.switch],
    ["Closer", result.staticTeam.orderedMembers.closer],
  ] as const;

  return (
    <article className="recommendation-history-result">
      <header>
        <div>
          <p className="eyebrow">Recommendation {index + 1}</p>
          <h3>{result.explanation.headline}</h3>
          <p>{result.explanation.scope}</p>
        </div>
        <strong className="recommendation-score">
          {result.finalScore.score.toFixed(1)}
        </strong>
      </header>
      <div className="team-scorecard">
        {scoreDimensions.map(([label, dimension]) => {
          const score = result.analysis[dimension];
          return (
            <article key={dimension}>
              <span>{label}</span>
              <strong>{score.grade}</strong>
              <small>{score.score.toFixed(1)} / 100</small>
            </article>
          );
        })}
      </div>
      <div className="recommendation-history-members">
        {members.map(([position, member]) => (
          <section key={position}>
            <p className="eyebrow">{position}</p>
            <h4>{member.speciesName}</h4>
            <p>
              CP {member.exactBuild.cp} · level {member.exactBuild.level} ·{" "}
              {member.exactBuild.ivs.attack}/{member.exactBuild.ivs.defense}/
              {member.exactBuild.ivs.hp}
            </p>
            <p>
              {formatMoveName(member.exactBuild.fastMoveId)} ·{" "}
              {formatMoveList(member.exactBuild.chargedMoveIds)}
            </p>
            <small>{formatIdentifier(member.readiness)}</small>
          </section>
        ))}
      </div>
      {result.analysis.majorThreats.length > 0 ? (
        <p className="recommendation-history-threats">
          Key threats: {result.analysis.majorThreats
            .map((threat) => `${threat.speciesName} (${formatIdentifier(threat.threatLevel)})`)
            .join(" · ")}
        </p>
      ) : null}
      <details className="recommendation-details">
        <summary>Reasoning and alternatives</summary>
        <p>{result.explanation.reasons.join(" ")}</p>
        <p>{result.explanation.tradeoffs.join(" ")}</p>
        {result.alternatives.threats.map((threat) => (
          <div key={threat.threatSpeciesId}>
            <strong>{threat.threatSpeciesName}</strong>
            <span>
              Owned counters: {threat.owned.map((candidate) => candidate.speciesName).join(", ") || "none"}
            </span>
            <span>
              Ranked counters: {threat.unowned.map((candidate) => candidate.speciesName).join(", ") || "none"}
            </span>
          </div>
        ))}
      </details>
    </article>
  );
}

function ComparisonCard({
  previous,
  current,
}: {
  readonly previous: RecommendationHistoryResult | undefined;
  readonly current: RecommendationHistoryResult;
}) {
  const previousMetrics = previous
    ? [
        previous.finalScore.score,
        previous.analysis.coverage.score,
        previous.analysis.bulk.score,
        previous.analysis.safety.score,
        previous.analysis.consistency.score,
      ]
    : undefined;
  const currentMetrics = [
    current.finalScore.score,
    current.analysis.coverage.score,
    current.analysis.bulk.score,
    current.analysis.safety.score,
    current.analysis.consistency.score,
  ];
  const labels = ["TeamLab score", "Coverage", "Bulk", "Safety", "Consistency"];

  return (
    <article className="recommendation-comparison-card">
      <header>
        <div>
          <h4>{teamLineup(current)}</h4>
          <small>{previous ? "Same three species as the archived result" : "New trio in the refreshed results"}</small>
        </div>
      </header>
      <div className="recommendation-comparison-metrics">
        {labels.map((label, index) => {
          const next = currentMetrics[index]!;
          const before = previousMetrics?.[index];
          const delta = before === undefined ? undefined : next - before;
          return (
            <div key={label}>
              <span>{label}</span>
              <strong>{before === undefined ? "—" : before.toFixed(1)}</strong>
              <strong>{next.toFixed(1)}</strong>
              <small>
                {delta === undefined
                  ? "No earlier result"
                  : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
              </small>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RecommendationHistoryRun({
  record,
  running,
  onCompare,
  onCancel,
  onDeleteRequest,
  deleteConfirmationOpen,
  onDeleteConfirm,
  onDeleteCancel,
  deletePending,
  comparison,
  comparisonError,
  comparisonSaveError,
  progressText,
  progress,
  busy,
  comparisonAvailable,
  activeFormatId,
}: {
  readonly record: RecommendationHistoryRecord;
  readonly running: boolean;
  readonly onCompare: () => void;
  readonly onCancel: () => void;
  readonly onDeleteRequest: () => void;
  readonly deleteConfirmationOpen: boolean;
  readonly onDeleteConfirm: () => void;
  readonly onDeleteCancel: () => void;
  readonly deletePending: boolean;
  readonly comparison?: ComparisonRun;
  readonly comparisonError?: string;
  readonly comparisonSaveError?: string;
  readonly progressText?: string;
  readonly progress?: { readonly completed: number; readonly total: number };
  readonly busy: boolean;
  readonly comparisonAvailable: boolean;
  readonly activeFormatId: string;
}) {
  const oldVersionLabel = record.dataVersion;
  const currentLeagueTitle = LEAGUES[record.formatId].title;
  const anchorSummary = record.anchorSnapshots.length > 0
    ? record.anchorSnapshots.map((anchor) => `${anchor.speciesName} · ${formatIdentifier(anchor.position)}`).join("; ")
    : "Full inventory";

  return (
    <article className="recommendation-history-run">
      <header className="recommendation-history-run__heading">
        <div>
          <p className="eyebrow">{currentLeagueTitle} · {formatRunTime(record.createdAt)}</p>
          <h2>{record.results[0] ? teamLineup(record.results[0]) : "Recommendation run"}</h2>
          <p>Data {oldVersionLabel} · {record.summary.selectedResultCount} results</p>
        </div>
        <div className="recommendation-history-run__actions">
          {running ? (
            <button className="secondary-button" type="button" onClick={onCancel}>
              Cancel after current finalist
            </button>
          ) : null}
          <button
            className="secondary-button"
            type="button"
            disabled={!comparisonAvailable || busy || record.formatId !== activeFormatId}
            onClick={onCompare}
            title={record.formatId !== activeFormatId ? `Switch to ${currentLeagueTitle} to compare this run.` : undefined}
          >
            {running ? "Re-running…" : "Re-run and compare"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={onDeleteRequest}
          >
            Delete run
          </button>
        </div>
      </header>

      <p className="recommendation-history-settings">
        Anchors: {anchorSummary} · Targets: Top {record.options.targetLimit} · Team shields: {record.options.teamShields} · Target shields: {record.options.targetShields} · Build scope: {formatIdentifier(record.request.buildStatusScope)} · Partners: {formatIdentifier(record.request.partnerScope)}
      </p>
      {record.formatId !== activeFormatId ? (
        <p className="analysis-notice">
          Switch the active league to {currentLeagueTitle} to compare this run.
        </p>
      ) : null}

      {deleteConfirmationOpen ? (
        <div className="recommendation-history-confirm" role="group" aria-label="Confirm delete run">
          <span>Delete this archived run and its saved results?</span>
          <button className="danger-button" type="button" disabled={deletePending} onClick={onDeleteConfirm}>Delete</button>
          <button className="secondary-button" type="button" disabled={deletePending} onClick={onDeleteCancel}>Keep run</button>
        </div>
      ) : null}

      <details className="recommendation-details recommendation-history-results-details">
        <summary>Review {record.results.length} saved {record.results.length === 1 ? "result" : "results"}</summary>
        <div className="recommendation-history-results">
          {record.results.map((result, index) => (
            <HistoryResultCard key={`${record.historyId}-${result.staticTeam.teamKey}`} result={result} index={index} />
          ))}
        </div>
      </details>

      <details className="recommendation-details">
        <summary>Run details and versions</summary>
        <p>
          {record.summary.completedFinalistCount} finalists completed · {record.summary.failedFinalistCount} failed · {record.summary.attemptedFinalistCount} attempted · {record.generation.eligiblePartnerCount} eligible partners · {record.generation.finalistTarget} finalist target.
        </p>
        <p>
          Static policy {record.policyVersions.staticPolicy} · static score {record.policyVersions.staticScore} · final score {record.policyVersions.finalScore}
        </p>
        {record.summary.cancelled ? <p>This run was cancelled after the current finalist.</p> : null}
        {record.summary.selectionShortfall > 0 ? <p>{record.summary.selectionShortfall} requested result slots could not be filled.</p> : null}
        {record.failures.map((failure) => <p key={failure.teamKey}>{failure.message}</p>)}
      </details>

      {progressText ? (
        <section className="recommendation-progress" aria-live="polite">
          <strong>{progressText}</strong>
          <progress value={progress?.completed ?? 0} max={Math.max(progress?.total ?? 1, 1)} />
        </section>
      ) : null}
      {comparisonError ? <p className="inventory-error" role="alert">{comparisonError}</p> : null}
      {comparisonSaveError ? (
        <p className="analysis-notice" role="status">
          The refreshed comparison is shown below, but TeamLab could not archive the new run: {comparisonSaveError}
        </p>
      ) : null}
      {comparison ? (
        <section className="recommendation-comparison" aria-live="polite">
          <header>
            <div>
              <p className="eyebrow">Current data comparison</p>
              <h3>Saved {record.dataVersion} · refreshed {comparison.dataVersion}</h3>
            </div>
            <small>Scores pair by the same three species; the order shown is the refreshed order.</small>
          </header>
          {record.policyVersions.finalScore !== comparison.policyVersions.finalScore ||
          record.policyVersions.staticPolicy !== comparison.policyVersions.staticPolicy ||
          record.policyVersions.staticScore !== comparison.policyVersions.staticScore ? (
            <p className="analysis-notice">
              Recommendation formulas changed between these runs, so score differences reflect both PvPoke data and formula changes.
            </p>
          ) : null}
          {comparison.cancelled ? <p className="analysis-notice">This refreshed run was cancelled; the comparison may be partial.</p> : null}
          {comparison.failureCount > 0 ? <p className="analysis-notice">{comparison.failureCount} refreshed finalists failed.</p> : null}
          {comparison.archived ? (
            <p className="recommendation-history-status" role="status">
              The refreshed run was saved as a new history entry.
            </p>
          ) : null}
          <div className="recommendation-comparison-list">
            {comparison.results.map((current) => (
              <ComparisonCard
                key={current.staticTeam.teamKey}
                current={current}
                previous={record.results.find((old) => old.staticTeam.speciesKey === current.staticTeam.speciesKey)}
              />
            ))}
          </div>
          {record.results.some((old) => !comparison.results.some((current) => current.staticTeam.speciesKey === old.staticTeam.speciesKey)) ? (
            <p className="analysis-notice">Some archived trios no longer appear in the refreshed top results.</p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

export function RecommendationHistoryPage() {
  const league = useLeague();
  const historyResult = useRecommendationHistoryList();
  const inventoryResult = useInventoryList();
  const catalogResult = usePokemonCatalog();
  const deleteMutation = useDeleteRecommendationHistory();
  const clearMutation = useClearRecommendationHistory();
  const createMutation = useCreateRecommendationHistory();
  const abortController = useRef<AbortController | undefined>(undefined);
  const [runningHistoryId, setRunningHistoryId] = useState<string>();
  const [progress, setProgress] = useState<{ completed: number; total: number }>();
  const [comparisons, setComparisons] = useState<ReadonlyMap<string, ComparisonRun>>(new Map());
  const [comparisonErrors, setComparisonErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [comparisonSaveErrors, setComparisonSaveErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [deleteId, setDeleteId] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);

  if (historyResult.isPending) {
    return <main className="recommendation-page">Loading recommendation history…</main>;
  }

  if (historyResult.error) {
    return (
      <main className="recommendation-page">
        <PageHeader back={{ to: "/recommend", label: "Recommendations" }} eyebrow="Saved results" title="Recommendation history" />
        <p className="inventory-error" role="alert">{formatError(historyResult.error)}</p>
      </main>
    );
  }

  const records = historyResult.data ?? [];
  const inventory = inventoryResult.data ?? [];
  const catalog = catalogResult.data;
  const comparisonAvailable = Boolean(catalog && !inventoryResult.isPending);
  const mutationBusy = deleteMutation.isPending || clearMutation.isPending;

  async function compareRun(record: RecommendationHistoryRecord) {
    setComparisonErrors((errors) => new Map(errors).set(record.historyId, ""));
    setComparisonSaveErrors((errors) => new Map(errors).set(record.historyId, ""));
    setRunningHistoryId(record.historyId);
    setProgress(undefined);
    setComparisons((runs) => {
      const next = new Map(runs);
      next.delete(record.historyId);
      return next;
    });

    try {
      if (!catalog) {
        throw new Error(catalogResult.error ? formatError(catalogResult.error) : "Current PvPoke data is still loading.");
      }
      if (record.formatId !== league.id) {
        throw new Error(`Switch the active league to ${LEAGUES[record.formatId].title} before comparing this run.`);
      }

      const pool = buildRecommendationCandidatePool(record.request, inventory, catalog);
      const generation = generateStaticRecommendationTeams(pool);
      if (generation.finalists.length === 0) {
        throw new Error("The saved settings no longer produce eligible finalist teams with the current inventory and data.");
      }

      const controller = new AbortController();
      abortController.current = controller;
      const simulationOptions = record.options;
      const simulation = await new RecommendationFinalistSimulationService(
        createPvpokeTeamRankerAdapter(catalog.dataVersion),
      ).simulate(
        generation,
        inventory,
        catalog,
        simulationOptions,
        {
          signal: controller.signal,
          onProgress: (event) => setProgress({
            completed: event.completedFinalists,
            total: event.totalFinalists,
          }),
          yieldBetweenFinalists: () => new Promise((resolve) => {
            window.setTimeout(resolve, 0);
          }),
        },
      );

      if (simulation.selected.length === 0) {
        throw new Error("The refreshed run completed without a result to compare.");
      }
      const refreshed = simulation.selected.map(snapshotRecommendationFinalist);
      setComparisons((runs) => new Map(runs).set(record.historyId, {
        dataVersion: simulation.dataVersion,
        policyVersions: {
          staticPolicy: generation.policy.version,
          staticScore: generation.finalists[0]?.preScore.version ?? record.policyVersions.staticScore,
          finalScore: simulation.selected[0]?.finalScore.version ?? record.policyVersions.finalScore,
        },
        results: refreshed,
        cancelled: simulation.cancelled,
        failureCount: simulation.failures.length,
        archived: false,
      }));

      try {
        const newHistory = createRecommendationHistoryRecord({
          request: record.request,
          options: simulationOptions,
          generation,
          simulation,
          inventory,
          catalog,
        });
        await createMutation.mutateAsync(newHistory);
        setComparisons((runs) => {
          const next = new Map(runs);
          const comparison = next.get(record.historyId);
          if (comparison) next.set(record.historyId, { ...comparison, archived: true });
          return next;
        });
      } catch (error) {
        setComparisonSaveErrors((errors) => new Map(errors).set(record.historyId, formatError(error)));
      }
    } catch (error) {
      setComparisonErrors((errors) => new Map(errors).set(record.historyId, formatError(error)));
    } finally {
      setRunningHistoryId(undefined);
      setProgress(undefined);
      abortController.current = undefined;
    }
  }

  async function deleteRun(historyId: string) {
    try {
      await deleteMutation.mutateAsync(historyId);
      setDeleteId(undefined);
      setComparisons((runs) => {
        const next = new Map(runs);
        next.delete(historyId);
        return next;
      });
    } catch {
      // The mutation error is shown above the history list.
    }
  }

  async function clearHistory() {
    try {
      await clearMutation.mutateAsync();
      setConfirmClear(false);
      setComparisons(new Map());
    } catch {
      // The mutation error is shown above the history list.
    }
  }

  return (
    <main className="recommendation-page recommendation-history-page">
      <PageHeader
        back={{ to: "/recommend", label: "Recommendations" }}
        description={
          <p>
            Review saved recommendation results with their original settings and
            PvPoke data version. Re-run any saved scope to compare it with the
            data currently loaded for that league.
          </p>
        }
        eyebrow="Saved results"
        title="Recommendation history"
      />
      {catalogResult.error && !catalog ? (
        <p className="analysis-notice" role="status">
          Current PvPoke data is unavailable. Saved results remain available;
          comparisons will work after the data loads.
        </p>
      ) : null}
      <div className="recommendation-history-toolbar">
        <p>
          {records.length} saved {records.length === 1 ? "run" : "runs"} across all leagues.
          New results are saved on this device automatically. Comparisons use the active {league.title} catalog.
        </p>
        <div>
          <Link className="primary-link" to="/recommend">Start a recommendation</Link>
          {records.length > 0 ? (
          <button className="secondary-button" type="button" disabled={runningHistoryId !== undefined || mutationBusy} onClick={() => setConfirmClear((visible) => !visible)}>
              Clear history
            </button>
          ) : null}
        </div>
      </div>
      {confirmClear ? (
        <section className="recommendation-history-confirm recommendation-history-confirm--all" role="alertdialog" aria-label="Confirm clear recommendation history">
          <p>Delete all {records.length} saved recommendation runs? This cannot be undone. Download a TeamLab backup first if you may need them.</p>
          <button className="danger-button" type="button" disabled={runningHistoryId !== undefined || mutationBusy} onClick={() => void clearHistory()}>
            {clearMutation.isPending ? "Clearing…" : "Delete all runs"}
          </button>
          <button className="secondary-button" type="button" disabled={runningHistoryId !== undefined || mutationBusy} onClick={() => setConfirmClear(false)}>Keep history</button>
        </section>
      ) : null}
      {clearMutation.error || deleteMutation.error ? (
        <p className="inventory-error" role="alert">{formatError(clearMutation.error ?? deleteMutation.error)}</p>
      ) : null}
      {records.length === 0 ? (
        <section className="form-section recommendation-history-empty">
          <h2>No saved recommendation runs yet</h2>
          <p>Generate a recommendation with at least one result. TeamLab will keep its settings, scorecards, threats, and data version here.</p>
          <Link className="primary-link" to="/recommend">Generate recommendations</Link>
        </section>
      ) : (
        <div className="recommendation-history-list">
          {records.map((record) => (
            <RecommendationHistoryRun
              key={record.historyId}
              record={record}
              running={runningHistoryId === record.historyId}
              busy={runningHistoryId !== undefined || mutationBusy}
              deletePending={deleteMutation.isPending}
              onCompare={() => void compareRun(record)}
              onCancel={() => abortController.current?.abort()}
              onDeleteRequest={() => setDeleteId(record.historyId)}
              deleteConfirmationOpen={deleteId === record.historyId}
              onDeleteConfirm={() => void deleteRun(record.historyId)}
              onDeleteCancel={() => setDeleteId(undefined)}
              comparison={comparisons.get(record.historyId)}
              comparisonError={comparisonErrors.get(record.historyId) || undefined}
              comparisonSaveError={comparisonSaveErrors.get(record.historyId) || undefined}
              progressText={runningHistoryId === record.historyId && progress ? `Finalists ${progress.completed}/${progress.total}` : undefined}
              progress={runningHistoryId === record.historyId ? progress : undefined}
              comparisonAvailable={comparisonAvailable && !inventoryResult.error}
              activeFormatId={league.id}
            />
          ))}
        </div>
      )}
    </main>
  );
}
