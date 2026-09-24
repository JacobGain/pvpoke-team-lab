import { useLeague } from "@/features/leagues/leagueStore";
import { useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  ListPlus,
  Plus,
  SearchX,
  Users,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import { findHighestLegalLevel } from "@/domain/analysis/ivRankings";
import { isPreferredInLeague, projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
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
  formatCalendarDate,
  formatIdentifier,
  formatMoveList,
  formatMoveName,
} from "@/utils/formatters";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load inventory.";
}

export function InventoryPage() {
  const league = useLeague();
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const deleteMutation = useDeleteInventoryPokemon();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sort, setSort] = useState<InventoryViewSort>("updated");
  const [leagueFilter, setLeagueFilter] = useState<"preferred" | "eligible" | "all">("preferred");
  const statusParam = searchParams.get("status");
  const status: InventoryViewStatus =
    statusParam === "current" || statusParam === "planned"
      ? statusParam
      : "all";
  const assumedIvsOnly = searchParams.get("ivs") === "assumed";

  function setFilterParameter(name: string, value?: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  const filteredRecords = useMemo(() => {
    return filterAndSortInventory(
      leagueFilter !== "all" && catalogResult.data
        ? (inventoryResult.data ?? []).filter((record) => leagueFilter === "preferred"
          ? isPreferredInLeague(record, catalogResult.data!)
          : projectInventoryForCatalog(record, catalogResult.data!) !== undefined)
        : inventoryResult.data ?? [],
      catalogResult.data,
      { search, status, favoriteOnly, assumedIvsOnly, sort },
    );
  }, [
    catalogResult.data,
    assumedIvsOnly,
    favoriteOnly,
    inventoryResult.data,
    leagueFilter,
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
            <Link className="secondary-link" to="/inventory/bulk-add">
              <ListPlus size={18} />
              Bulk add
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
            <small>
              Stored only in this browser until its site data is cleared.
            </small>
          </div>
        }
        description={
          <p>
            Maintain exact current builds and future plans using the latest
            validated PvPoke catalog.
          </p>
        }
        eyebrow={`${league.title} roster`}
        title="Your inventory"
      />

      <section className="inventory-controls" aria-label="Inventory filters">
        <label>
          <span>League eligibility</span>
          <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value as "preferred" | "eligible" | "all")}>
            <option value="preferred">Best fit for {league.shortTitle}</option>
            <option value="eligible">Eligible for {league.shortTitle}</option>
            <option value="all">All owned Pokémon</option>
          </select>
        </label>
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
              const nextStatus = event.target.value as InventoryViewStatus;
              setFilterParameter(
                "status",
                nextStatus === "all" ? undefined : nextStatus,
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
        <div className="inventory-filter-toggles">
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
          <label className="check-control">
            <input
              type="checkbox"
              checked={assumedIvsOnly}
              onChange={(event) => {
                setFilterParameter(
                  "ivs",
                  event.target.checked ? "assumed" : undefined,
                );
              }}
            />
            Assumed IVs only
          </label>
        </div>
      </section>

      {error ? (
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      ) : null}

      <section className="inventory-grid" aria-label="Saved inventory">
        {filteredRecords.map((record) => {
          const eligibleBuild = projectInventoryForCatalog(record, catalog);
          const displayed = eligibleBuild ?? record;
          const displayPokemon = catalog.entries.find((entry) => entry.speciesId === displayed.speciesId);
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
                speciesId={displayed.speciesId}
                speciesName={displayPokemon?.speciesName ?? displayed.speciesId}
              />
              <div className="inventory-card__content">
                <div className="inventory-card__heading">
                  <div>
                    <p className="eyebrow">
                      {record.buildStatus} build
                      {record.favorite ? " · favorite" : ""}
                    </p>
                    <h2>{displayPokemon?.speciesName ?? displayed.speciesId}</h2>
                  </div>
                  <span className="context-badge">
                    CP {displayed.currentBuild.cp}
                  </span>
                </div>
                {displayPokemon ? (
                  <div className="type-list">
                    {displayPokemon.types
                      .filter((type) => type !== "none")
                      .map((type) => (
                      <span
                        className={`type-pill type-pill--${type}`}
                        key={type}
                      >
                        {type}
                      </span>
                      ))}
                    {displayPokemon.isMeta ? (
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
                {record.megaSpeciesId ? <p className="planned-summary">Mega enabled: {catalog.entries.find((entry) => entry.speciesId === record.megaSpeciesId)?.speciesName ?? record.megaSpeciesId}</p> : null}
                {!eligibleBuild ? <p className="planned-summary">Outside the {league.shortTitle} CP cap</p> : null}
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
                  Created: {formatCalendarDate(record.createdAt)} · Last updated:{" "}
                  {formatCalendarDate(record.updatedAt)}
                </small>
              </div>
              <div className="inventory-card__actions">
                <Link
                  className="secondary-link"
                  to={`/inventory/${record.inventoryId}`}
                >
                  Edit
                </Link>
                {eligibleBuild ? <Link
                  className="primary-link"
                  to={`/inventory/${record.inventoryId}/analysis`}
                >
                  Analyze
                </Link> : null}
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
