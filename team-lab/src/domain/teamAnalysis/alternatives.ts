import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import type { SavedTeamAnalysis } from "@/domain/teamAnalysis/teamAnalysis";

export interface OwnedThreatAlternative {
  readonly source: "owned-exact-build";
  readonly inventoryId: string;
  readonly speciesId: string;
  readonly speciesName: string;
  readonly buildStatus: "current" | "planned";
  readonly cp: number | undefined;
  readonly counterRating: number;
  readonly alternativeRating: number;
}

export interface UnownedThreatAlternative {
  readonly source: "unowned-pvpoke-default";
  readonly speciesId: string;
  readonly speciesName: string;
  readonly counterRating: number;
  readonly alternativeRating: number;
  readonly recommendedMoveIds: readonly string[];
  readonly defaultIvs: {
    readonly level: number;
    readonly attack: number;
    readonly defense: number;
    readonly hp: number;
  };
}

export interface ThreatAlternatives {
  readonly threatSpeciesId: string;
  readonly threatSpeciesName: string;
  readonly threatLevel: string;
  readonly owned: readonly OwnedThreatAlternative[];
  readonly unowned: readonly UnownedThreatAlternative[];
}

export interface TeamAlternativesAnalysis {
  readonly threats: readonly ThreatAlternatives[];
  readonly consideredThreats: number;
  readonly counterEvidenceSource: "pvpoke-overall-ranking-counters";
  readonly dataVersion: string;
}

function selectedSpeciesId(record: InventoryPokemon): string {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetSpeciesId
    : record.speciesId;
}

function selectedCp(record: InventoryPokemon): number | undefined {
  return record.buildStatus === "planned"
    ? record.plannedBuild.targetCp
    : record.currentBuild.cp;
}

function canUseAsAlternative(
  pokemon: PokemonCatalogEntry,
  teamDex: ReadonlySet<number>,
): boolean {
  return (
    pokemon.isReleased &&
    !teamDex.has(pokemon.dex) &&
    pokemon.fastMoves.length > 0 &&
    pokemon.chargedMoves.length > 0
  );
}

export function deriveTeamAlternatives(
  analysis: SavedTeamAnalysis,
  inventory: readonly InventoryPokemon[],
  catalog: PokemonCatalog,
  options: {
    readonly threatLimit?: number;
    readonly alternativesPerSource?: number;
  } = {},
): TeamAlternativesAnalysis {
  const threatLimit = options.threatLimit ?? 5;
  const alternativesPerSource = options.alternativesPerSource ?? 3;
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const teamDex = new Set(
    analysis.members.flatMap((member) => {
      const pokemon = catalogById.get(member.speciesId);
      return pokemon ? [pokemon.dex] : [];
    }),
  );
  const inventoryBySpecies = new Map<string, InventoryPokemon[]>();

  for (const record of inventory) {
    const speciesId = selectedSpeciesId(record);
    const records = inventoryBySpecies.get(speciesId) ?? [];
    records.push(record);
    inventoryBySpecies.set(speciesId, records);
  }

  const threats = analysis.majorThreats
    .slice(0, threatLimit)
    .flatMap((threat): ThreatAlternatives[] => {
      const threatPokemon = catalogById.get(threat.speciesId);
      const counters = threatPokemon?.ranking?.counters;

      if (!threatPokemon || !counters || counters.length === 0) {
        return [];
      }

      const owned: OwnedThreatAlternative[] = [];
      const unowned: UnownedThreatAlternative[] = [];
      const seenOwnedSpecies = new Set<string>();

      for (const counter of counters) {
        const pokemon = catalogById.get(counter.speciesId);

        if (!pokemon || !canUseAsAlternative(pokemon, teamDex)) {
          continue;
        }

        const ownedRecords = inventoryBySpecies.get(pokemon.speciesId) ?? [];

        if (
          ownedRecords.length > 0 &&
          owned.length < alternativesPerSource &&
          !seenOwnedSpecies.has(pokemon.speciesId)
        ) {
          const record = [...ownedRecords].sort((left, right) => {
            if (left.buildStatus !== right.buildStatus) {
              return left.buildStatus === "current" ? -1 : 1;
            }
            return Number(right.favorite) - Number(left.favorite);
          })[0]!;
          owned.push({
            source: "owned-exact-build",
            inventoryId: record.inventoryId,
            speciesId: pokemon.speciesId,
            speciesName: pokemon.speciesName,
            buildStatus: record.buildStatus,
            cp: selectedCp(record),
            counterRating: counter.rating,
            alternativeRating: 1000 - counter.rating,
          });
          seenOwnedSpecies.add(pokemon.speciesId);
          continue;
        }

        if (
          ownedRecords.length === 0 &&
          unowned.length < alternativesPerSource &&
          pokemon.defaultGreatLeagueIvs &&
          pokemon.ranking
        ) {
          unowned.push({
            source: "unowned-pvpoke-default",
            speciesId: pokemon.speciesId,
            speciesName: pokemon.speciesName,
            counterRating: counter.rating,
            alternativeRating: 1000 - counter.rating,
            recommendedMoveIds: pokemon.ranking.recommendedMoveIds,
            defaultIvs: pokemon.defaultGreatLeagueIvs,
          });
        }

        if (
          owned.length >= alternativesPerSource &&
          unowned.length >= alternativesPerSource
        ) {
          break;
        }
      }

      return [
        {
          threatSpeciesId: threat.speciesId,
          threatSpeciesName: threat.speciesName,
          threatLevel: threat.threatLevel,
          owned,
          unowned,
        },
      ];
    });

  return {
    threats,
    consideredThreats: Math.min(
      analysis.majorThreats.length,
      threatLimit,
    ),
    counterEvidenceSource: "pvpoke-overall-ranking-counters",
    dataVersion: catalog.dataVersion,
  };
}
