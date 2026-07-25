import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";

import {
  createTeamLabBackup,
  inspectTeamLabBackup,
  serializeTeamLabBackup,
  type TeamLabBackupInspection,
  type TeamLabRestoreMode,
} from "@/domain/backup/teamLabBackup";
import { useRestoreTeamLabBackup } from "@/features/backup/backupQueries";
import {
  useClearInventory,
  useInventoryList,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";

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
  const savedTeamsResult = useSavedTeamList();
  const restoreMutation = useRestoreTeamLabBackup();
  const clearMutation = useClearInventory();
  const [inspection, setInspection] = useState<TeamLabBackupInspection>();
  const [selectedFilename, setSelectedFilename] = useState("");
  const [exportError, setExportError] = useState<unknown>();
  const [restoreMode, setRestoreMode] =
    useState<TeamLabRestoreMode>("merge");

  if (
    catalogResult.isLoading ||
    inventoryResult.isPending ||
    savedTeamsResult.isPending
  ) {
    return <main className="inventory-page">Loading backup tools…</main>;
  }

  const loadError =
    catalogResult.error ?? inventoryResult.error ?? savedTeamsResult.error;

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
  const savedTeams = savedTeamsResult.data ?? [];

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    restoreMutation.reset();
    if (!file) {
      setInspection(undefined);
      setSelectedFilename("");
      return;
    }

    setSelectedFilename(file.name);
    setInspection(inspectTeamLabBackup(await file.text(), catalog));
  }

  function handleExport() {
    setExportError(undefined);

    try {
      const backup = createTeamLabBackup(records, savedTeams, catalog);
      const date = backup.exportedAt.slice(0, 10);
      downloadBackup(
        serializeTeamLabBackup(backup),
        `teamlab-backup-${date}.json`,
      );
    } catch (error) {
      setExportError(error);
    }
  }

  function handleRestore() {
    if (!inspection?.success) {
      return;
    }

    if (
      restoreMode === "replace" &&
      !window.confirm(
        "Replace all local inventory and saved teams with this backup? Data not in the backup will be deleted.",
      )
    ) {
      return;
    }

    restoreMutation.mutate({
      backup: inspection.backup,
      mode: restoreMode,
      catalog,
    });
  }

  return (
    <main className="inventory-page backup-page">
      <header className="form-page-header">
        <Link to="/inventory">← Inventory</Link>
        <p className="eyebrow">Local data safety</p>
        <h1>Backup and restore</h1>
        <p>
          Export inventory and saved teams in one portable TeamLab JSON backup,
          or validate every record and reference before changing IndexedDB.
        </p>
      </header>

      <section className="form-section backup-section">
        <div>
          <p className="eyebrow">Export</p>
          <h2>Download a recovery copy</h2>
          <p>
            The backup contains {records.length} inventory{" "}
            {records.length === 1 ? "record" : "records"} and{" "}
            {savedTeams.length} saved{" "}
            {savedTeams.length === 1 ? "team" : "teams"}, plus their schema
            versions and export metadata.
          </p>
        </div>
        <button type="button" onClick={handleExport}>
          Download JSON backup
        </button>
      </section>
      {exportError ? (
        <p className="inventory-error" role="alert">
          The current local data cannot produce a restorable backup.{" "}
          {formatError(exportError)}
        </p>
      ) : null}

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
                {inspection.backup.inventory.length} inventory records ·{" "}
                {inspection.backup.savedTeams.length} saved teams · schema{" "}
                {inspection.backup.sourceSchemaVersion} · exported{" "}
                {new Date(inspection.backup.exportedAt).toLocaleString()}
              </span>
              {inspection.backup.sourceSchemaVersion === 1 ? (
                <small>
                  Legacy inventory-only backup: it contains no saved teams.
                </small>
              ) : null}
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
              {inspection.inventoryCount !== undefined ? (
                <p>
                  Checked {inspection.inventoryCount} inventory records and{" "}
                  {inspection.savedTeamCount ?? 0} saved teams and found{" "}
                  {inspection.issues.length} blocking{" "}
                  {inspection.issues.length === 1 ? "issue" : "issues"}.
                </p>
              ) : null}
              {inspection.issues.length > 0 ? (
                <ol>
                  {inspection.issues.map((issue) => (
                    <li
                      key={`${issue.collection}-${issue.index}-${issue.kind}`}
                    >
                      {issue.collection === "inventory"
                        ? "Inventory"
                        : "Saved team"}{" "}
                      record {issue.index + 1}
                      {issue.recordId ? ` (${issue.recordId})` : ""}:{" "}
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
                  Keep unrelated local inventory and teams. Backup records
                  replace matching IDs only when the complete merged state
                  remains legal.
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
                  Make the backup authoritative for both inventory and saved
                  teams, removing other local data.
                </span>
              </label>
            </fieldset>
            <button
              type="button"
              disabled={restoreMutation.isPending}
              onClick={handleRestore}
            >
              {restoreMutation.isPending
                ? "Restoring…"
                : "Restore TeamLab data"}
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
            Restore complete. Inventory:{" "}
            {restoreMutation.data.inventory.inserted} inserted,{" "}
            {restoreMutation.data.inventory.updated} updated,{" "}
            {restoreMutation.data.inventory.removed} removed,{" "}
            {restoreMutation.data.inventory.finalCount} total. Saved teams:{" "}
            {restoreMutation.data.savedTeams.inserted} inserted,{" "}
            {restoreMutation.data.savedTeams.updated} updated,{" "}
            {restoreMutation.data.savedTeams.removed} removed,{" "}
            {restoreMutation.data.savedTeams.finalCount} total.
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
