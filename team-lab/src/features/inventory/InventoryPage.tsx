import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { inferCombatPowerLevel } from "@/domain/pokemon/combatPower";
import {
  useDeleteInventoryPokemon,
  useInventoryList,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load inventory.";
}

export function InventoryPage() {
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const deleteMutation = useDeleteInventoryPokemon();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "current" | "planned">("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<"updated" | "species" | "cp">("updated");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const catalog = catalogResult.data;

    return [...(inventoryResult.data ?? [])]
      .filter((record) => {
        const pokemon = catalog?.entries.find(
          (entry) => entry.speciesId === record.speciesId,
        );

        return (
          (status === "all" || record.buildStatus === status) &&
          (!favoriteOnly || record.favorite) &&
          (!normalizedSearch ||
            record.speciesId.toLocaleLowerCase().includes(normalizedSearch) ||
            pokemon?.speciesName
              .toLocaleLowerCase()
              .includes(normalizedSearch) ||
            record.notes.toLocaleLowerCase().includes(normalizedSearch))
        );
      })
      .sort((left, right) => {
        if (sort === "cp") {
          return right.currentBuild.cp - left.currentBuild.cp;
        }

        if (sort === "species") {
          const leftName =
            catalog?.entries.find(
              (entry) => entry.speciesId === left.speciesId,
            )?.speciesName ?? left.speciesId;
          const rightName =
            catalog?.entries.find(
              (entry) => entry.speciesId === right.speciesId,
            )?.speciesName ?? right.speciesId;
          return leftName.localeCompare(rightName);
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      });
  }, [
    catalogResult.data,
    favoriteOnly,
    inventoryResult.data,
    search,
    sort,
    status,
  ]);

  if (catalogResult.isLoading || inventoryResult.isPending) {
    return <main className="inventory-page">Loading local inventory…</main>;
  }

  const error =
    catalogResult.error ?? inventoryResult.error ?? deleteMutation.error;

  if (!catalogResult.data || catalogResult.error) {
    return (
      <main className="inventory-page">
        <Link to="/">← Home</Link>
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      </main>
    );
  }

  const catalog = catalogResult.data;

  return (
    <main className="inventory-page">
      <header className="inventory-header">
        <div>
          <Link to="/">← Home</Link>
          <p className="eyebrow">Open Great League</p>
          <h1>Your inventory</h1>
          <p>
            Maintain exact current builds and future plans using the latest
            validated PvPoke catalog.
          </p>
          <div className="home-actions">
            <Link className="primary-link" to="/inventory/new">
              Add Pokémon
            </Link>
            <Link className="secondary-link" to="/inventory/backup">
              Backup and restore
            </Link>
          </div>
        </div>
        <div className="catalog-summary">
          <strong>{inventoryResult.data?.length ?? 0}</strong>
          <span>saved locally</span>
          <small>IndexedDB · this browser</small>
        </div>
      </header>

      <section className="inventory-controls" aria-label="Inventory filters">
        <label>
          <span>Search species or notes</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Azumarill or tournament"
          />
        </label>
        <label>
          <span>Build status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target.value as "all" | "current" | "planned",
              );
            }}
          >
            <option value="all">All builds</option>
            <option value="current">Current</option>
            <option value="planned">Planned</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "updated" | "species" | "cp");
            }}
          >
            <option value="updated">Recently updated</option>
            <option value="species">Species name</option>
            <option value="cp">Highest CP</option>
          </select>
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(event) => {
              setFavoriteOnly(event.target.checked);
            }}
          />
          Favorites only
        </label>
      </section>

      {error ? (
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      ) : null}

      <section className="inventory-grid" aria-label="Saved inventory">
        {filteredRecords.map((record) => {
          const pokemon = catalog.entries.find(
            (entry) => entry.speciesId === record.speciesId,
          );
          const plan =
            record.buildStatus === "planned" ? record.plannedBuild : undefined;
          const target =
            plan
              ? catalog.entries.find(
                  (entry) =>
                    entry.speciesId === plan.targetSpeciesId,
                )
              : undefined;
          const levelInference = pokemon
            ? inferCombatPowerLevel(
                pokemon,
                record.currentBuild.ivProfile.ivs,
                record.currentBuild.cp,
              )
            : undefined;

          return (
            <article className="inventory-card" key={record.inventoryId}>
              <div className="inventory-card__content">
                <div className="inventory-card__heading">
                  <div>
                    <p className="eyebrow">
                      {record.buildStatus} build
                      {record.favorite ? " · favorite" : ""}
                    </p>
                    <h2>{pokemon?.speciesName ?? record.speciesId}</h2>
                  </div>
                  <span className="rank-badge">
                    CP {record.currentBuild.cp}
                  </span>
                </div>
                <p>
                  IVs {record.currentBuild.ivProfile.ivs.attack}/
                  {record.currentBuild.ivProfile.ivs.defense}/
                  {record.currentBuild.ivProfile.ivs.hp} ·{" "}
                  {record.currentBuild.ivProfile.source}
                </p>
                <p>
                  Level{" "}
                  {levelInference?.matches
                    .map((match) => match.level)
                    .join(" or ") ?? "unresolved"}
                  {" · "}
                  {record.currentBuild.moveset.fastMoveId} ·{" "}
                  {record.currentBuild.moveset.chargedMoveIds.join(" / ")}
                </p>
                {plan && target ? (
                  <p className="planned-summary">
                    Planned: {target.speciesName}
                    {plan.targetCp
                      ? ` at CP ${plan.targetCp}`
                      : ""}
                    {" · "}
                    {plan.desiredMoveset.fastMoveId} ·{" "}
                    {plan.desiredMoveset.chargedMoveIds.join(" / ")}
                  </p>
                ) : null}
                {record.notes ? (
                  <p className="inventory-notes">{record.notes}</p>
                ) : null}
                <small>
                  Source {record.sourceDataVersion} · updated{" "}
                  {new Date(record.updatedAt).toLocaleString()}
                </small>
              </div>
              <div className="inventory-card__actions">
                <Link
                  className="secondary-link"
                  to={`/inventory/${record.inventoryId}`}
                >
                  Edit
                </Link>
                <Link
                  className="primary-link"
                  to={`/inventory/${record.inventoryId}/analysis`}
                >
                  Analyze
                </Link>
                <Link
                  className="secondary-link"
                  to={`/inventory/new?duplicate=${record.inventoryId}`}
                >
                  Duplicate
                </Link>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${pokemon?.speciesName ?? record.speciesId} from your inventory?`,
                      )
                    ) {
                      deleteMutation.mutate(record.inventoryId);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {filteredRecords.length === 0 ? (
        <p className="catalog-empty">
          {inventoryResult.data?.length === 0
            ? "Your inventory is empty. Add your first Great League Pokémon."
            : "No inventory records match these filters."}
        </p>
      ) : null}
    </main>
  );
}
