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
}
