import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  createInventoryPokemon,
  touchInventoryPokemon,
} from "@/domain/inventory/factory";
import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";
import {
  useCreateInventoryPokemon,
  useDeleteInventoryPokemon,
  useInventoryList,
  useUpdateInventoryPokemon,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "An unknown error occurred.";
}

function eligibleEntries(
  entries: readonly PokemonCatalogEntry[],
): readonly PokemonCatalogEntry[] {
  return entries.filter(
    (pokemon) =>
      pokemon.isReleased &&
      pokemon.defaultGreatLeagueIvs !== undefined &&
      pokemon.fastMoves.length > 0 &&
      pokemon.chargedMoves.length > 0,
  );
}

export function InventoryPersistencePage() {
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const createMutation = useCreateInventoryPokemon();
  const updateMutation = useUpdateInventoryPokemon();
  const deleteMutation = useDeleteInventoryPokemon();
  const [speciesId, setSpeciesId] = useState("");
  const [cp, setCp] = useState(1500);

  const pokemonOptions = useMemo(
    () => eligibleEntries(catalogResult.data?.entries ?? []),
    [catalogResult.data],
  );
  const selectedPokemon =
    pokemonOptions.find((pokemon) => pokemon.speciesId === speciesId) ??
    pokemonOptions[0];

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!catalogResult.data || !selectedPokemon) {
      return;
    }

    const recommendedMoves = selectedPokemon.ranking?.recommendedMoveIds;
    const recommendedFastMove = selectedPokemon.fastMoves.find((move) =>
      recommendedMoves?.includes(move.id),
    );
    const recommendedChargedMoves = selectedPokemon.chargedMoves.filter(
      (move) => recommendedMoves?.includes(move.id),
    );
    const record = createInventoryPokemon(
      {
        buildStatus: "current",
        speciesId: selectedPokemon.speciesId,
        currentBuild: {
          cp,
          ivProfile: { source: "assumed-rank-1" },
          moveset: {
            fastMoveId:
              recommendedFastMove?.id ?? selectedPokemon.fastMoves[0]!.id,
            chargedMoveIds: (
              recommendedChargedMoves.length > 0
                ? recommendedChargedMoves
                : selectedPokemon.chargedMoves.slice(0, 2)
            ).map((move) => move.id),
          },
        },
      },
      { catalog: catalogResult.data },
    );

    createMutation.mutate(record);
  }

  const error =
    catalogResult.error ??
    inventoryResult.error ??
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error;

  if (catalogResult.isLoading || inventoryResult.isPending) {
    return (
      <main className="inventory-page">
        <p>Loading the catalog and local inventory…</p>
      </main>
    );
  }

  if (!catalogResult.data || catalogResult.error) {
    return (
      <main className="inventory-page">
        <Link to="/">← Home</Link>
        <section className="data-card data-card--error" role="alert">
          <h1>Inventory unavailable</h1>
          <p>{formatError(catalogResult.error)}</p>
        </section>
      </main>
    );
  }

  const catalog = catalogResult.data;

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <Link to="/">← Home</Link>
          <p className="eyebrow">Phase 2 verification</p>
          <h1>Local inventory</h1>
          <p>
            This deliberately small interface verifies validated IndexedDB
            create, read, update, and delete behavior before the full manual
            entry workflow is designed.
          </p>
        </div>
        <div className="catalog-summary">
          <strong>{inventoryResult.data?.length ?? 0}</strong>
          <span>saved locally</span>
          <small>Reload this page to verify persistence.</small>
        </div>
      </header>

      <form className="inventory-create" onSubmit={handleCreate}>
        <label>
          <span>Pokémon</span>
          <select
            value={selectedPokemon?.speciesId ?? ""}
            onChange={(event) => {
              setSpeciesId(event.target.value);
            }}
          >
            {pokemonOptions.map((pokemon) => (
              <option value={pokemon.speciesId} key={pokemon.speciesId}>
                {pokemon.speciesName}
                {pokemon.isShadow ? " (Shadow)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>CP</span>
          <input
            type="number"
            min="10"
            max="1500"
            value={cp}
            onChange={(event) => {
              setCp(event.currentTarget.valueAsNumber);
            }}
          />
        </label>
        <button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving…" : "Add verification record"}
        </button>
        <small>
          Uses the catalog’s explicit rank-one IV assumption and recommended
          moves where available.
        </small>
      </form>

      {error ? (
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      ) : null}

      <section className="inventory-grid" aria-label="Saved inventory">
        {(inventoryResult.data ?? []).map((record) => {
          const pokemon = catalog.entries.find(
            (entry) => entry.speciesId === record.speciesId,
          );

          return (
            <article className="inventory-card" key={record.inventoryId}>
              <div>
                <p className="eyebrow">{record.buildStatus} build</p>
                <h2>{pokemon?.speciesName ?? record.speciesId}</h2>
                <p>
                  CP {record.currentBuild.cp} ·{" "}
                  {record.currentBuild.ivProfile.ivs.attack}/
                  {record.currentBuild.ivProfile.ivs.defense}/
                  {record.currentBuild.ivProfile.ivs.hp}
                </p>
                <small>
                  {record.currentBuild.ivProfile.source} ·{" "}
                  {record.currentBuild.moveset.fastMoveId} ·{" "}
                  {record.currentBuild.moveset.chargedMoveIds.join(" / ")}
                </small>
              </div>
              <div className="inventory-card__actions">
                <button
                  type="button"
                  onClick={() => {
                    updateMutation.mutate(
                      touchInventoryPokemon({
                        ...record,
                        favorite: !record.favorite,
                      }),
                    );
                  }}
                >
                  {record.favorite ? "★ Favorited" : "☆ Favorite"}
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    deleteMutation.mutate(record.inventoryId);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {inventoryResult.data?.length === 0 ? (
        <p className="catalog-empty">
          No local records yet. Add one above, then reload the page.
        </p>
      ) : null}
    </main>
  );
}
