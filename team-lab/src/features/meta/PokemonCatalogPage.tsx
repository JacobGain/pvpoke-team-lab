import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import {
  countCatalogDiagnostics,
  type PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { formatMoveList } from "@/utils/formatters";

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

      <section className="catalog-grid" aria-label="Pokémon catalog results">
        {displayedPokemon.map((pokemon) => (
          <article className="pokemon-card" key={pokemon.speciesId}>
            <PokemonSprite
              size="large"
              speciesId={pokemon.speciesId}
              speciesName={pokemon.speciesName}
            />
            <div className="pokemon-card__heading">
              <div>
                <span className="pokemon-card__dex">
                  #{String(pokemon.dex).padStart(4, "0")}
                </span>
                <h2>{pokemon.speciesName}</h2>
              </div>
              {pokemon.ranking ? (
                <span className="rank-badge">#{pokemon.ranking.rank}</span>
              ) : (
                <span className="rank-badge rank-badge--muted">
                  Unranked
                </span>
              )}
            </div>

            <div className="type-list">
              {pokemon.types.filter((type) => type !== "none").map((type) => (
                <span className={`type-pill type-pill--${type}`} key={type}>
                  {type}
                </span>
              ))}
            </div>

            <dl className="pokemon-card__details">
              <div>
                <dt>Recommended</dt>
                <dd>
                  {pokemon.ranking
                    ? formatMoveList(
                        pokemon.ranking.recommendedMoveIds,
                        " · ",
                      )
                    :
                    "No published moveset"}
                </dd>
              </div>
              <div>
                <dt>Movepool</dt>
                <dd>
                  {pokemon.fastMoves.length} fast ·{" "}
                  {pokemon.chargedMoves.length} charged
                </dd>
              </div>
              <div>
                <dt>Default IVs</dt>
                <dd>
                  {pokemon.defaultGreatLeagueIvs
                    ? `${pokemon.defaultGreatLeagueIvs.attack}/${pokemon.defaultGreatLeagueIvs.defense}/${pokemon.defaultGreatLeagueIvs.hp} · L${pokemon.defaultGreatLeagueIvs.level}`
                    : "Not provided"}
                </dd>
              </div>
            </dl>
          </article>
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
