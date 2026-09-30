import { useMemo, useState } from "react";
import { ArrowRight, Check, CircleAlert, Play, Save, Shield } from "lucide-react";
import { Link } from "react-router";

import { PokemonSprite } from "@/components/PokemonSprite";
import { projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type { PokemonCatalog, PokemonCatalogEntry } from "@/domain/pokemon/catalog";
import {
  prepareSavedTeamRankerRequest,
  type SavedTeamRankerRun,
  SavedTeamRankingService,
} from "@/domain/simulation/savedTeamRanking";
import { analyzeSavedTeamMatrix } from "@/domain/teamAnalysis/teamAnalysis";
import {
  compareTeamAnalyses,
  type WhatIfAnalysisComparison,
} from "@/domain/teamAnalysis/whatIf";
import { createSavedTeam, updateSavedTeam } from "@/domain/teams/factory";
import type {
  SavedTeam,
  SavedTeamPosition,
  SavedTeamMembers,
} from "@/domain/teams/schemas";
import { useCreateSavedTeam, useUpdateSavedTeam } from "@/features/teams/savedTeamQueries";
import { formatTeamPosition } from "@/utils/formatters";

const POSITIONS: readonly {
  readonly id: SavedTeamPosition;
  readonly label: string;
  readonly inventoryKey: keyof SavedTeamMembers;
}[] = [
  { id: "lead", label: "Lead", inventoryKey: "leadInventoryId" },
  { id: "switch", label: "Safe switch", inventoryKey: "switchInventoryId" },
  { id: "closer", label: "Closer", inventoryKey: "closerInventoryId" },
];

interface ReplacementOption {
  readonly inventory: InventoryPokemon;
  readonly projected: InventoryPokemon;
  readonly pokemon: PokemonCatalogEntry;
  readonly label: string;
}

interface WhatIfExperiment {
  readonly run: SavedTeamRankerRun;
  readonly position: SavedTeamPosition;
  readonly replacement: ReplacementOption;
  readonly members: SavedTeamMembers;
}

interface TeamWhatIfPanelProps {
  readonly team: SavedTeam;
  readonly inventory: readonly InventoryPokemon[];
  readonly catalog: PokemonCatalog;
  readonly baseline: SavedTeamRankerRun;
  readonly baselineAnalysis: ReturnType<typeof analyzeSavedTeamMatrix>;
  readonly rankingService: SavedTeamRankingService;
  readonly onTeamUpdated: (team: SavedTeam) => void;
}

function speciesIdFor(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

function displayedCp(record: InventoryPokemon): number {
  return record.buildStatus === "planned"
    ? (record.plannedBuild.targetCp ?? record.currentBuild.cp)
    : record.currentBuild.cp;
}

function optionDetails(record: InventoryPokemon): string {
  const ivs = record.currentBuild.ivProfile.ivs;
  return `CP ${displayedCp(record)} · ${record.buildStatus} · IV ${ivs.attack}/${ivs.defense}/${ivs.hp}`;
}

function optionLabel(
  record: InventoryPokemon,
  pokemon: PokemonCatalogEntry,
): string {
  return `${pokemon.speciesName} · ${optionDetails(record)}`;
}

function defaultCopyName(teamName: string): string {
  const suffix = " (what-if)";
  return `${teamName.slice(0, 100 - suffix.length)}${suffix}`;
}

function formatScore(value: number, id: string): string {
  return id === "bulk"
    ? Math.round(value).toLocaleString()
    : value.toFixed(1);
}

function formatDelta(value: number, digits = 1): string {
  if (Math.abs(value) < 0.05) return `0.${"0".repeat(digits)}`;
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

function AnswerList({
  title,
  threats,
  tone,
}: {
  readonly title: string;
  readonly threats: WhatIfAnalysisComparison["newlyCovered"];
  readonly tone: "gained" | "lost";
}) {
  const Icon = tone === "gained" ? Check : CircleAlert;

  return (
    <article className={`team-what-if__answers team-what-if__answers--${tone}`}>
      <h3>
        <Icon aria-hidden="true" size={17} />
        {title}
        <span>{threats.length}</span>
      </h3>
      {threats.length > 0 ? (
        <ul>
          {threats.slice(0, 8).map((threat) => (
            <li key={threat.speciesId}>{threat.speciesName}</li>
          ))}
        </ul>
      ) : (
        <p>None in this target scope.</p>
      )}
      {threats.length > 8 ? (
        <small>And {threats.length - 8} more.</small>
      ) : null}
    </article>
  );
}

function ThreatChangeRow({
  change,
  position,
}: {
  readonly change: WhatIfAnalysisComparison["threatChanges"][number];
  readonly position: SavedTeamPosition;
}) {
  const positionIndex = POSITIONS.findIndex((candidate) => candidate.id === position);
  const beforeRating = change.before.matchupRatings[positionIndex]?.teamMemberRating;
  const afterRating = change.after.matchupRatings[positionIndex]?.teamMemberRating;
  const label =
    change.coverageChange === "gained"
      ? "New answer"
      : change.coverageChange === "lost"
        ? "Answer lost"
        : "Matchup shifted";

  return (
    <article className="team-what-if__threat-row">
      <PokemonSprite
        size="small"
        speciesId={change.speciesId}
        speciesName={change.speciesName}
      />
      <div>
        <strong>{change.speciesName}</strong>
        <small>{label}</small>
      </div>
      <span className="team-what-if__threat-values">
        <strong>
          {change.before.targetWins} → {change.after.targetWins}
        </strong>
        <small>
          meta wins · rating {change.before.targetAverageRating.toFixed(1)} →{" "}
          {change.after.targetAverageRating.toFixed(1)}
        </small>
      </span>
      {beforeRating !== undefined && afterRating !== undefined ? (
        <span className="team-what-if__threat-values">
          <strong>
            {beforeRating.toFixed(1)} → {afterRating.toFixed(1)}
          </strong>
          <small>{formatTeamPosition(position)} rating</small>
        </span>
      ) : null}
    </article>
  );
}

export function TeamWhatIfPanel({
  team,
  inventory,
  catalog,
  baseline,
  baselineAnalysis,
  rankingService,
  onTeamUpdated,
}: TeamWhatIfPanelProps) {
  const [position, setPosition] = useState<SavedTeamPosition>("switch");
  const [replacementId, setReplacementId] = useState("");
  const [experiment, setExperiment] = useState<WhatIfExperiment>();
  const [experimentError, setExperimentError] = useState<string>();
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState(() => defaultCopyName(team.name));
  const [saveError, setSaveError] = useState<string>();
  const [savedCopy, setSavedCopy] = useState<SavedTeam>();
  const createMutation = useCreateSavedTeam();
  const updateMutation = useUpdateSavedTeam();

  const inventoryById = useMemo(
    () => new Map(inventory.map((record) => [record.inventoryId, record])),
    [inventory],
  );
  const catalogById = useMemo(
    () => new Map(catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon])),
    [catalog.entries],
  );
  const replacementOptions = useMemo(() => {
    const otherDexes = new Set<number>();

    for (const slot of POSITIONS) {
      if (slot.id === position) continue;
      const record = inventoryById.get(team.members[slot.inventoryKey]);
      if (!record) continue;
      const projected = projectInventoryForCatalog(record, catalog);
      if (!projected) continue;
      const pokemon = catalogById.get(speciesIdFor(projected));
      if (pokemon) otherDexes.add(pokemon.dex);
    }

    const currentTeamIds = new Set(
      POSITIONS.map((slot) => team.members[slot.inventoryKey]),
    );

    return inventory.flatMap((record) => {
      if (currentTeamIds.has(record.inventoryId)) return [];
      const projected = projectInventoryForCatalog(record, catalog);
      if (!projected) return [];
      const pokemon = catalogById.get(speciesIdFor(projected));
      if (!pokemon || otherDexes.has(pokemon.dex)) return [];
      return [
        {
          inventory: record,
          projected,
          pokemon,
          label: optionLabel(projected, pokemon),
        },
      ];
    }).sort((left, right) =>
      left.pokemon.speciesName.localeCompare(right.pokemon.speciesName),
    );
  }, [catalog, catalogById, inventory, inventoryById, position, team.members]);

  const selectedReplacement = replacementOptions.find(
    (option) => option.inventory.inventoryId === replacementId,
  );
  const experimentAnalysis = useMemo(
    () => (experiment ? analyzeSavedTeamMatrix(experiment.run) : undefined),
    [experiment],
  );
  const comparison = useMemo(
    () =>
      experimentAnalysis
        ? compareTeamAnalyses(baselineAnalysis, experimentAnalysis)
        : undefined,
    [baselineAnalysis, experimentAnalysis],
  );
  const baselineRecord = inventoryById.get(
    team.members[POSITIONS.find((slot) => slot.id === position)!.inventoryKey],
  );
  const projectedBaseline = baselineRecord
    ? projectInventoryForCatalog(baselineRecord, catalog)
    : undefined;
  const baselinePokemon = projectedBaseline
    ? catalogById.get(speciesIdFor(projectedBaseline))
    : undefined;

  function clearExperiment(): void {
    setExperiment(undefined);
    setExperimentError(undefined);
    setConfirmOverwrite(false);
    setCopyOpen(false);
    setSaveError(undefined);
    setSavedCopy(undefined);
  }

  function updatePosition(nextPosition: SavedTeamPosition): void {
    setPosition(nextPosition);
    setReplacementId("");
    clearExperiment();
  }

  async function runWhatIf(): Promise<void> {
    if (!selectedReplacement) return;
    setRunning(true);
    clearExperiment();

    try {
      const members: SavedTeamMembers = { ...team.members };
      const replacementKey =
        POSITIONS.find((slot) => slot.id === position)!.inventoryKey;
      members[replacementKey] = selectedReplacement.inventory.inventoryId;
      const experimentTeam: SavedTeam = { ...team, members };
      const prepared = prepareSavedTeamRankerRequest(
        experimentTeam,
        inventory,
        catalog,
        {
          targetLimit: baseline.scope.targetLimit,
          teamShields: baseline.scope.teamShields,
          targetShields: baseline.scope.targetShields,
        },
      );
      const run = await rankingService.rank(prepared);
      setExperiment({ run, position, replacement: selectedReplacement, members });
    } catch (error) {
      setExperimentError(
        error instanceof Error
          ? error.message
          : "TeamLab could not simulate this replacement.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function overwriteTeam(): Promise<void> {
    if (!experiment) return;
    setSaving(true);
    setSaveError(undefined);

    try {
      const updated = updateSavedTeam(
        team,
        { name: team.name, members: experiment.members, notes: team.notes },
        { inventory, catalog },
      );
      await updateMutation.mutateAsync(updated);
      setConfirmOverwrite(false);
      onTeamUpdated(updated);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "TeamLab could not update this team.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCopy(): Promise<void> {
    if (!experiment) return;
    setSaving(true);
    setSaveError(undefined);

    try {
      const copy = createSavedTeam(
        {
          name: copyName,
          members: experiment.members,
          notes: team.notes,
        },
        { inventory, catalog },
      );
      await createMutation.mutateAsync(copy);
      setSavedCopy(copy);
      setCopyOpen(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "TeamLab could not save this copy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="analysis-panel team-what-if" aria-labelledby="team-what-if-title">
      <header className="team-what-if__header">
        <div>
          <p className="eyebrow">Exact team experiment</p>
          <h2 id="team-what-if-title">What if you change one slot?</h2>
          <p>
            Choose another eligible owned build. TeamLab simulates the exact
            replacement against the same targets, data version, and shield
            scenario as this team report.
          </p>
        </div>
        <span className="team-what-if__scope">
          <Shield aria-hidden="true" size={15} />
          Top {baseline.scope.selectedTargetCount} · your{" "}
          {baseline.scope.teamShields} / opponent {baseline.scope.targetShields}
          {" "}shields
        </span>
      </header>

      <div className="team-what-if__controls">
        <label className="form-field">
          <span>Team position</span>
          <select
            value={position}
            onChange={(event) =>
              updatePosition(event.target.value as SavedTeamPosition)
            }
            disabled={running || saving}
          >
            {POSITIONS.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Replace with owned build</span>
          <select
            value={replacementId}
            onChange={(event) => {
              setReplacementId(event.target.value);
              clearExperiment();
            }}
            disabled={running || saving || replacementOptions.length === 0}
          >
            <option value="">Choose an owned Pokémon</option>
            {replacementOptions.map((option) => (
              <option
                key={option.inventory.inventoryId}
                value={option.inventory.inventoryId}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={running || saving || !selectedReplacement}
          onClick={() => void runWhatIf()}
        >
          <Play aria-hidden="true" size={17} />
          {running
            ? `Simulating ${baseline.scope.selectedTargetCount * 3} battles…`
            : "Compare exact swap"}
        </button>
      </div>

      {replacementOptions.length === 0 ? (
        <p className="team-what-if__empty">
          No other owned build is eligible for this slot under the current
          league and species clause.
        </p>
      ) : null}
      <p className="team-what-if__provenance">
        Preview only · the saved team stays unchanged until you choose how to
        keep a result · data {baseline.result.dataVersion}
      </p>
      {experimentError ? (
        <p className="inventory-error" role="alert">
          {experimentError}
        </p>
      ) : null}

      {experiment && comparison && experimentAnalysis ? (
        <div className="team-what-if__result" aria-live="polite">
          <div className="team-what-if__swap">
            <p className="eyebrow">Compared build</p>
            <div className="team-what-if__swap-line">
              {baselinePokemon ? (
                <PokemonSprite
                  size="small"
                  speciesId={baselinePokemon.speciesId}
                  speciesName={baselinePokemon.speciesName}
                />
              ) : null}
              <span>
                <small>Before · {formatTeamPosition(experiment.position)}</small>
                <strong>{baselinePokemon?.speciesName ?? "Missing build"}</strong>
                {projectedBaseline ? (
                  <small>{optionDetails(projectedBaseline)}</small>
                ) : null}
              </span>
              <ArrowRight aria-hidden="true" size={19} />
              <PokemonSprite
                size="small"
                speciesId={experiment.replacement.pokemon.speciesId}
                speciesName={experiment.replacement.pokemon.speciesName}
              />
              <span>
                <small>After · exact owned build</small>
                <strong>{experiment.replacement.pokemon.speciesName}</strong>
                <small>{optionDetails(experiment.replacement.projected)}</small>
              </span>
            </div>
          </div>

          <div className="team-what-if__coverage-summary">
            <div className="team-what-if__coverage-copy">
              <strong>
                {baselineAnalysis.coverage.coveredTargets} →{" "}
                {experimentAnalysis.coverage.coveredTargets} answered targets
              </strong>
              <small>
                Answered-target counts are unweighted; the Coverage score uses
                rank-weighted matchup ratings.
              </small>
            </div>
            <span
              className={
                comparison.coveredTargetsDelta > 0
                  ? "team-what-if__delta team-what-if__delta--up"
                  : comparison.coveredTargetsDelta < 0
                    ? "team-what-if__delta team-what-if__delta--down"
                    : "team-what-if__delta"
              }
            >
              {comparison.coveredTargetsDelta > 0 ? "+" : ""}
              {comparison.coveredTargetsDelta} targets
            </span>
          </div>

          <div className="team-what-if__score-grid">
            {comparison.scores.map((score) => (
              <article className="team-what-if__score" key={score.id}>
                <span>{score.label}</span>
                <strong>
                  {score.beforeGrade} → {score.afterGrade}
                </strong>
                <p
                  className={
                    score.delta > 0.05
                      ? "team-what-if__score-change team-what-if__score-change--up"
                      : score.delta < -0.05
                        ? "team-what-if__score-change team-what-if__score-change--down"
                        : "team-what-if__score-change"
                  }
                >
                  {score.beforeScore.toFixed(1)} → {score.afterScore.toFixed(1)}
                  <small>/100</small>
                </p>
                <small>
                  Change {formatDelta(score.delta)} pts ·{" "}
                  {score.id === "coverage"
                    ? "TeamLab weighted value"
                    : "PvPoke value"}{" "}
                  {formatScore(score.beforeValue, score.id)} →{" "}
                  {formatScore(score.afterValue, score.id)} /{" "}
                  {score.goal.toLocaleString()}
                </small>
              </article>
            ))}
          </div>

          <div className="team-what-if__answer-grid">
            <AnswerList
              title="Newly answered"
              threats={comparison.newlyCovered}
              tone="gained"
            />
            <AnswerList
              title="Answers lost"
              threats={comparison.noLongerCovered}
              tone="lost"
            />
          </div>

          <section className="team-what-if__threats">
            <div className="team-what-if__section-heading">
              <div>
                <p className="eyebrow">Exact matchup evidence</p>
                <h3>Threat changes</h3>
              </div>
              <span>{comparison.threatChanges.length} changed targets</span>
            </div>
            {comparison.threatChanges.length > 0 ? (
              <>
                <div className="team-what-if__threat-list">
                  {comparison.threatChanges.slice(0, 6).map((change) => (
                    <ThreatChangeRow
                      key={change.speciesId}
                      change={change}
                      position={experiment.position}
                    />
                  ))}
                </div>
                {comparison.threatChanges.length > 6 ? (
                  <details className="team-what-if__more-threats">
                    <summary>
                      View {comparison.threatChanges.length - 6} more changed
                      targets
                    </summary>
                    <div className="team-what-if__threat-list">
                      {comparison.threatChanges.slice(6).map((change) => (
                        <ThreatChangeRow
                          key={change.speciesId}
                          change={change}
                          position={experiment.position}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <p>No threat matchup changed in the selected target scope.</p>
            )}
          </section>

          {savedCopy ? (
            <p className="team-what-if__saved" role="status">
              <Check aria-hidden="true" size={17} />
              Saved as “{savedCopy.name}”.{" "}
              <Link to={`/teams/${savedCopy.teamId}/simulate`}>Open the saved copy</Link>
            </p>
          ) : null}

          <div className="team-what-if__keep-actions">
            {!confirmOverwrite ? (
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  setConfirmOverwrite(true);
                  setCopyOpen(false);
                  setSaveError(undefined);
                }}
              >
                Update saved team
              </button>
            ) : (
              <div className="team-what-if__confirm">
                <p>
                  Replace the saved members of <strong>{team.name}</strong> with
                  this tested lineup?
                </p>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmOverwrite(false)}
                >
                  Keep original
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => void overwriteTeam()}
                >
                  {saving ? "Updating…" : "Confirm update"}
                </button>
              </div>
            )}
            {!copyOpen ? (
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => {
                  setCopyOpen(true);
                  setConfirmOverwrite(false);
                  setSaveError(undefined);
                }}
              >
                <Save aria-hidden="true" size={16} />
                Save as a separate team
              </button>
            ) : (
              <div className="team-what-if__copy-form">
                <label className="form-field">
                  <span>New team name</span>
                  <input
                    maxLength={100}
                    value={copyName}
                    onChange={(event) => setCopyName(event.target.value)}
                    disabled={saving}
                  />
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving || !copyName.trim()}
                  onClick={() => void saveCopy()}
                >
                  {saving ? "Saving…" : "Save copy"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={saving}
                  onClick={() => setCopyOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {saveError ? (
            <p className="inventory-error" role="alert">
              {saveError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
