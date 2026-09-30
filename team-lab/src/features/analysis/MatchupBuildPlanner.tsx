import { useEffect, useMemo, useRef, useState } from "react";

import type { AnalyzedPokemonBuild, InventoryBuildAnalysis } from "@/domain/analysis/buildAnalysis";
import {
  createMatchupPlanBaseline,
  createMatchupPlanBuild,
  listMatchupPlanThreats,
  MAX_MATCHUP_PLAN_CANDIDATES,
  MAX_MATCHUP_PLAN_THREATS,
  simulateMatchupBuildPlan,
  type MatchupPlanBuild,
  type MatchupPlanIvSelection,
  type MatchupPlanMovesSelection,
  type MatchupPlanSimulationReport,
  type MatchupPlanThreat,
} from "@/domain/analysis/matchupBuildPlanning";
import type { InventoryIvs } from "@/domain/inventory/schemas";
import { leagueForCatalog } from "@/domain/leagues";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import type { ShieldCount } from "@/domain/simulation/contracts";
import { createPvpokeOneOnOneAdapter } from "@/pvpoke/simulation";
import { formatMoveList, formatMoveName } from "@/utils/formatters";
import "@/styles/modules/matchup-build-planning.css";

type BuildContext = "current" | "planned";
type IvMode = MatchupPlanIvSelection["kind"];
type MovesMode = MatchupPlanMovesSelection["kind"];

interface CompletedPlanRun {
  readonly report: MatchupPlanSimulationReport;
  readonly baseline: MatchupPlanBuild;
  readonly candidates: readonly MatchupPlanBuild[];
  readonly threats: readonly MatchupPlanThreat[];
}

function profileFor(
  analysis: InventoryBuildAnalysis,
  context: BuildContext,
): AnalyzedPokemonBuild | undefined {
  return context === "planned" ? analysis.planned : analysis.current;
}

function formatLevel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

function formatBuild(build: MatchupPlanBuild["build"]): string {
  return `CP ${build.cp} · L${formatLevel(build.level)} · IV ${build.ivs.attack}/${build.ivs.defense}/${build.ivs.hp} · ${formatMoveName(build.fastMoveId)} + ${formatMoveList(build.chargedMoveIds)}`;
}

function outcome(result: NonNullable<MatchupPlanSimulationReport["observations"][number]["result"]>): string {
  if (result.winner === "tie") return "Tie";
  return result.winner === 0 ? "Win" : "Loss";
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

function LevelChoice({
  profile,
  value,
  onChange,
  label,
  disabled,
}: {
  readonly profile: AnalyzedPokemonBuild;
  readonly value: number | undefined;
  readonly onChange: (level: number) => void;
  readonly label: string;
  readonly disabled: boolean;
}) {
  if (profile.levels.length < 2) return null;

  return (
    <label className="matchup-planner__field">
      {label}
      <select
        disabled={disabled}
        value={value ?? profile.levels[0]!.level}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      >
        {profile.levels.map((level) => (
          <option key={level.level} value={level.level}>
            Level {formatLevel(level.level)}
          </option>
        ))}
      </select>
      <small>This CP can map to multiple levels. Select the level to simulate.</small>
    </label>
  );
}

function MatchupOutcome({
  title,
  observation,
  baseline,
}: {
  readonly title: string;
  readonly observation: CompletedPlanRun["report"]["observations"][number] | undefined;
  readonly baseline?: CompletedPlanRun["report"]["observations"][number]["result"];
}) {
  if (!observation) {
    return (
      <article className="matchup-planner__outcome">
        <h4>{title}</h4>
        <p>Not simulated before this run ended.</p>
      </article>
    );
  }
  if (observation.error) {
    return (
      <article className="matchup-planner__outcome">
        <h4>{title}</h4>
        <p className="inventory-error" role="alert">{observation.error}</p>
      </article>
    );
  }
  if (!observation.result) return null;

  const result = observation.result;
  const yourPokemon = result.combatants[0];
  const baselineRating = baseline?.combatants[0].battleRating;

  return (
    <article className="matchup-planner__outcome">
      <h4>{title}</h4>
      <p className="matchup-planner__outcome-line">
        <strong>{outcome(result)}</strong>
        {baseline && baselineRating !== undefined ? (
          <span>
            Outcome {outcome(baseline)} → {outcome(result)} · battle rating{" "}
            {baselineRating.toFixed(1)} → {yourPokemon.battleRating.toFixed(1)}
            {" "}({signed(yourPokemon.battleRating - baselineRating)})
          </span>
        ) : (
          <span>Battle rating {yourPokemon.battleRating.toFixed(1)}</span>
        )}
      </p>
      <p>
        Your build left {yourPokemon.remainingHp}/{yourPokemon.maximumHp} HP ·{" "}
        {yourPokemon.remainingEnergy} energy · {yourPokemon.remainingShields} shields.
      </p>
    </article>
  );
}

function readCustomIvs(values: { readonly attack: string; readonly defense: string; readonly hp: string }): InventoryIvs {
  const parse = (name: string, value: string) => {
    if (!value.trim()) throw new Error(`${name} IV is required.`);
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 15) {
      throw new Error(`${name} IV must be a whole number from 0 to 15.`);
    }
    return parsed;
  };
  return {
    attack: parse("Attack", values.attack),
    defense: parse("Defense", values.defense),
    hp: parse("HP", values.hp),
  };
}

function moveLabel(profile: AnalyzedPokemonBuild, mode: MovesMode): string {
  if (mode === "recommended") return "recommended moves";
  if (mode === "custom") return "custom moves";
  return `${formatMoveName(profile.moves.enteredFastMoveId)} + ${formatMoveList(profile.moves.enteredChargedMoveIds)}`;
}

function ivLabel(profile: AnalyzedPokemonBuild, mode: IvMode): string {
  if (mode === "rank-one") return "rank-one IVs";
  if (mode === "highest-attack") return "high-Attack IVs";
  if (mode === "highest-defense") return "high-Defense IVs";
  if (mode === "custom") return "custom IVs";
  return `${profile.ivs.attack}/${profile.ivs.defense}/${profile.ivs.hp} IVs`;
}

export function MatchupBuildPlanner({
  analysis,
  catalog,
}: {
  readonly analysis: InventoryBuildAnalysis;
  readonly catalog: PokemonCatalog;
}) {
  const [baselineContext, setBaselineContext] = useState<BuildContext>("current");
  const [baselineLevel, setBaselineLevel] = useState<number | undefined>(analysis.current.levels[0]?.level);
  const [candidateContext, setCandidateContext] = useState<BuildContext>(analysis.planned ? "planned" : "current");
  const [candidateLevel, setCandidateLevel] = useState<number | undefined>((analysis.planned ?? analysis.current).levels[0]?.level);
  const [ivMode, setIvMode] = useState<IvMode>("source");
  const [movesMode, setMovesMode] = useState<MovesMode>("source");
  const initialCandidateProfile = analysis.planned ?? analysis.current;
  const [customIvs, setCustomIvs] = useState({
    attack: String(initialCandidateProfile.ivs.attack),
    defense: String(initialCandidateProfile.ivs.defense),
    hp: String(initialCandidateProfile.ivs.hp),
  });
  const [customFastMoveId, setCustomFastMoveId] = useState(initialCandidateProfile.moves.enteredFastMoveId);
  const [customChargedMoveId, setCustomChargedMoveId] = useState(initialCandidateProfile.moves.enteredChargedMoveIds[0] ?? "");
  const [customSecondChargedMoveId, setCustomSecondChargedMoveId] = useState(initialCandidateProfile.moves.enteredChargedMoveIds[1] ?? "");
  const [candidateLabel, setCandidateLabel] = useState("");
  const [candidateError, setCandidateError] = useState<string>();
  const [candidates, setCandidates] = useState<readonly MatchupPlanBuild[]>([]);
  const [selectedThreatIds, setSelectedThreatIds] = useState<readonly string[]>([]);
  const [threatSearch, setThreatSearch] = useState("");
  const [playerShields, setPlayerShields] = useState<ShieldCount>(1);
  const [threatShields, setThreatShields] = useState<ShieldCount>(1);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number; label: string }>();
  const [runError, setRunError] = useState<string>();
  const [completedRun, setCompletedRun] = useState<CompletedPlanRun>();
  const abortController = useRef<AbortController | undefined>(undefined);
  const nextCandidateId = useRef(1);
  const isMounted = useRef(true);
  const league = leagueForCatalog(catalog);

  const baselineContextResolved = baselineContext === "planned" && analysis.planned
    ? "planned"
    : "current";
  const candidateContextResolved = candidateContext === "planned" && analysis.planned
    ? "planned"
    : "current";
  const baselineProfile = profileFor(analysis, baselineContextResolved)!;
  const candidateProfile = profileFor(analysis, candidateContextResolved)!;
  const baselinePokemon = catalog.entries.find((entry) => entry.speciesId === baselineProfile.speciesId);
  const candidatePokemon = catalog.entries.find((entry) => entry.speciesId === candidateProfile.speciesId);
  const planThreats = useMemo(() => listMatchupPlanThreats(catalog), [catalog]);
  const selectedThreats = useMemo(
    () => planThreats.filter((threat) => selectedThreatIds.includes(threat.speciesId)),
    [planThreats, selectedThreatIds],
  );
  const filteredThreats = useMemo(() => {
    const normalized = threatSearch.trim().toLocaleLowerCase();
    return normalized
      ? planThreats.filter((threat) => threat.speciesName.toLocaleLowerCase().includes(normalized))
      : planThreats;
  }, [planThreats, threatSearch]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortController.current?.abort();
    };
  }, []);

  function invalidateResults() {
    setCompletedRun(undefined);
    setRunError(undefined);
    setProgress(undefined);
  }

  function changeCandidateContext(context: BuildContext) {
    const profile = profileFor(analysis, context);
    if (!profile) return;
    setCandidateContext(context);
    setCandidateLevel(profile.levels[0]?.level);
    setCustomIvs({
      attack: String(profile.ivs.attack),
      defense: String(profile.ivs.defense),
      hp: String(profile.ivs.hp),
    });
    setCustomFastMoveId(profile.moves.enteredFastMoveId);
    setCustomChargedMoveId(profile.moves.enteredChargedMoveIds[0] ?? "");
    setCustomSecondChargedMoveId(profile.moves.enteredChargedMoveIds[1] ?? "");
    setIvMode("source");
    setMovesMode("source");
    setCandidateLabel("");
    setCandidateError(undefined);
    invalidateResults();
  }

  function addCandidate() {
    setCandidateError(undefined);
    if (candidates.length >= MAX_MATCHUP_PLAN_CANDIDATES) {
      setCandidateError(`Add up to ${MAX_MATCHUP_PLAN_CANDIDATES} build candidates per comparison.`);
      return;
    }
    if (!candidatePokemon || candidateLevel === undefined) {
      setCandidateError("This build does not have a supported simulation level.");
      return;
    }

    try {
      const ivSelection: MatchupPlanIvSelection = ivMode === "custom"
        ? { kind: "custom", ivs: readCustomIvs(customIvs) }
        : { kind: ivMode };
      const movesSelection: MatchupPlanMovesSelection = movesMode === "custom"
        ? {
            kind: "custom",
            moveset: {
              fastMoveId: customFastMoveId,
              chargedMoveIds: [
                customChargedMoveId,
                ...(customSecondChargedMoveId ? [customSecondChargedMoveId] : []),
              ],
            },
          }
        : { kind: movesMode };
      const label = candidateLabel.trim() ||
        `${candidateProfile.speciesName} · ${ivLabel(candidateProfile, ivMode)} · ${moveLabel(candidateProfile, movesMode)}`;
      const candidate = createMatchupPlanBuild({
        id: `build-plan-${nextCandidateId.current++}`,
        label,
        profile: candidateProfile,
        pokemon: candidatePokemon,
        cpCap: league.cp,
        sourceLevel: candidateLevel,
        ivSelection,
        movesSelection,
      });
      const duplicate = candidates.some((existing) => {
        const left = existing.build;
        const right = candidate.build;
        return left.speciesId === right.speciesId &&
          left.level === right.level &&
          left.cp === right.cp &&
          left.ivs.attack === right.ivs.attack &&
          left.ivs.defense === right.ivs.defense &&
          left.ivs.hp === right.ivs.hp &&
          left.fastMoveId === right.fastMoveId &&
          left.chargedMoveIds.join("|") === right.chargedMoveIds.join("|") &&
          left.isShadow === right.isShadow;
      });
      if (duplicate) {
        throw new Error("That exact build is already in the comparison.");
      }
      setCandidates((previous) => [...previous, candidate]);
      setCandidateLabel("");
      invalidateResults();
    } catch (error) {
      setCandidateError(error instanceof Error ? error.message : "TeamLab could not add that build candidate.");
    }
  }

  function toggleThreat(speciesId: string, checked: boolean) {
    setCandidateError(undefined);
    invalidateResults();
    setSelectedThreatIds((previous) => {
      if (checked) {
        if (previous.includes(speciesId) || previous.length >= MAX_MATCHUP_PLAN_THREATS) return previous;
        return [...previous, speciesId];
      }
      return previous.filter((id) => id !== speciesId);
    });
  }

  async function runComparison() {
    setCandidateError(undefined);
    setRunError(undefined);
    setCompletedRun(undefined);
    setProgress(undefined);
    if (!baselinePokemon || baselineLevel === undefined) {
      setRunError("Choose one valid level for the baseline build before simulating.");
      return;
    }
    if (candidates.length === 0) {
      setRunError("Add at least one build candidate to compare.");
      return;
    }
    if (selectedThreats.length === 0) {
      setRunError("Choose at least one meta threat to simulate against.");
      return;
    }

    const controller = new AbortController();
    abortController.current = controller;
    setRunning(true);
    try {
      const baseline = createMatchupPlanBaseline({
        label: `${baselineProfile.speciesName} ${baselineContextResolved} build`,
        profile: baselineProfile,
        pokemon: baselinePokemon,
        level: baselineLevel,
      });
      const input = {
        catalog,
        baseline,
        candidates,
        threats: selectedThreats,
        scenario: { playerShields, threatShields },
      } as const;
      const report = await simulateMatchupBuildPlan(
        input,
        createPvpokeOneOnOneAdapter(catalog.dataVersion),
        {
          signal: controller.signal,
          onProgress: (event) => {
            if (!isMounted.current) return;
            setProgress({
              completed: event.completed,
              total: event.total,
              label: `${event.buildLabel} vs ${event.threatName}`,
            });
          },
          yieldBetweenBattles: () => new Promise((resolve) => window.setTimeout(resolve, 0)),
        },
      );
      if (!isMounted.current) return;
      setCompletedRun({ report, baseline, candidates: [...candidates], threats: [...selectedThreats] });
      if (report.completedCount === 0 && report.failureCount === 0 && !report.cancelled) {
        setRunError("No matchup simulations were completed.");
      }
    } catch (error) {
      if (isMounted.current) {
        setRunError(error instanceof Error ? error.message : "TeamLab could not simulate these builds.");
      }
    } finally {
      if (isMounted.current) {
        setRunning(false);
        setProgress(undefined);
      }
      abortController.current = undefined;
    }
  }

  const selectedBaselineLevel = baselineProfile.levels.some((level) => level.level === baselineLevel)
    ? baselineLevel
    : baselineProfile.levels[0]?.level;
  const selectedCandidateLevel = candidateProfile.levels.some((level) => level.level === candidateLevel)
    ? candidateLevel
    : candidateProfile.levels[0]?.level;
  const recommendedMovesAvailable = Boolean(
    candidateProfile.moves.recommendedFastMoveId &&
    candidateProfile.moves.recommendedChargedMoveIds.length > 0,
  );
  const matchingVariantId = (threatId: string, buildId: string) =>
    completedRun?.report.observations.find((observation) =>
      observation.threatSpeciesId === threatId && observation.buildId === buildId,
    );

  return (
    <section className="analysis-panel matchup-planner" aria-labelledby="matchup-planner-title">
      <header className="matchup-planner__header">
        <div>
          <p className="eyebrow">Exact PvPoke simulations</p>
          <h2 id="matchup-planner-title">Matchup-backed build planning</h2>
          <p>
            Compare the current or planned build with temporary IV and move options against selected {league.title} threats.
          </p>
        </div>
        <span className="matchup-planner__data-version">Data {catalog.dataVersion}</span>
      </header>

      <p className="analysis-notice">
        A different IV spread represents another specimen; it cannot change an owned Pokémon’s IVs. Alternate spreads use the highest legal level up to level 50. Experiments stay temporary and do not update inventory.
      </p>

      <div className="matchup-planner__setup">
        <section className="matchup-planner__setup-card">
          <h3>Baseline build</h3>
          <label className="matchup-planner__field">
            Compare against
            <select
              disabled={running}
              value={baselineContextResolved}
              onChange={(event) => {
                const next = event.currentTarget.value as BuildContext;
                setBaselineContext(next);
                setBaselineLevel(profileFor(analysis, next)?.levels[0]?.level);
                invalidateResults();
              }}
            >
              <option value="current">Current build</option>
              {analysis.planned ? <option value="planned">Planned build</option> : null}
            </select>
          </label>
          <p className="matchup-planner__build-summary">{baselinePokemon?.speciesName} · CP {baselineProfile.cp} · IV {baselineProfile.ivs.attack}/{baselineProfile.ivs.defense}/{baselineProfile.ivs.hp}</p>
          <LevelChoice
            profile={baselineProfile}
            value={selectedBaselineLevel}
            onChange={(level) => { setBaselineLevel(level); invalidateResults(); }}
            label="Baseline level"
            disabled={running}
          />
        </section>

        <section className="matchup-planner__setup-card">
          <h3>Threats</h3>
          <p>Select up to {MAX_MATCHUP_PLAN_THREATS} ranked Pokémon from the active league.</p>
          <p>Each threat uses its published default league IVs and recommended moves.</p>
          <details className="matchup-planner__threat-picker">
            <summary>Choose threats ({selectedThreats.length}/{MAX_MATCHUP_PLAN_THREATS})</summary>
            <label className="matchup-planner__field">
              Filter threats
              <input
                type="search"
                value={threatSearch}
                disabled={running}
                onChange={(event) => setThreatSearch(event.currentTarget.value)}
                placeholder="Search by Pokémon name"
              />
            </label>
            {planThreats.length === 0 ? (
              <p>No ranked threats have a supported default build in this league.</p>
            ) : (
              <div className="matchup-planner__threat-list">
                {filteredThreats.map((threat) => {
                  const checked = selectedThreatIds.includes(threat.speciesId);
                  const rank = catalog.entries.find((entry) => entry.speciesId === threat.speciesId)?.ranking?.rank;
                  return (
                    <label key={threat.speciesId} className="matchup-planner__threat-option">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={running || (!checked && selectedThreatIds.length >= MAX_MATCHUP_PLAN_THREATS)}
                        onChange={(event) => toggleThreat(threat.speciesId, event.currentTarget.checked)}
                      />
                      <span>{rank ? `#${rank} ` : ""}{threat.speciesName}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </details>
          <p className="matchup-planner__selected-threats">
            {selectedThreats.length > 0
              ? selectedThreats.map((threat) => threat.speciesName).join(" · ")
              : "No threats selected yet."}
          </p>
        </section>

        <section className="matchup-planner__setup-card">
          <h3>Shield scenario</h3>
          <p>Each run uses one explicit scenario. Change the pair and rerun to compare another; results are not averaged.</p>
          <div className="matchup-planner__fields matchup-planner__fields--two">
            <label className="matchup-planner__field">
              Your shields
              <select disabled={running} value={playerShields} onChange={(event) => { setPlayerShields(Number(event.currentTarget.value) as ShieldCount); invalidateResults(); }}>
                <option value={0}>0 shields</option><option value={1}>1 shield</option><option value={2}>2 shields</option>
              </select>
            </label>
            <label className="matchup-planner__field">
              Threat shields
              <select disabled={running} value={threatShields} onChange={(event) => { setThreatShields(Number(event.currentTarget.value) as ShieldCount); invalidateResults(); }}>
                <option value={0}>0 shields</option><option value={1}>1 shield</option><option value={2}>2 shields</option>
              </select>
            </label>
          </div>
        </section>

        <section className="matchup-planner__setup-card matchup-planner__candidate-editor">
          <h3>Build candidate</h3>
          <div className="matchup-planner__fields matchup-planner__fields--two">
            <label className="matchup-planner__field">
              Start from
              <select disabled={running} value={candidateContextResolved} onChange={(event) => changeCandidateContext(event.currentTarget.value as BuildContext)}>
                <option value="current">Current build</option>
                {analysis.planned ? <option value="planned">Planned build</option> : null}
              </select>
            </label>
            {ivMode === "source" ? (
              <LevelChoice
                profile={candidateProfile}
                value={selectedCandidateLevel}
                onChange={(level) => { setCandidateLevel(level); invalidateResults(); }}
                label="Source build level"
                disabled={running}
              />
            ) : null}
            <label className="matchup-planner__field">
              IV spread
              <select disabled={running} value={ivMode} onChange={(event) => { setIvMode(event.currentTarget.value as IvMode); invalidateResults(); }}>
                <option value="source">Keep source IVs</option>
                <option value="rank-one">Stat-product rank one</option>
                <option value="highest-attack">Highest Attack</option>
                <option value="highest-defense">Highest Defense</option>
                <option value="custom">Custom IVs</option>
              </select>
            </label>
            <label className="matchup-planner__field">
              Moveset
              <select disabled={running} value={movesMode} onChange={(event) => { setMovesMode(event.currentTarget.value as MovesMode); invalidateResults(); }}>
                <option value="source">Keep source moves</option>
                <option value="recommended" disabled={!recommendedMovesAvailable}>PvPoke recommended</option>
                <option value="custom">Choose moves</option>
              </select>
            </label>
          </div>

          {ivMode === "custom" ? (
            <div className="matchup-planner__fields matchup-planner__fields--three">
              {(["attack", "defense", "hp"] as const).map((stat) => (
                <label className="matchup-planner__field" key={stat}>
                  {stat === "hp" ? "HP" : `${stat[0]!.toUpperCase()}${stat.slice(1)}`} IV
                  <input
                    type="number"
                    min="0"
                    max="15"
                    step="1"
                    value={customIvs[stat]}
                    disabled={running}
                    onChange={(event) => { setCustomIvs((previous) => ({ ...previous, [stat]: event.currentTarget.value })); invalidateResults(); }}
                  />
                </label>
              ))}
            </div>
          ) : null}

          {movesMode === "custom" && candidatePokemon ? (
            <div className="matchup-planner__fields matchup-planner__fields--three">
              <label className="matchup-planner__field">
                Fast move
                <select disabled={running || candidatePokemon.fastMoves.length === 0} value={customFastMoveId} onChange={(event) => { setCustomFastMoveId(event.currentTarget.value); invalidateResults(); }}>
                  {candidatePokemon.fastMoves.map((move) => <option key={move.id} value={move.id}>{move.name}</option>)}
                </select>
              </label>
              <label className="matchup-planner__field">
                Charged move 1
                <select disabled={running || candidatePokemon.chargedMoves.length === 0} value={customChargedMoveId} onChange={(event) => {
                  const nextMoveId = event.currentTarget.value;
                  setCustomChargedMoveId(nextMoveId);
                  if (nextMoveId === customSecondChargedMoveId) setCustomSecondChargedMoveId("");
                  invalidateResults();
                }}>
                  {candidatePokemon.chargedMoves.map((move) => <option key={move.id} value={move.id}>{move.name}</option>)}
                </select>
              </label>
              <label className="matchup-planner__field">
                Charged move 2 (optional)
                <select disabled={running} value={customSecondChargedMoveId} onChange={(event) => { setCustomSecondChargedMoveId(event.currentTarget.value); invalidateResults(); }}>
                  <option value="">None</option>
                  {candidatePokemon.chargedMoves.filter((move) => move.id !== customChargedMoveId).map((move) => <option key={move.id} value={move.id}>{move.name}</option>)}
                </select>
              </label>
            </div>
          ) : null}

          <div className="matchup-planner__fields matchup-planner__fields--two">
            <label className="matchup-planner__field">
              Candidate label (optional)
              <input maxLength={60} value={candidateLabel} disabled={running} onChange={(event) => { setCandidateLabel(event.currentTarget.value); invalidateResults(); }} placeholder="For example: higher-Attack spread" />
            </label>
          </div>
          {ivMode !== "source" ? (
          <p className="matchup-planner__fit-note">This alternate IV spread is fit to the highest legal level in {league.shortTitle}, up to level 50. It represents a different specimen; CP and level may differ from the source build.</p>
          ) : null}
          {movesMode === "recommended" ? (
            <p className="matchup-planner__fit-note">PvPoke recommended moves are a simulation option. Elite/TM availability is not inferred as an exact resource cost.</p>
          ) : null}
          {candidateError ? <p className="inventory-error" role="alert">{candidateError}</p> : null}
          <button className="secondary-button" type="button" disabled={running || candidates.length >= MAX_MATCHUP_PLAN_CANDIDATES} onClick={addCandidate}>
            Add candidate ({candidates.length}/{MAX_MATCHUP_PLAN_CANDIDATES})
          </button>
        </section>
      </div>

      {candidates.length > 0 ? (
        <section className="matchup-planner__candidate-list" aria-label="Build candidates to compare">
          <h3>Builds to compare</h3>
          {candidates.map((candidate) => (
            <article className="matchup-planner__candidate" key={candidate.id}>
              <div><strong>{candidate.label}</strong><span>{formatBuild(candidate.build)}</span></div>
              <button className="secondary-button" type="button" disabled={running} aria-label={`Remove ${candidate.label}`} onClick={() => { setCandidates((previous) => previous.filter((entry) => entry.id !== candidate.id)); invalidateResults(); }}>Remove</button>
            </article>
          ))}
        </section>
      ) : null}

      <div className="matchup-planner__actions">
        {running ? (
          <button className="secondary-button" type="button" onClick={() => abortController.current?.abort()}>Cancel after current matchup</button>
        ) : (
          <button className="primary-button" type="button" disabled={candidates.length === 0 || selectedThreats.length === 0} onClick={() => void runComparison()}>
            Simulate {candidates.length + 1} builds against {selectedThreats.length} {selectedThreats.length === 1 ? "threat" : "threats"}
          </button>
        )}
      </div>
      {progress ? (
        <section className="matchup-planner__progress" aria-live="polite">
          <strong>{progress.label}</strong>
          <span>Matchups {progress.completed}/{progress.total}</span>
          <progress value={progress.completed} max={Math.max(progress.total, 1)} />
        </section>
      ) : null}
      {runError ? <p className="inventory-error" role="alert">{runError}</p> : null}

      {completedRun ? (
        <section className="matchup-planner__results" aria-live="polite">
          <header>
            <div>
              <h3>Simulation results</h3>
              <p>
                {completedRun.report.scenario.playerShields} player shields vs {completedRun.report.scenario.threatShields} threat shields · Data {completedRun.report.dataVersion}
              </p>
            </div>
            {completedRun.report.cancelled ? <strong>Partial run · cancelled after current matchup</strong> : null}
          </header>
          {completedRun.report.failureCount > 0 ? <p className="analysis-notice">{completedRun.report.failureCount} matchup{completedRun.report.failureCount === 1 ? "" : "s"} could not be simulated. Other completed results remain available.</p> : null}
          <div className="matchup-planner__result-list">
            {completedRun.threats.map((threat) => {
              const baselineObservation = matchingVariantId(threat.speciesId, completedRun.baseline.id);
              const baselineResult = baselineObservation?.result;
              const threatPokemon = catalog.entries.find((entry) => entry.speciesId === threat.speciesId);
              const threatRank = threatPokemon?.ranking?.rank;
              return (
                <article className="matchup-planner__threat-result" key={threat.speciesId}>
                  <header>
                    <div>
                      <p className="eyebrow">{threatRank ? `#${threatRank} ` : ""}Selected threat</p>
                      <h4>{threat.speciesName}</h4>
                      <p>{formatBuild(threat.build)}</p>
                    </div>
                  </header>
                  <MatchupOutcome title={`Baseline · ${completedRun.baseline.label}`} observation={baselineObservation} />
                  {completedRun.candidates.map((candidate) => (
                    <MatchupOutcome
                      key={candidate.id}
                      title={candidate.label}
                      observation={matchingVariantId(threat.speciesId, candidate.id)}
                      baseline={baselineResult}
                    />
                  ))}
                </article>
              );
            })}
          </div>
          <details className="matchup-planner__assumptions">
            <summary>Simulation assumptions</summary>
            <p>Exact builds and the chosen shield counts were used with the bundled PvPoke engine. Each opponent uses its published default league IVs and recommended moves. Results are one-on-one matchups and do not model starting energy, switching, or a full three-Pokémon battle.</p>
            {completedRun.report.observations.find((observation) => observation.result)?.result?.assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}
          </details>
        </section>
      ) : null}
    </section>
  );
}
