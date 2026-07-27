import { PVPOKE_ENGINE_SCRIPT_PATHS } from "@/pvpoke/assetPaths";
import type {
  PvpokeBattle,
  PvpokeBattleRuntime,
  PvpokePokemon,
  PvpokeTeamRanker,
} from "@/pvpoke/simulation/runtime";

interface PvpokeGameMaster {
  readonly data: {
    readonly pokemon?: readonly unknown[];
    readonly moves?: readonly unknown[];
  };
}

interface PvpokeGlobals {
  GameMaster?: {
    getInstance(): PvpokeGameMaster;
  };
  Battle?: new () => PvpokeBattle;
  Pokemon?: new (
    speciesId: string,
    index: number,
    battle: PvpokeBattle,
  ) => PvpokePokemon;
  RankerMaster?: {
    getInstance(): PvpokeTeamRanker;
  };
  getDefaultMultiBattleSettings?: () => Record<string, unknown>;
  host?: string;
  webRoot?: string;
  siteVersion?: string;
  settings?: Record<string, unknown>;
}

export class PvpokeEngineBootstrapError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PvpokeEngineBootstrapError";
    this.cause = cause;
  }
}

export interface BrowserPvpokeRuntimeOptions {
  readonly baseUrl: string;
  readonly dataVersion: string;
  readonly timeoutMs?: number;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function loadClassicScript(path: string): Promise<void> {
  const existing = [...document.scripts].find(
    (script) => script.dataset.teamLabPvpoke === path,
  );

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${path}.`)),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = path;
    script.async = false;
    script.dataset.teamLabPvpoke = path;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${path}.`)),
      { once: true },
    );
    document.head.append(script);
  });
}

function waitForGameMaster(
  globals: PvpokeGlobals,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const gameMaster = globals.GameMaster?.getInstance();

      if (
        gameMaster?.data.pokemon?.length &&
        gameMaster.data.moves?.length
      ) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(
          new PvpokeEngineBootstrapError(
            `PvPoke Game Master did not become ready within ${timeoutMs}ms.`,
          ),
        );
        return;
      }

      window.setTimeout(check, 25);
    };

    check();
  });
}

export class BrowserPvpokeRuntime implements PvpokeBattleRuntime {
  private bootstrapPromise?: Promise<void>;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly options: BrowserPvpokeRuntimeOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  ready(): Promise<void> {
    this.bootstrapPromise ??= this.bootstrap();
    return this.bootstrapPromise;
  }

  createBattle(): PvpokeBattle {
    const BattleConstructor = this.globals().Battle;

    if (!BattleConstructor) {
      throw new PvpokeEngineBootstrapError(
        "PvPoke Battle is unavailable before engine bootstrap.",
      );
    }

    return new BattleConstructor();
  }

  createPokemon(
    speciesId: string,
    index: 0 | 1,
    battle: PvpokeBattle,
  ): PvpokePokemon {
    const PokemonConstructor = this.globals().Pokemon;

    if (!PokemonConstructor) {
      throw new PvpokeEngineBootstrapError(
        "PvPoke Pokemon is unavailable before engine bootstrap.",
      );
    }

    return new PokemonConstructor(speciesId, index, battle);
  }

  getTeamRanker(): PvpokeTeamRanker {
    const ranker = this.globals().RankerMaster?.getInstance();

    if (!ranker) {
      throw new PvpokeEngineBootstrapError(
        "PvPoke TeamRanker is unavailable before engine bootstrap.",
      );
    }

    return ranker;
  }

  private globals(): PvpokeGlobals {
    return window as unknown as PvpokeGlobals;
  }

  private async bootstrap(): Promise<void> {
    const globals = this.globals();
    globals.host = window.location.origin;
    globals.webRoot = `${this.baseUrl}/`;
    globals.siteVersion = this.options.dataVersion;
    globals.settings = {
      defaultIVs: "gamemaster",
      animateTimeline: 0,
      matrixDirection: "row",
      gamemaster: "gamemaster",
      pokeboxId: 0,
      pokeboxLastDateTime: 0,
      xls: false,
      rankingDetails: "one-page",
      hardMovesetLinks: 0,
      colorblindMode: 0,
      performanceMode: 1,
      theme: "default",
    };
    globals.getDefaultMultiBattleSettings = () => ({
      shields: 1,
      ivs: "original",
      bait: 1,
      levelCap: 50,
      startHp: 1,
      startEnergy: 0,
      startCooldown: 0,
      optimizeMoveTiming: true,
      startStatBuffs: [0, 0],
    });

    try {
      for (const scriptPath of PVPOKE_ENGINE_SCRIPT_PATHS) {
        await loadClassicScript(`${this.baseUrl}/${scriptPath}`);
      }
      await waitForGameMaster(globals, this.timeoutMs);

      if (!globals.Battle || !globals.Pokemon || !globals.RankerMaster) {
        throw new Error(
          "PvPoke scripts loaded without exposing Battle, Pokemon, and TeamRanker.",
        );
      }
    } catch (error) {
      throw error instanceof PvpokeEngineBootstrapError
        ? error
        : new PvpokeEngineBootstrapError(
            "TeamLab could not bootstrap the PvPoke battle engine.",
            error,
          );
    }
  }
}
