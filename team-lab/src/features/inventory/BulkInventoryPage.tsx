import { useMemo, useState, type FormEvent } from "react";
import { Check, ListPlus } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import {
  createBulkInventoryRecords,
  MAX_BULK_INVENTORY_ENTRIES,
  previewBulkInventory,
} from "@/domain/inventory/bulkAdd";
import { useCreateManyInventoryPokemon } from "@/features/inventory/inventoryQueries";
import { LeagueName } from "@/features/leagues/LeagueSelector";
import { useLeague } from "@/features/leagues/leagueStore";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add this batch.";
}

export function BulkInventoryPage() {
  const league = useLeague();
  const catalogResult = usePokemonCatalog();
  const createMutation = useCreateManyInventoryPokemon();
  const [source, setSource] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const preview = useMemo(
    () =>
      catalogResult.data
        ? previewBulkInventory(source, catalogResult.data)
        : undefined,
    [catalogResult.data, source],
  );

  if (catalogResult.isLoading) {
    return <main className="inventory-page">Loading bulk add…</main>;
  }

  if (!catalogResult.data || catalogResult.error) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <p className="inventory-error" role="alert">
          {formatError(catalogResult.error)}
        </p>
      </main>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || preview.matches.length === 0 || !catalogResult.data) return;

    const count = preview.matches.length;
    setSavedCount(0);
    createMutation.mutate(
      createBulkInventoryRecords(preview.matches, catalogResult.data),
      {
        onSuccess: () => {
          setSavedCount(count);
          setSource("");
        },
      },
    );
  }

  return (
    <main className="inventory-page inventory-form-page">
      <PageHeader
        back={{ to: "/inventory", label: "Inventory" }}
        description={
          <p>
            Paste names or PvPoke IDs to create many usable records at once.
            Refine exact CP, IVs, moves, and forms afterward.
          </p>
        }
        eyebrow={`${league.title} inventory`}
        title="Bulk add Pokémon"
      />

      {savedCount > 0 ? (
        <p className="backup-success" role="status">
          Added {savedCount} Pokémon on this device. <Link to="/inventory">View inventory</Link>.
        </p>
      ) : null}

      <form className="inventory-form" onSubmit={handleSubmit}>
        <section className="form-section bulk-add-panel">
          <p className="eyebrow">Fast roster setup</p>
          <h2>Paste your Pokémon list</h2>
          <p className="form-section__intro">
            Enter one Pokémon per line, or separate entries with commas or
            semicolons. Repeated names create repeated records, up to {MAX_BULK_INVENTORY_ENTRIES} at a time.
          </p>
          <label className="form-field form-field--wide">
            <span>Pokémon names or PvPoke IDs</span>
            <textarea
              autoCapitalize="words"
              onChange={(event) => {
                setSavedCount(0);
                setSource(event.target.value);
              }}
              placeholder={"Azumarill\nAltaria\nstunfisk_galarian"}
              rows={10}
              value={source}
            />
          </label>
          <p className="assumption-notice">
            Each match uses PvPoke’s default <LeagueName /> rank-one IV spread,
            calculated CP, and recommended moves. These assumptions stay visibly
            marked in your inventory.
          </p>
        </section>

        {preview && source.trim() ? (
          <section className="form-section bulk-add-preview" aria-live="polite">
            <div className="form-section__heading">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>{preview.matches.length} ready to add</h2>
              </div>
              {preview.issues.length > 0 ? (
                <span className="context-badge">{preview.issues.length} need attention</span>
              ) : null}
            </div>
            {preview.matches.length > 0 ? (
              <ul className="bulk-add-matches">
                {preview.matches.map(({ input, pokemon }, index) => (
                  <li key={`${input}-${index}`}>
                    <Check aria-hidden="true" size={16} />
                    <span>{pokemon.speciesName}</span>
                    <small>{pokemon.speciesId}</small>
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.issues.length > 0 ? (
              <ul className="bulk-add-issues">
                {preview.issues.map((issue, index) => (
                  <li key={`${issue.input}-${index}`}>
                    <strong>{issue.input}</strong>: {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.truncated ? (
              <p className="inventory-error" role="alert">
                Only the first {MAX_BULK_INVENTORY_ENTRIES} entries are included in this batch.
              </p>
            ) : null}
          </section>
        ) : null}

        {createMutation.error ? (
          <p className="inventory-error" role="alert">
            {formatError(createMutation.error)}
          </p>
        ) : null}

        <div className="form-actions">
          <Link className="secondary-link" to="/inventory">Cancel</Link>
          <button
            className="primary-button"
            disabled={!preview?.matches.length || createMutation.isPending}
            type="submit"
          >
            <ListPlus aria-hidden="true" size={18} />
            {createMutation.isPending
              ? "Adding…"
              : `Add ${preview?.matches.length ?? 0} Pokémon`}
          </button>
        </div>
      </form>
    </main>
  );
}
