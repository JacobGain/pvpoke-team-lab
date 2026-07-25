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
  useClearGuardedInventory,
  useClearSavedTeams,
  useResetAllLocalData,
} from "@/features/backup/maintenanceQueries";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The local data operation failed.";
}

type ConfirmationAction =
  | "restore-replace"
  | "clear-saved-teams"
  | "clear-inventory"
  | "reset-all";

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
  const clearSavedTeamsMutation = useClearSavedTeams();
  const clearInventoryMutation = useClearGuardedInventory();
  const resetAllMutation = useResetAllLocalData();
  const [inspection, setInspection] = useState<TeamLabBackupInspection>();
  const [selectedFilename, setSelectedFilename] = useState("");
  const [exportError, setExportError] = useState<unknown>();
  const [confirmationAction, setConfirmationAction] =
    useState<ConfirmationAction>();
  const [resetConfirmation, setResetConfirmation] = useState("");
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

    closeConfirmation();
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

    if (restoreMode === "replace") {
      openConfirmation("restore-replace");
      return;
    }

    performRestore();
  }

  function performRestore(mode: TeamLabRestoreMode = restoreMode) {
    if (!inspection?.success) {
      return;
    }

    restoreMutation.mutate({
      backup: inspection.backup,
      mode,
      catalog,
    }, {
      onSuccess: () => {
        setConfirmationAction(undefined);
      },
    });
  }

  function closeConfirmation() {
    setConfirmationAction(undefined);
    setResetConfirmation("");
  }

  function openConfirmation(action: ConfirmationAction) {
    restoreMutation.reset();
    clearSavedTeamsMutation.reset();
    clearInventoryMutation.reset();
    resetAllMutation.reset();
    setResetConfirmation("");
    setConfirmationAction(action);
  }

  function confirmLocalDataAction() {
    const mutationOptions = { onSuccess: closeConfirmation };

    if (confirmationAction === "restore-replace") {
      performRestore("replace");
    } else if (confirmationAction === "clear-saved-teams") {
      clearSavedTeamsMutation.mutate(undefined, mutationOptions);
    } else if (confirmationAction === "clear-inventory") {
      clearInventoryMutation.mutate(undefined, mutationOptions);
    } else if (
      confirmationAction === "reset-all" &&
      resetConfirmation === "RESET"
    ) {
      resetAllMutation.mutate(undefined, mutationOptions);
    }
  }

  const maintenancePending =
    clearSavedTeamsMutation.isPending ||
    clearInventoryMutation.isPending ||
    resetAllMutation.isPending;
  const confirmation = confirmationAction
    ? {
        "restore-replace": {
          title: "Replace all local data?",
          message: inspection?.success
            ? `This will make ${selectedFilename} authoritative, replacing ${records.length} inventory records and ${savedTeams.length} saved teams with ${inspection.backup.inventory.length} inventory records and ${inspection.backup.savedTeams.length} saved teams.`
            : "The selected backup is no longer available.",
          confirmLabel: restoreMutation.isPending
            ? "Replacing…"
            : "Replace with backup",
        },
        "clear-saved-teams": {
          title: "Clear every saved team?",
          message: `This permanently deletes ${savedTeams.length} saved ${savedTeams.length === 1 ? "team" : "teams"}. Inventory records are preserved.`,
          confirmLabel: clearSavedTeamsMutation.isPending
            ? "Clearing…"
            : "Clear saved teams",
        },
        "clear-inventory": {
          title: "Clear every inventory record?",
          message: `This permanently deletes ${records.length} inventory ${records.length === 1 ? "record" : "records"}. This action is allowed only when no saved teams can be orphaned.`,
          confirmLabel: clearInventoryMutation.isPending
            ? "Clearing…"
            : "Clear inventory",
        },
        "reset-all": {
          title: "Reset all TeamLab data?",
          message: `This permanently deletes ${records.length} inventory ${records.length === 1 ? "record" : "records"} and ${savedTeams.length} saved ${savedTeams.length === 1 ? "team" : "teams"} from this browser.`,
          confirmLabel: resetAllMutation.isPending
            ? "Resetting…"
            : "Reset all data",
        },
      }[confirmationAction]
    : undefined;
  const confirmationPending = restoreMutation.isPending || maintenancePending;

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
                    closeConfirmation();
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
                    closeConfirmation();
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

      {confirmation ? (
        <section
          className="destructive-confirmation"
          role="alertdialog"
          aria-labelledby="destructive-confirmation-title"
          aria-describedby="destructive-confirmation-description"
        >
          <div>
            <p className="eyebrow">Confirmation required</p>
            <h2 id="destructive-confirmation-title">
              {confirmation.title}
            </h2>
            <p id="destructive-confirmation-description">
              {confirmation.message} Download a backup first if this data may
              be needed again.
            </p>
          </div>
          {confirmationAction === "reset-all" ? (
            <label className="form-field">
              <span>
                Type <strong>RESET</strong> to continue
              </span>
              <input
                value={resetConfirmation}
                disabled={confirmationPending}
                autoComplete="off"
                onChange={(event) =>
                  setResetConfirmation(event.target.value)
                }
              />
            </label>
          ) : null}
          <div className="destructive-confirmation__actions">
            <button
              className="secondary-button"
              type="button"
              disabled={confirmationPending}
              onClick={closeConfirmation}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={
                confirmationPending ||
                (confirmationAction === "reset-all" &&
                  resetConfirmation !== "RESET")
              }
              onClick={confirmLocalDataAction}
            >
              {confirmation.confirmLabel}
            </button>
          </div>
        </section>
      ) : null}

      <section className="form-section danger-zone">
        <header>
          <p className="eyebrow">Danger zone</p>
          <h2>Manage local data</h2>
          <p>
            These operations permanently remove local browser data. Each
            requires a separate confirmation and reports exact removal counts.
          </p>
        </header>
        <div className="danger-zone-grid">
          <article>
            <h3>Clear saved teams</h3>
            <p>
              Delete {savedTeams.length} saved{" "}
              {savedTeams.length === 1 ? "team" : "teams"} while preserving all
              inventory.
            </p>
            <button
              type="button"
              disabled={
                savedTeams.length === 0 ||
                maintenancePending ||
                restoreMutation.isPending
              }
              onClick={() => openConfirmation("clear-saved-teams")}
            >
              Clear saved teams
            </button>
          </article>
          <article>
            <h3>Clear inventory</h3>
            <p>
              Delete {records.length} inventory{" "}
              {records.length === 1 ? "record" : "records"}. Saved teams must
              be cleared first so references cannot be orphaned.
            </p>
            {savedTeams.length > 0 ? (
              <small>
                Blocked by {savedTeams.length} saved{" "}
                {savedTeams.length === 1 ? "team" : "teams"}.
              </small>
            ) : null}
            <button
              type="button"
              disabled={
                records.length === 0 ||
                savedTeams.length > 0 ||
                maintenancePending ||
                restoreMutation.isPending
              }
              onClick={() => openConfirmation("clear-inventory")}
            >
              Clear inventory
            </button>
          </article>
          <article className="danger-zone-card--critical">
            <h3>Reset TeamLab</h3>
            <p>
              Delete all {records.length} inventory records and{" "}
              {savedTeams.length} saved teams together in one transaction.
            </p>
            <button
              type="button"
              disabled={
                records.length + savedTeams.length === 0 ||
                maintenancePending ||
                restoreMutation.isPending
              }
              onClick={() => openConfirmation("reset-all")}
            >
              Reset all data
            </button>
          </article>
        </div>
      </section>

      {clearSavedTeamsMutation.error ||
      clearInventoryMutation.error ||
      resetAllMutation.error ? (
        <p className="inventory-error" role="alert">
          {formatError(
            clearSavedTeamsMutation.error ??
              clearInventoryMutation.error ??
              resetAllMutation.error,
          )}
        </p>
      ) : null}
      {clearSavedTeamsMutation.data ? (
        <p className="backup-success" role="status">
          Cleared {clearSavedTeamsMutation.data.removedSavedTeamCount} saved{" "}
          {clearSavedTeamsMutation.data.removedSavedTeamCount === 1
            ? "team"
            : "teams"}
          . Inventory was preserved.
        </p>
      ) : null}
      {clearInventoryMutation.data ? (
        <p className="backup-success" role="status">
          Cleared {clearInventoryMutation.data.removedInventoryCount} inventory{" "}
          {clearInventoryMutation.data.removedInventoryCount === 1
            ? "record"
            : "records"}
          .
        </p>
      ) : null}
      {resetAllMutation.data ? (
        <p className="backup-success" role="status">
          TeamLab reset complete:{" "}
          {resetAllMutation.data.removedInventoryCount} inventory records and{" "}
          {resetAllMutation.data.removedSavedTeamCount} saved teams removed.
        </p>
      ) : null}
    </main>
  );
}
