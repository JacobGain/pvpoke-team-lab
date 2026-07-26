import { useMemo, useRef, useState } from "react";
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

const PAGE_SIZE = 100;

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
  const [currentPage, setCurrentPage] = useState(1);
  const rankingListRef = useRef<HTMLElement>(null);

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

  const totalPages = Math.max(
    Math.ceil(filteredPokemon.length / PAGE_SIZE),
    1,
  );
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * PAGE_SIZE;
  const displayedPokemon = filteredPokemon.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const diagnosticCount = countCatalogDiagnostics(catalog.diagnostics);
  const catalogById = new Map(
    catalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );

  function goToPage(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    requestAnimationFrame(() => {
      rankingListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

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
              setCurrentPage(1);
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
              setCurrentPage(1);
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

      <section
        className="ranking-list"
        aria-label="Pokémon ranking results"
        ref={rankingListRef}
      >
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

      {filteredPokemon.length > 0 ? (
        <footer className="catalog-pagination">
          {totalPages > 1 ? (
            <nav aria-label="Rankings pages">
              <button
                disabled={activePage === 1}
                onClick={() => goToPage(activePage - 1)}
                type="button"
              >
                Previous
              </button>
              <div className="catalog-pagination__pages">
                {Array.from({ length: totalPages }, (_, index) => {
                  const page = index + 1;

                  return (
                    <button
                      aria-current={page === activePage ? "page" : undefined}
                      key={page}
                      onClick={() => goToPage(page)}
                      type="button"
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={activePage === totalPages}
                onClick={() => goToPage(activePage + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          ) : null}
          <p>
            Showing {pageStart + 1}–
            {Math.min(pageStart + PAGE_SIZE, filteredPokemon.length)} of{" "}
            {filteredPokemon.length.toLocaleString()} results. Refine the
            search to narrow the catalog.
          </p>
        </footer>
      ) : null}
    </main>
  );
}
