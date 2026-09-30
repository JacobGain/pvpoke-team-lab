import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { Link } from "react-router";

import { PageHeader } from "@/components/PageHeader";
import {
  autoMapInventoryCsvColumns,
  inventoryCsvTemplate,
  MAX_INVENTORY_CSV_BYTES,
  parseInventoryCsv,
  previewInventoryCsv,
  type ParsedInventoryCsv,
} from "@/domain/inventory/csvImport";
import { useCreateManyInventoryPokemon, useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { formatMoveName } from "@/utils/formatters";
import "@/styles/modules/inventory-csv-import.css";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "The CSV could not be imported.";
}

function downloadTemplate() {
  const blob = new Blob([`\uFEFF${inventoryCsvTemplate()}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "teamlab-inventory-template.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function InventoryCsvImportPage() {
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryList();
  const createMutation = useCreateManyInventoryPokemon();
  const fileInput = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ParsedInventoryCsv>();
  const [filename, setFilename] = useState("");
  const [fileError, setFileError] = useState("");
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [importResult, setImportResult] = useState<{
    readonly imported: number;
    readonly skippedDuplicates: number;
    readonly invalid: number;
  }>();

  const mapping = useMemo(
    () => document ? autoMapInventoryCsvColumns(document.headers) : undefined,
    [document],
  );
  const preview = useMemo(() => {
    if (!document || !mapping || !catalogResult.data) return undefined;
    return previewInventoryCsv({
      document,
      mapping,
      catalog: catalogResult.data,
      existingRecords: inventoryResult.data ?? [],
    });
  }, [catalogResult.data, document, inventoryResult.data, mapping]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setDocument(undefined);
    setFilename("");
    setFileError("");
    setIncludeDuplicates(false);
    setImportResult(undefined);
    createMutation.reset();
    if (!file) return;

    setFilename(file.name);
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
      setFileError("Choose a .csv file.");
      return;
    }
    if (file.size > MAX_INVENTORY_CSV_BYTES) {
      setFileError("CSV files must be 5 MiB or smaller.");
      return;
    }

    try {
      setDocument(parseInventoryCsv(await file.text()));
    } catch (error) {
      setFileError(formatError(error));
    }
  }

  function handleImport() {
    if (!preview) return;
    const records = preview.rows
      .filter((row) => row.record && (
        row.status === "ready" ||
        (includeDuplicates && (row.status === "duplicate-existing" || row.status === "duplicate-file"))
      ))
      .map((row) => row.record!);
    if (records.length === 0) return;

    createMutation.mutate(records, {
      onSuccess: () => {
        setImportResult({
          imported: records.length,
          skippedDuplicates: includeDuplicates ? 0 : preview.duplicateCount,
          invalid: preview.invalidCount,
        });
        setDocument(undefined);
        setFilename("");
        setIncludeDuplicates(false);
        if (fileInput.current) fileInput.current.value = "";
      },
    });
  }

  if (catalogResult.isLoading || inventoryResult.isPending) {
    return <main className="inventory-page">Loading CSV import…</main>;
  }

  const loadError = catalogResult.error ?? inventoryResult.error;
  if (!catalogResult.data || loadError) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <p className="inventory-error" role="alert">{formatError(loadError)}</p>
      </main>
    );
  }

  const duplicateCount = preview?.duplicateCount ?? 0;
  const importCount = (preview?.readyCount ?? 0) + (includeDuplicates ? duplicateCount : 0);
  const statusLabel = {
    ready: "Ready",
    "duplicate-existing": "Possible duplicate in inventory",
    "duplicate-file": "Possible duplicate in file",
    invalid: "Needs correction",
  } as const;

  return (
    <main className="inventory-page inventory-csv-page">
      <PageHeader
        back={{ to: "/inventory", label: "Inventory" }}
        description={(
          <p>
            Import exact current builds from a TeamLab CSV template. The file is
            read in this browser; rows are previewed and validated before they
            are added to your local inventory.
          </p>
        )}
        eyebrow="Inventory import"
        title="Import CSV"
        actions={(
          <button className="secondary-button" type="button" onClick={downloadTemplate}>
            <Download aria-hidden="true" size={18} />
            Download TeamLab template
          </button>
        )}
      />

      {importResult ? (
        <p className="backup-success" role="status">
          Imported {importResult.imported} {importResult.imported === 1 ? "Pokémon" : "Pokémon records"}.
          {importResult.skippedDuplicates > 0 ? ` Skipped ${importResult.skippedDuplicates} possible duplicate rows.` : ""}
          {importResult.invalid > 0 ? ` ${importResult.invalid} rows still need correction.` : ""} <Link to="/inventory">View inventory</Link>.
        </p>
      ) : null}

      <section className="form-section csv-import-section">
        <p className="eyebrow">TeamLab CSV format</p>
        <h2>Choose a CSV file</h2>
        <p className="form-section__intro">
          Use the downloaded template with these columns: <code>species_id</code>,
          <code>cp</code>, <code>attack_iv</code>, <code>defense_iv</code>,
          <code>hp_iv</code>, <code>fast_move_id</code>, and
          <code>charged_move_1_id</code>. <code>charged_move_2_id</code>,
          <code>mega_species_id</code>, <code>favorite</code>, and
          <code>notes</code> are optional. Column order may change;
          unrecognized columns are ignored.
        </p>
        <p className="csv-import-assumption">
          Every row must describe a current, exact build. Use PvPoke species and
          move IDs to identify forms and moves precisely. Imported IVs are
          recorded as user-entered values; no build defaults are invented.
        </p>
        <label className="form-field csv-import-file">
          <span>CSV file (5 MiB maximum)</span>
          <input
            accept=".csv,text/csv"
            onChange={(event) => void handleFile(event)}
            ref={fileInput}
            type="file"
          />
        </label>
        {filename ? <p className="csv-import-filename">Selected file: {filename}</p> : null}
        {fileError ? <p className="inventory-error" role="alert">{fileError}</p> : null}
      </section>

      {!importResult && document && preview ? (
        <section className="form-section csv-import-preview" aria-live="polite">
          <div className="form-section__heading">
            <div>
              <p className="eyebrow">Preview · {filename}</p>
              <h2>Review {preview.rows.length} {preview.rows.length === 1 ? "row" : "rows"}</h2>
            </div>
            <span className="context-badge">Data {catalogResult.data.dataVersion}</span>
          </div>

          {preview.configurationIssues.length > 0 ? (
            <div className="inventory-error" role="alert">
              <strong>This file does not match the TeamLab template.</strong>
              <ul>
                {preview.configurationIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
              <p>Download a fresh template and copy your build data into its columns.</p>
            </div>
          ) : null}
          {document.ignoredHeaders.length > 0 ? (
            <p className="csv-import-warning" role="status">
              These extra columns will be ignored: {document.ignoredHeaders.join(", ")}.
            </p>
          ) : null}

          <div className="csv-import-summary" aria-label="Import preview summary">
            <span><strong>{preview.readyCount}</strong> ready</span>
            <span><strong>{preview.duplicateCount}</strong> possible duplicates</span>
            <span><strong>{preview.invalidCount}</strong> need correction</span>
          </div>

          {duplicateCount > 0 ? (
            <label className="csv-import-duplicate-option">
              <input
                checked={includeDuplicates}
                onChange={(event) => setIncludeDuplicates(event.currentTarget.checked)}
                type="checkbox"
              />
              Import possible duplicates anyway
            </label>
          ) : null}
          <p className="csv-import-duplicate-note">
            Duplicate matching compares species, CP, IVs, and moves. It cannot
            tell whether identical build data belongs to the same individual
            Pokémon. Possible duplicates are skipped unless you include them.
          </p>

          <div className="csv-import-table-wrap">
            <table className="csv-import-table">
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Pokémon</th>
                  <th scope="col">Build</th>
                  <th scope="col">Moves</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const speciesColumn = mapping?.species;
                  const rawSpecies = speciesColumn === null || speciesColumn === undefined
                    ? ""
                    : row.sourceValues[speciesColumn] ?? "";
                  return (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>
                        <strong>{(row.speciesName ?? rawSpecies) || "—"}</strong>
                        {row.speciesId ? <small>{row.speciesId}</small> : null}
                        {row.record?.megaSpeciesId ? <small>Mega {row.record.megaSpeciesId}</small> : null}
                        {row.record?.favorite ? <small>Favorite</small> : null}
                      </td>
                      <td>
                        {row.cp !== undefined && row.ivs
                          ? <>CP {row.cp}<small>{row.ivs.attack}/{row.ivs.defense}/{row.ivs.hp} IVs</small></>
                          : <small>Build values not validated</small>}
                      </td>
                      <td>
                        {row.moves
                          ? row.moves.map(formatMoveName).join(" · ")
                          : <small>Moves not validated</small>}
                      </td>
                      <td>
                        <span className={`csv-import-status csv-import-status--${row.status}`}>
                          {statusLabel[row.status]}
                        </span>
                        {row.issue ? <small className="csv-import-issue">{row.issue}</small> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.rows.length === 0 && preview.configurationIssues.length === 0 ? (
            <p className="csv-import-warning" role="status">No data rows were found in this CSV.</p>
          ) : null}

          {createMutation.error ? (
            <p className="inventory-error" role="alert">{formatError(createMutation.error)}</p>
          ) : null}
          <div className="form-actions">
            <Link className="secondary-link" to="/inventory">Cancel</Link>
            <button
              className="primary-button"
              disabled={importCount === 0 || preview.configurationIssues.length > 0 || createMutation.isPending}
              onClick={handleImport}
              type="button"
            >
              <Upload aria-hidden="true" size={18} />
              {createMutation.isPending ? "Importing…" : `Import ${importCount} Pokémon`}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
