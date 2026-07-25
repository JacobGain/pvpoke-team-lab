export interface PvpokePokemon {
  readonly speciesId: string;
  readonly stats: { readonly hp: number };
  hp: number;
  energy: number;
  shields: number;
  setIV(stat: "atk" | "def" | "hp", value: number): void;
  setLevel(level: number, initialize?: boolean): void;
  setShadowType(value: "normal" | "shadow"): void;
  selectMove(
    type: "fast" | "charged",
    moveId: string,
    index?: number,
  ): boolean | void;
  setShields(amount: number): void;
}

export interface PvpokeWinner {
  readonly pokemon: PvpokePokemon | false;
}

export interface PvpokeBattle {
  setCP(cp: number): void;
  setLevelCap(levelCap: number): void;
  setCup(cup: string): boolean | void;
  setNewPokemon(
    pokemon: PvpokePokemon,
    index: number,
    initialize?: boolean,
  ): void;
  simulate(): readonly unknown[];
  getPokemon(): readonly [PvpokePokemon, PvpokePokemon];
  getWinner(): PvpokeWinner;
  getBattleRatings(): readonly [number, number];
  getTurnsToWin(): readonly [number, number];
}

export interface PvpokeBattleRuntime {
  ready(): Promise<void>;
  createBattle(): PvpokeBattle;
  createPokemon(
    speciesId: string,
    index: 0 | 1,
    battle: PvpokeBattle,
  ): PvpokePokemon;
  getTeamRanker(): PvpokeTeamRanker;
}

export interface PvpokeTeamRankerSettings {
  shields: number;
  ivs: "original";
  bait: number;
  levelCap: number;
  startHp: number;
  startEnergy: number;
  startCooldown: number;
  optimizeMoveTiming: boolean;
  startStatBuffs: [number, number];
}

export interface RawPvpokeTeamRankerMatchup {
  readonly opponent: PvpokePokemon;
  readonly rating: number;
  readonly score: number;
  readonly time: number;
  readonly breakpoint?: number;
  readonly bulkpoint?: number;
  readonly atkDifferential?: number;
}

export interface RawPvpokeTeamRankerRanking {
  readonly speciesId: string;
  readonly speciesName: string;
  readonly rating: number;
  readonly score: number;
  readonly matchups: readonly RawPvpokeTeamRankerMatchup[];
}

export interface RawPvpokeTeamRankerResult {
  readonly rankings: readonly RawPvpokeTeamRankerRanking[];
  readonly teamRatings: readonly (readonly number[])[];
}

export interface PvpokeTeamRanker {
  setTargets(targets: readonly PvpokePokemon[]): void;
  setShieldMode(mode: "single"): void;
  applySettings(settings: PvpokeTeamRankerSettings, index: 0 | 1): void;
  setRecommendMoveUsage(value: boolean): void;
  setPrioritizeMeta(value: boolean): void;
  rank(
    team: readonly PvpokePokemon[],
    cp: number,
    cup: {
      readonly name: string;
      readonly include: readonly unknown[];
      readonly exclude: readonly unknown[];
    },
    exclusionList: readonly string[],
    context: "matrix",
  ): RawPvpokeTeamRankerResult;
}
