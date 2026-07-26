import {
  OPEN_GREAT_LEAGUE_SIMULATION_FORMAT,
  type ExactSimulationBuild,
  type OneOnOneSimulationAdapter,
  type OneOnOneSimulationRequest,
  type OneOnOneSimulationResult,
  type ShieldCount,
  type TeamRankerAdapter,
  type TeamRankerResult,
} from "@/domain/simulation/contracts";

export interface SimulationCharacterizationCase {
  readonly id: string;
  readonly description: string;
  readonly shields: readonly [ShieldCount, ShieldCount];
  readonly builds: readonly [ExactSimulationBuild, ExactSimulationBuild];
}

export interface SimulationCharacterizationObservation {
  readonly caseId: string;
  readonly description: string;
  readonly deterministic: boolean;
  readonly durationMs: number;
  readonly result: OneOnOneSimulationResult;
  readonly invariantFailures: readonly string[];
}

export interface SimulationCharacterizationReport {
  readonly reportVersion: 1;
  readonly generatedAt: string;
  readonly dataVersion: string;
  readonly passed: boolean;
  readonly observations: readonly SimulationCharacterizationObservation[];
}

export interface TeamRankerCharacterizationReport {
  readonly reportVersion: 1;
  readonly generatedAt: string;
  readonly dataVersion: string;
  readonly passed: boolean;
  readonly deterministic: boolean;
  readonly durationMs: number;
  readonly result: TeamRankerResult;
  readonly invariantFailures: readonly string[];
}

function build(
  values: Omit<ExactSimulationBuild, "source">,
): ExactSimulationBuild {
  return { ...values, source: "meta-default" };
}

export function createOpenGreatLeagueCharacterizationCases(): readonly SimulationCharacterizationCase[] {
  return [
    {
      id: "azumarill-vs-altaria-1s",
      description:
        "Default Great League Azumarill versus Altaria with one shield each.",
      shields: [1, 1],
      builds: [
        build({
          speciesId: "azumarill",
          speciesName: "Azumarill",
          level: 45.5,
          cp: 1499,
          ivs: { attack: 0, defense: 15, hp: 15 },
          fastMoveId: "BUBBLE",
          chargedMoveIds: ["ICE_BEAM", "PLAY_ROUGH"],
          isShadow: false,
        }),
        build({
          speciesId: "altaria",
          speciesName: "Altaria",
          level: 29,
          cp: 1497,
          ivs: { attack: 0, defense: 14, hp: 15 },
          fastMoveId: "DRAGON_BREATH",
          chargedMoveIds: ["SKY_ATTACK", "MOONBLAST"],
          isShadow: false,
        }),
      ],
    },
    {
      id: "whiscash-vs-altaria-0s",
      description:
        "Default Great League Whiscash versus Altaria with no shields.",
      shields: [0, 0],
      builds: [
        build({
          speciesId: "whiscash",
          speciesName: "Whiscash",
          level: 27,
          cp: 1495,
          ivs: { attack: 4, defense: 15, hp: 15 },
          fastMoveId: "MUD_SHOT",
          chargedMoveIds: ["SCALD", "BLIZZARD"],
          isShadow: false,
        }),
        build({
          speciesId: "altaria",
          speciesName: "Altaria",
          level: 29,
          cp: 1497,
          ivs: { attack: 0, defense: 14, hp: 15 },
          fastMoveId: "DRAGON_BREATH",
          chargedMoveIds: ["SKY_ATTACK", "MOONBLAST"],
          isShadow: false,
        }),
      ],
    },
  ];
}

function createRequest(
  testCase: SimulationCharacterizationCase,
  dataVersion: string,
): OneOnOneSimulationRequest {
  return {
    format: OPEN_GREAT_LEAGUE_SIMULATION_FORMAT,
    combatants: [
      { build: testCase.builds[0], shields: testCase.shields[0] },
      { build: testCase.builds[1], shields: testCase.shields[1] },
    ],
    dataVersion,
  };
}

function stableResult(result: OneOnOneSimulationResult): string {
  return JSON.stringify({
    winner: result.winner,
    combatants: result.combatants,
    turnsToWin: result.turnsToWin,
    dataVersion: result.dataVersion,
    engine: result.engine,
  });
}

function validateResult(
  result: OneOnOneSimulationResult,
  testCase: SimulationCharacterizationCase,
  dataVersion: string,
): readonly string[] {
  const failures: string[] = [];

  const observedEngine = (result as { readonly engine: string }).engine;
  if (observedEngine !== "pvpoke-upstream") {
    failures.push(`Unexpected engine ${observedEngine}.`);
  }
  if (result.dataVersion !== dataVersion) {
    failures.push(
      `Expected data version ${dataVersion}, received ${result.dataVersion}.`,
    );
  }

  for (const [index, combatant] of result.combatants.entries()) {
    if (combatant.speciesId !== testCase.builds[index]!.speciesId) {
      failures.push(
        `Combatant ${index} resolved as ${combatant.speciesId} instead of ${testCase.builds[index]!.speciesId}.`,
      );
    }
    if (combatant.battleRating < 0 || combatant.battleRating > 1000) {
      failures.push(`Combatant ${index} has invalid battle rating.`);
    }
    if (
      combatant.remainingHp < 0 ||
      combatant.remainingHp > combatant.maximumHp
    ) {
      failures.push(`Combatant ${index} has invalid remaining HP.`);
    }
    if (
      combatant.remainingEnergy < 0 ||
      combatant.remainingEnergy > 100
    ) {
      failures.push(`Combatant ${index} has invalid remaining energy.`);
    }
    if (
      combatant.remainingShields < 0 ||
      combatant.remainingShields > testCase.shields[index]!
    ) {
      failures.push(`Combatant ${index} has invalid remaining shields.`);
    }
  }

  return failures;
}

export async function runSimulationCharacterizationSuite(
  adapter: OneOnOneSimulationAdapter,
  dataVersion: string,
  cases = createOpenGreatLeagueCharacterizationCases(),
  now: () => Date = () => new Date(),
): Promise<SimulationCharacterizationReport> {
  const observations: SimulationCharacterizationObservation[] = [];

  for (const testCase of cases) {
    const request = createRequest(testCase, dataVersion);
    const startedAt = performance.now();
    const first = await adapter.simulate(request);
    const second = await adapter.simulate(request);
    const durationMs = performance.now() - startedAt;
    const deterministic = stableResult(first) === stableResult(second);
    const invariantFailures = [
      ...validateResult(first, testCase, dataVersion),
      ...(deterministic
        ? []
        : ["Repeated execution produced a different translated result."]),
    ];

    observations.push({
      caseId: testCase.id,
      description: testCase.description,
      deterministic,
      durationMs,
      result: first,
      invariantFailures,
    });
  }

  return {
    reportVersion: 1,
    generatedAt: now().toISOString(),
    dataVersion,
    passed: observations.every(
      (observation) => observation.invariantFailures.length === 0,
    ),
    observations,
  };
}

function stableRankerResult(result: TeamRankerResult): string {
  return JSON.stringify({
    rankings: result.rankings,
    teamRatings: result.teamRatings,
    teamBulkValues: result.teamBulkValues,
    teamConsistencyScores: result.teamConsistencyScores,
    battleCount: result.battleCount,
    dataVersion: result.dataVersion,
    engine: result.engine,
  });
}

export async function runTeamRankerCharacterization(
  adapter: TeamRankerAdapter,
  dataVersion: string,
  now: () => Date = () => new Date(),
): Promise<TeamRankerCharacterizationReport> {
  const cases = createOpenGreatLeagueCharacterizationCases();
  const azumarill = cases[0]!.builds[0];
  const altaria = cases[0]!.builds[1];
  const whiscash = cases[1]!.builds[0];
  const request = {
    team: [azumarill, altaria],
    targets: [whiscash],
    teamShields: 1 as const,
    targetShields: 1 as const,
    dataVersion,
  };
  const startedAt = performance.now();
  const first = await adapter.rank(request);
  const second = await adapter.rank(request);
  const durationMs = performance.now() - startedAt;
  const deterministic = stableRankerResult(first) === stableRankerResult(second);
  const failures: string[] = [];

  if (first.engine !== "pvpoke-team-ranker") {
    failures.push("Unexpected TeamRanker engine identity.");
  }
  if (first.dataVersion !== dataVersion) {
    failures.push("TeamRanker data version does not match the catalog.");
  }
  if (first.battleCount !== 2) {
    failures.push(`Expected 2 battles, received ${first.battleCount}.`);
  }
  if (first.rankings.length !== 1 || first.rankings[0]?.speciesId !== "whiscash") {
    failures.push("Explicit Whiscash target was not preserved.");
  }
  if (first.rankings[0]?.matchups.length !== 2) {
    failures.push("Expected one matchup per team member.");
  }
  if (!deterministic) {
    failures.push("Repeated TeamRanker execution produced different results.");
  }

  return {
    reportVersion: 1,
    generatedAt: now().toISOString(),
    dataVersion,
    passed: failures.length === 0,
    deterministic,
    durationMs,
    result: first,
    invariantFailures: failures,
  };
}
