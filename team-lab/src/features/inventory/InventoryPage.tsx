import { useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  Plus,
  SearchX,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import { findHighestLegalLevel } from "@/domain/analysis/ivRankings";
import { inferCombatPowerLevel } from "@/domain/pokemon/combatPower";
import { requiresCandyXl } from "@/domain/pokemon/xl";
import {
  useDeleteInventoryPokemon,
  useInventoryList,
} from "@/features/inventory/inventoryQueries";
import {
  filterAndSortInventory,
  type InventoryViewSort,
  type InventoryViewStatus,
} from "@/features/inventory/inventoryView";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import {
  formatIdentifier,
  formatMoveList,
  formatMoveName,
} from "@/utils/formatters";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load inventory.";
}

export function InventoryPage() {
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const deleteMutation = useDeleteInventoryPokemon();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InventoryViewStatus>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<InventoryViewSort>("updated");

  const filteredRecords = useMemo(() => {
    return filterAndSortInventory(
      inventoryResult.data ?? [],
      catalogResult.data,
      { search, status, favoriteOnly, sort },
    );
  }, [
    catalogResult.data,
    favoriteOnly,
    inventoryResult.data,
    search,
    sort,
    status,
  ]);

  if (catalogResult.isLoading || inventoryResult.isPending) {
    return <main className="inventory-page">Loading inventory…</main>;
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
      <PageHeader
        actions={
          <>
            <Link className="primary-link" to="/inventory/new">
              <Plus size={18} />
              Add Pokémon
            </Link>
            <Link className="secondary-link" to="/teams">
              <Users size={18} />
              Saved teams
            </Link>
            <Link className="secondary-link" to="/inventory/backup">
              <Archive size={18} />
              Backups & reset
            </Link>
          </>
        }
        aside={
          <div className="catalog-summary">
            <strong>{inventoryResult.data?.length ?? 0}</strong>
            <span>Pokémon in inventory</span>
            <small>Exact builds and future plans</small>
          </div>
        }
        description={
          <p>
            Maintain exact current builds and future plans using the latest
            validated PvPoke catalog.
          </p>
        }
        eyebrow="Open Great League roster"
        title="Your inventory"
      />

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
                event.target.value as InventoryViewStatus,
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
              setSort(event.target.value as InventoryViewSort);
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
          const plannedLevels =
            plan && target
              ? plan.targetCp
                ? inferCombatPowerLevel(
                    target,
                    record.currentBuild.ivProfile.ivs,
                    plan.targetCp,
                  ).matches.map((match) => match.level)
                : [
                    findHighestLegalLevel(
                      target,
                      record.currentBuild.ivProfile.ivs,
                    )?.level,
                  ].filter((level): level is number => level !== undefined)
              : [];

          return (
            <article className="inventory-card" key={record.inventoryId}>
              <PokemonSprite
                size="large"
                speciesId={record.speciesId}
                speciesName={pokemon?.speciesName ?? record.speciesId}
              />
              <div className="inventory-card__content">
                <div className="inventory-card__heading">
                  <div>
                    <p className="eyebrow">
                      {record.buildStatus} build
                      {record.favorite ? " · favorite" : ""}
                    </p>
                    <h2>{pokemon?.speciesName ?? record.speciesId}</h2>
                  </div>
                  <span className="context-badge">
                    CP {record.currentBuild.cp}
                  </span>
                </div>
                {pokemon ? (
                  <div className="type-list">
                    {pokemon.types
                      .filter((type) => type !== "none")
                      .map((type) => (
                      <span
                        className={`type-pill type-pill--${type}`}
                        key={type}
                      >
                        {type}
                      </span>
                      ))}
                    {pokemon.isMeta ? (
                      <span className="type-pill type-pill--meta">Meta</span>
                    ) : null}
                  </div>
                ) : null}
                <p>
                  IVs {record.currentBuild.ivProfile.ivs.attack}/
                  {record.currentBuild.ivProfile.ivs.defense}/
                  {record.currentBuild.ivProfile.ivs.hp} ·{" "}
                  {formatIdentifier(record.currentBuild.ivProfile.source)}
                </p>
                <p>
                  Level{" "}
                  {levelInference?.matches
                    .map((match) => match.level)
                    .join(" or ") ?? "unresolved"}
                  {levelInference?.matches.some((match) =>
                    requiresCandyXl(match.level),
                  ) ? (
                    <span
                      className="xl-badge"
                      title="This build requires Candy XL"
                    >
                      XL
                    </span>
                  ) : null}
                  {" · "}
                  {formatMoveName(record.currentBuild.moveset.fastMoveId)} ·{" "}
                  {formatMoveList(
                    record.currentBuild.moveset.chargedMoveIds,
                  )}
                </p>
                {plan && target ? (
                  <p className="planned-summary">
                    Planned: {target.speciesName}
                    {plan.targetCp
                      ? ` at CP ${plan.targetCp}`
                      : ""}
                    {plannedLevels.length > 0
                      ? ` · Level ${plannedLevels.join(" or ")}`
                      : ""}
                    {plannedLevels.some(requiresCandyXl) ? (
                      <span
                        className="xl-badge"
                        title="This planned build requires Candy XL"
                      >
                        XL
                      </span>
                    ) : null}
                    {" · "}
                    {formatMoveName(plan.desiredMoveset.fastMoveId)} ·{" "}
                    {formatMoveList(plan.desiredMoveset.chargedMoveIds)}
                  </p>
                ) : null}
                {record.notes ? (
                  <p className="inventory-notes">{record.notes}</p>
                ) : null}
                <small>
                  Created {new Date(record.createdAt).toLocaleString()} · updated{" "}
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
        <EmptyState
          actions={
            inventoryResult.data?.length === 0 ? (
              <Link className="primary-link" to="/inventory/new">
                <Plus size={18} />
                Add your first Pokémon
              </Link>
            ) : undefined
          }
          description={
            <p>
              {inventoryResult.data?.length === 0
                ? "Record an exact build to unlock analysis, teams, and personalized recommendations."
                : "Try changing your search, build status, or favorites filter."}
            </p>
          }
          eyebrow={
            inventoryResult.data?.length === 0
              ? "Start your roster"
              : "No matches"
          }
          icon={
            inventoryResult.data?.length === 0 ? (
              <Boxes size={26} />
            ) : (
              <SearchX size={26} />
            )
          }
          title={
            inventoryResult.data?.length === 0
              ? "Your inventory is empty"
              : "No Pokémon match these filters"
          }
        />
      ) : null}
    </main>
  );
}
