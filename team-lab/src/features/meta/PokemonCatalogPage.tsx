import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import {
  countCatalogDiagnostics,
  type PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import { RankingRow } from "@/features/meta/RankingRow";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

const DISPLAY_LIMIT = 120;

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not build the Pokémon catalog.";
}

function matchesSearch(
  pokemon: PokemonCatalogEntry,
  search: string,
): boolean {
  if (!search) {
    return true;
  }

  return (
    pokemon.speciesName.toLocaleLowerCase().includes(search) ||
    pokemon.speciesId.toLocaleLowerCase().includes(search) ||
    pokemon.types.some((type) => type.includes(search)) ||
    pokemon.fastMoves.some((move) =>
      move.name.toLocaleLowerCase().includes(search),
    ) ||
    pokemon.chargedMoves.some((move) =>
      move.name.toLocaleLowerCase().includes(search),
    )
  );
}

export function PokemonCatalogPage() {
  const { data: catalog, error, isLoading } = usePokemonCatalog();
  const [search, setSearch] = useState("");
  const [showUnranked, setShowUnranked] = useState(false);

  const filteredPokemon = useMemo(() => {
    if (!catalog) {
      return [];
    }

    const normalizedSearch = search.trim().toLocaleLowerCase();

    return catalog.entries.filter(
      (pokemon) =>
        pokemon.isReleased &&
        (showUnranked || pokemon.ranking !== undefined) &&
        matchesSearch(pokemon, normalizedSearch),
    );
  }, [catalog, search, showUnranked]);

  if (isLoading) {
    return (
      <main className="catalog-page">
        <p>Building the Open Great League catalog…</p>
      </main>
    );
  }

  if (error || !catalog) {
    return (
      <main className="catalog-page">
        <Link to="/">← Home</Link>
        <section className="data-card data-card--error" role="alert">
          <p className="eyebrow">Pokémon catalog</p>
          <h1>Catalog unavailable</h1>
          <p>{formatError(error)}</p>
        </section>
      </main>
    );
  }

  const displayedPokemon = filteredPokemon.slice(0, DISPLAY_LIMIT);
  const diagnosticCount = countCatalogDiagnostics(catalog.diagnostics);
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );

  return (
    <main className="catalog-page">
      <PageHeader
        aside={
          <div className="catalog-summary">
            <strong>{filteredPokemon.length.toLocaleString()}</strong>
            <span>matching records</span>
            <small>Data: {catalog.dataVersion}</small>
          </div>
        }
        description={
          <p>
            Validated Pokémon, movepools, rankings, and current meta
            membership from PvPoke.
          </p>
        }
        eyebrow="PvPoke Great League"
        title="Rankings"
      />

      <section className="catalog-controls" aria-label="Catalog filters">
        <label>
          <span>Search species, type, or move</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Try Azumarill, water, or Ice Beam"
          />
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={showUnranked}
            onChange={(event) => {
              setShowUnranked(event.target.checked);
            }}
          />
          Include released Pokémon without published rankings
        </label>
      </section>

      {diagnosticCount > 0 ? (
        <aside className="catalog-notice">
          TeamLab loaded the catalog with {diagnosticCount} non-fatal upstream
          reference {diagnosticCount === 1 ? "issue" : "issues"}. Identity
          conflicts remain fatal.
        </aside>
      ) : null}

      <section className="ranking-list" aria-label="Pokémon ranking results">
        {displayedPokemon.map((pokemon) => (
          <RankingRow
            catalogById={catalogById}
            key={pokemon.speciesId}
            pokemon={pokemon}
          />
        ))}
      </section>

      {displayedPokemon.length === 0 ? (
        <EmptyState
          description={
            <p>Try a species name, type, move, or include unranked Pokémon.</p>
          }
          eyebrow="No matches"
          icon={<SearchX size={26} />}
          title="No Pokémon match these filters"
        />
      ) : null}

      {filteredPokemon.length > DISPLAY_LIMIT ? (
        <p className="catalog-limit">
          Showing the first {DISPLAY_LIMIT} results. Refine the search to
          narrow the catalog.
        </p>
      ) : null}
    </main>
  );
}
