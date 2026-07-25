import type { InventoryIvs } from "@/domain/inventory/schemas";

export const OPEN_GREAT_LEAGUE_SIMULATION_FORMAT = {
  id: "great-league",
  cpCap: 1500,
  levelCap: 50,
  cup: "all",
} as const;

export type ShieldCount = 0 | 1 | 2;
export type CombatantIndex = 0 | 1;

export interface ExactSimulationBuild {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly level: number;
  readonly cp: number;
  readonly ivs: InventoryIvs;
  readonly fastMoveId: string;
  readonly chargedMoveIds: readonly [string] | readonly [string, string];
  readonly isShadow: boolean;
  readonly source: "inventory-current" | "inventory-planned" | "meta-default";
}

export interface OneOnOneSimulationCombatant {
  readonly build: ExactSimulationBuild;
  readonly shields: ShieldCount;
}

export interface OneOnOneSimulationRequest {
  readonly format: typeof OPEN_GREAT_LEAGUE_SIMULATION_FORMAT;
  readonly combatants: readonly [
    OneOnOneSimulationCombatant,
    OneOnOneSimulationCombatant,
  ];
  readonly dataVersion: string;
}

export interface SimulationCombatantResult {
  readonly index: CombatantIndex;
  readonly speciesId: string;
  readonly battleRating: number;
  readonly remainingHp: number;
  readonly maximumHp: number;
  readonly remainingEnergy: number;
  readonly remainingShields: number;
}

export interface OneOnOneSimulationResult {
  readonly winner: CombatantIndex | "tie";
  readonly combatants: readonly [
    SimulationCombatantResult,
    SimulationCombatantResult,
  ];
  readonly turnsToWin: readonly [number, number];
  readonly dataVersion: string;
  readonly engine: "pvpoke-upstream";
  readonly assumptions: readonly string[];
}

export interface OneOnOneSimulationAdapter {
  simulate(
    request: OneOnOneSimulationRequest,
  ): Promise<OneOnOneSimulationResult>;
}
