import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";

import {
  createInventoryBackup,
  inspectInventoryBackup,
  serializeInventoryBackup,
  type InventoryBackupInspection,
} from "@/domain/inventory/backup";
import type { InventoryRestoreMode } from "@/domain/inventory/repository";
import {
  useClearInventory,
  useInventoryList,
  useRestoreInventory,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The inventory operation failed.";
}

function downloadBackup(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InventoryBackupPage() {
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const restoreMutation = useRestoreInventory();
  const clearMutation = useClearInventory();
  const [inspection, setInspection] = useState<InventoryBackupInspection>();
  const [selectedFilename, setSelectedFilename] = useState("");
  const [restoreMode, setRestoreMode] =
    useState<InventoryRestoreMode>("merge");

  if (catalogResult.isLoading || inventoryResult.isPending) {
    return <main className="inventory-page">Loading backup tools…</main>;
  }

  const loadError = catalogResult.error ?? inventoryResult.error;

  if (!catalogResult.data || loadError) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <p className="inventory-error" role="alert">
          {formatError(loadError)}
        </p>
      </main>
    );
  }

  const catalog = catalogResult.data;
  const records = inventoryResult.data ?? [];

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    restoreMutation.reset();
    if (!file) {
      setInspection(undefined);
      setSelectedFilename("");
      return;
    }

    setSelectedFilename(file.name);
    setInspection(inspectInventoryBackup(await file.text(), catalog));
  }

  function handleExport() {
    const backup = createInventoryBackup(records);
    const date = backup.exportedAt.slice(0, 10);
    downloadBackup(
      serializeInventoryBackup(backup),
      `teamlab-inventory-${date}.json`,
    );
  }

  function handleRestore() {
    if (!inspection?.success) {
      return;
    }

    if (
      restoreMode === "replace" &&
      !window.confirm(
        "Replace the entire local inventory with this backup? Records not in the backup will be deleted.",
      )
    ) {
      return;
    }

    restoreMutation.mutate({
      records: inspection.backup.inventory,
      mode: restoreMode,
    });
  }

  return (
    <main className="inventory-page backup-page">
      <header className="form-page-header">
        <Link to="/inventory">← Inventory</Link>
        <p className="eyebrow">Local data safety</p>
        <h1>Backup and restore</h1>
        <p>
          Export a portable, versioned TeamLab JSON backup or validate a backup
          completely before changing IndexedDB.
        </p>
      </header>

      <section className="form-section backup-section">
        <div>
          <p className="eyebrow">Export</p>
          <h2>Download a recovery copy</h2>
          <p>
            The backup contains {records.length} inventory{" "}
            {records.length === 1 ? "record" : "records"}, record schema
            versions, and export metadata.
          </p>
        </div>
        <button type="button" onClick={handleExport}>
          Download JSON backup
        </button>
      </section>

      <section className="form-section">
        <p className="eyebrow">Import</p>
        <h2>Inspect a backup</h2>
        <label className="file-picker">
          <span>Select TeamLab JSON</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void handleFile(event);
            }}
          />
        </label>

        {inspection ? (
          inspection.success ? (
            <div className="backup-inspection backup-inspection--valid">
              <strong>{selectedFilename} is valid</strong>
              <span>
                {inspection.backup.inventory.length} records · exported{" "}
                {new Date(inspection.backup.exportedAt).toLocaleString()}
              </span>
            </div>
          ) : (
            <div
              className="backup-inspection backup-inspection--invalid"
              role="alert"
            >
              <strong>{selectedFilename} cannot be restored</strong>
              {inspection.envelopeError ? (
                <p>{inspection.envelopeError}</p>
              ) : null}
              {inspection.recordCount !== undefined ? (
                <p>
                  Checked all {inspection.recordCount} records and found{" "}
                  {inspection.issues.length} blocking{" "}
                  {inspection.issues.length === 1 ? "issue" : "issues"}.
                </p>
              ) : null}
              {inspection.issues.length > 0 ? (
                <ol>
                  {inspection.issues.map((issue) => (
                    <li key={`${issue.index}-${issue.kind}`}>
                      Record {issue.index + 1}
                      {issue.inventoryId ? ` (${issue.inventoryId})` : ""}:{" "}
                      {issue.message}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          )
        ) : null}

        {inspection?.success ? (
          <div className="restore-controls">
            <fieldset>
              <legend>Restore behavior</legend>
              <label>
                <input
                  type="radio"
                  name="restore-mode"
                  checked={restoreMode === "merge"}
                  onChange={() => {
                    setRestoreMode("merge");
                  }}
                />
                <span>
                  <strong>Merge</strong>
                  Keep unrelated local records. Backup records replace matching
                  inventory IDs.
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="restore-mode"
                  checked={restoreMode === "replace"}
                  onChange={() => {
                    setRestoreMode("replace");
                  }}
                />
                <span>
                  <strong>Replace</strong>
                  Make the backup authoritative and remove other local records.
                </span>
              </label>
            </fieldset>
            <button
              type="button"
              disabled={restoreMutation.isPending}
              onClick={handleRestore}
            >
              {restoreMutation.isPending ? "Restoring…" : "Restore inventory"}
            </button>
          </div>
        ) : null}

        {restoreMutation.error ? (
          <p className="inventory-error" role="alert">
            {formatError(restoreMutation.error)}
          </p>
        ) : null}
        {clearMutation.error ? (
          <p className="inventory-error" role="alert">
            {formatError(clearMutation.error)}
          </p>
        ) : null}
        {restoreMutation.data ? (
          <p className="backup-success" role="status">
            Restore complete: {restoreMutation.data.inserted} inserted,{" "}
            {restoreMutation.data.updated} updated,{" "}
            {restoreMutation.data.removed} removed. Local inventory now has{" "}
            {restoreMutation.data.finalCount} records.
          </p>
        ) : null}
      </section>

      <section className="form-section danger-zone">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h2>Clear local inventory</h2>
          <p>
            This permanently removes all inventory records from this browser.
            Download a backup first if you may need them.
          </p>
        </div>
        <button
          type="button"
          disabled={records.length === 0 || clearMutation.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Permanently delete all ${records.length} local inventory records?`,
              )
            ) {
              clearMutation.mutate();
            }
          }}
        >
          {clearMutation.isPending ? "Clearing…" : "Clear inventory"}
        </button>
      </section>
      {clearMutation.isSuccess ? (
        <p className="backup-success" role="status">
          Local inventory cleared.
        </p>
      ) : null}
    </main>
  );
}
