import { createInventoryPokemon } from "@/domain/inventory/factory";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import type {
  CatalogMove,
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";

export const MAX_INVENTORY_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_INVENTORY_CSV_RECORDS = 500;

export const INVENTORY_CSV_FIELDS = [
  "species",
  "cp",
  "attackIv",
  "defenseIv",
  "hpIv",
  "fastMove",
  "chargedMove1",
  "chargedMove2",
  "megaSpecies",
  "favorite",
  "notes",
] as const;

export type InventoryCsvField = (typeof INVENTORY_CSV_FIELDS)[number];

export type InventoryCsvColumnMap = Readonly<
  Record<InventoryCsvField, number | null>
>;

export interface ParsedInventoryCsvRow {
  readonly rowNumber: number;
  readonly values: readonly string[];
  readonly shapeIssue?: string;
}

export interface ParsedInventoryCsv {
  readonly headers: readonly string[];
  readonly rows: readonly ParsedInventoryCsvRow[];
  readonly delimiter: string;
  readonly ignoredHeaders: readonly string[];
}

export interface InventoryCsvRowPreview {
  readonly rowNumber: number;
  readonly sourceValues: readonly string[];
  readonly status: "ready" | "duplicate-existing" | "duplicate-file" | "invalid";
  readonly speciesName?: string;
  readonly speciesId?: string;
  readonly cp?: number;
  readonly ivs?: {
    readonly attack: number;
    readonly defense: number;
    readonly hp: number;
  };
  readonly moves?: readonly string[];
  readonly record?: InventoryPokemon;
  readonly issue?: string;
}

export interface InventoryCsvPreview {
  readonly rows: readonly InventoryCsvRowPreview[];
  readonly configurationIssues: readonly string[];
  readonly readyCount: number;
  readonly duplicateCount: number;
  readonly invalidCount: number;
}

const EMPTY_COLUMN_MAP: InventoryCsvColumnMap = {
  species: null,
  cp: null,
  attackIv: null,
  defenseIv: null,
  hpIv: null,
  fastMove: null,
  chargedMove1: null,
  chargedMove2: null,
  megaSpecies: null,
  favorite: null,
  notes: null,
};

const FIELD_LABELS: Readonly<Record<InventoryCsvField, string>> = {
  species: "Species or PvPoke ID",
  cp: "CP",
  attackIv: "Attack IV",
  defenseIv: "Defense IV",
  hpIv: "HP IV",
  fastMove: "Fast move",
  chargedMove1: "Charged move 1",
  chargedMove2: "Charged move 2 (optional)",
  megaSpecies: "Mega species ID (optional)",
  favorite: "Favorite (optional)",
  notes: "Notes (optional)",
};

const HEADER_ALIASES: Readonly<Record<InventoryCsvField, readonly string[]>> = {
  species: ["species_id"],
  cp: ["cp"],
  attackIv: ["attack_iv"],
  defenseIv: ["defense_iv"],
  hpIv: ["hp_iv"],
  fastMove: ["fast_move_id"],
  chargedMove1: ["charged_move_1_id"],
  chargedMove2: ["charged_move_2_id"],
  megaSpecies: ["mega_species_id"],
  favorite: ["favorite"],
  notes: ["notes"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function detectDelimiter(source: string): string {
  const counts = new Map<string, number>([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) break;
    if (!quoted && counts.has(character)) {
      counts.set(character, counts.get(character)! + 1);
    }
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? ",";
}

function parseDelimitedRows(source: string, delimiter: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;

  function finishRow() {
    row.push(field);
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
    row = [];
    field = "";
    afterQuote = false;
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === delimiter) {
        row.push(field);
        field = "";
        afterQuote = false;
      } else if (character === "\n" || character === "\r") {
        finishRow();
        if (character === "\r" && source[index + 1] === "\n") index += 1;
      } else if (!/[\t ]/u.test(character)) {
        throw new Error("A quoted CSV value has unexpected text after its closing quote.");
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw new Error("A quote appears inside an unquoted CSV value.");
      }
      inQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      finishRow();
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error("The CSV ends inside a quoted value.");
  if (field.length > 0 || row.length > 0 || afterQuote) finishRow();
  return rows;
}

export function parseInventoryCsv(source: string): ParsedInventoryCsv {
  const normalizedSource = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (!normalizedSource.trim()) throw new Error("The CSV file is empty.");

  const delimiter = detectDelimiter(normalizedSource);
  const parsedRows = parseDelimitedRows(normalizedSource, delimiter);
  const headerIndex = parsedRows.findIndex((row) => row.some((value) => value.trim()));
  if (headerIndex < 0) throw new Error("The CSV file has no header row.");

  const headers = parsedRows[headerIndex]!.map((header) => header.trim());
  if (headers.length < 2 || headers.every((header) => !header)) {
    throw new Error("The CSV header row must contain column names.");
  }
  const nonEmptyHeaderKeys = headers.map(normalizeHeader).filter(Boolean);
  if (new Set(nonEmptyHeaderKeys).size !== nonEmptyHeaderKeys.length) {
    throw new Error("The CSV header row contains repeated column names.");
  }

  const dataRows = parsedRows.slice(headerIndex + 1);
  if (dataRows.length > MAX_INVENTORY_CSV_RECORDS) {
    throw new Error(
      `This file has ${dataRows.length} rows. Import up to ${MAX_INVENTORY_CSV_RECORDS} Pokémon at a time.`,
    );
  }

  return {
    headers,
    delimiter,
    ignoredHeaders: headers.filter(
      (header) => !INVENTORY_CSV_FIELDS.some((field) =>
        HEADER_ALIASES[field].some((alias) => normalizeHeader(alias) === normalizeHeader(header)),
      ),
    ),
    rows: dataRows.map((values, index) => ({
      rowNumber: index + 2,
      values,
      ...(values.length !== headers.length
        ? {
            shapeIssue: `Row ${index + 2} has ${values.length} fields; the header has ${headers.length}.`,
          }
        : {}),
    })),
  };
}

export function autoMapInventoryCsvColumns(
  headers: readonly string[],
): InventoryCsvColumnMap {
  const normalizedAliases = new Map<InventoryCsvField, ReadonlySet<string>>(
    INVENTORY_CSV_FIELDS.map((field) => [
      field,
      new Set(HEADER_ALIASES[field].map(normalizeHeader)),
    ]),
  );

  return Object.fromEntries(
    INVENTORY_CSV_FIELDS.map((field) => {
      const aliases = normalizedAliases.get(field)!;
      const index = headers.findIndex((header) => aliases.has(normalizeHeader(header)));
      return [field, index < 0 ? null : index];
    }),
  ) as unknown as InventoryCsvColumnMap;
}

export function emptyInventoryCsvColumnMap(): InventoryCsvColumnMap {
  return { ...EMPTY_COLUMN_MAP };
}

export function inventoryCsvFieldLabel(field: InventoryCsvField): string {
  return FIELD_LABELS[field];
}

export function inventoryCsvConfigurationIssues(
  mapping: InventoryCsvColumnMap,
): readonly string[] {
  const issues: string[] = [];
  const required: readonly InventoryCsvField[] = [
    "species",
    "cp",
    "attackIv",
    "defenseIv",
    "hpIv",
    "fastMove",
    "chargedMove1",
  ];
  for (const field of required) {
    if (mapping[field] === null) issues.push(`The TeamLab template needs a “${HEADER_ALIASES[field][0]}” column.`);
  }

  const activeMappings = INVENTORY_CSV_FIELDS.filter((field) => mapping[field] !== null);
  const fieldsByIndex = new Map<number, InventoryCsvField[]>();
  for (const field of activeMappings) {
    const index = mapping[field]!;
    fieldsByIndex.set(index, [...(fieldsByIndex.get(index) ?? []), field]);
  }
  for (const [index, fields] of fieldsByIndex) {
    if (fields.length > 1) {
      issues.push(`Column ${index + 1} is assigned to more than one field.`);
    }
  }

  return issues;
}

function cell(
  row: ParsedInventoryCsvRow,
  mapping: InventoryCsvColumnMap,
  field: InventoryCsvField,
): string {
  const index = mapping[field];
  return index === null ? "" : (row.values[index] ?? "").trim();
}

function wholeNumber(value: string, label: string, maximum: number): number {
  if (!/^\d+$/u.test(value)) throw new Error(`${label} must be a whole number.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new Error(`${label} must be from 0 to ${maximum}.`);
  }
  return number;
}

function parseFavorite(value: string): boolean {
  if (!value) return false;
  const normalized = value.toLocaleLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error("Favorite must be blank, true, or false.");
}

function parseIvs(row: ParsedInventoryCsvRow, mapping: InventoryCsvColumnMap) {
  return {
    attack: wholeNumber(cell(row, mapping, "attackIv"), "Attack IV", 15),
    defense: wholeNumber(cell(row, mapping, "defenseIv"), "Defense IV", 15),
    hp: wholeNumber(cell(row, mapping, "hpIv"), "HP IV", 15),
  };
}

function findPokemon(
  value: string,
  catalog: PokemonCatalog,
): PokemonCatalogEntry {
  if (!value) throw new Error("Species is required.");
  const byId = catalog.entries.filter(
    (pokemon) => pokemon.speciesId.toLocaleLowerCase() === value.toLocaleLowerCase(),
  );
  const matches = byId.length > 0
    ? byId
    : catalog.entries.filter(
        (pokemon) => normalizeSearchValue(pokemon.speciesName) === normalizeSearchValue(value),
      );
  if (matches.length === 0) {
    throw new Error(`“${value}” does not match a Pokémon in the current catalog; use its PvPoke species ID for ambiguous forms.`);
  }
  if (matches.length > 1) {
    throw new Error(`“${value}” matches multiple forms. Use the exact PvPoke species ID.`);
  }
  if (!matches[0]!.isReleased) {
    throw new Error(`${matches[0]!.speciesName} is not marked as released in the current catalog.`);
  }
  return matches[0]!;
}

function findMove(value: string, moves: readonly CatalogMove[], label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  const byId = moves.filter((move) => move.id.toLocaleLowerCase() === value.toLocaleLowerCase());
  const matches = byId.length > 0
    ? byId
    : moves.filter((move) => normalizeSearchValue(move.name) === normalizeSearchValue(value));
  if (matches.length === 0) throw new Error(`“${value}” is not a legal ${label.toLocaleLowerCase()}.`);
  if (matches.length > 1) throw new Error(`“${value}” matches multiple moves; use a move ID.`);
  return matches[0]!.id;
}

function duplicateKey(record: InventoryPokemon): string {
  const ivs = record.currentBuild.ivProfile.ivs;
  const moves = record.currentBuild.moveset;
  return JSON.stringify([
    record.speciesId,
    record.currentBuild.cp,
    ivs.attack,
    ivs.defense,
    ivs.hp,
    moves.fastMoveId,
    [...moves.chargedMoveIds].sort(),
  ]);
}

export function previewInventoryCsv(input: {
  readonly document: ParsedInventoryCsv;
  readonly mapping: InventoryCsvColumnMap;
  readonly catalog: PokemonCatalog;
  readonly existingRecords: readonly InventoryPokemon[];
}): InventoryCsvPreview {
  const configurationIssues = inventoryCsvConfigurationIssues(input.mapping);
  const existingKeys = new Set(input.existingRecords.map(duplicateKey));
  const importedKeys = new Set<string>();

  const rows = input.document.rows.map((row): InventoryCsvRowPreview => {
    if (configurationIssues.length > 0) {
      return {
        rowNumber: row.rowNumber,
        sourceValues: row.values,
        status: "invalid",
        issue: "The file is missing required TeamLab template columns.",
      };
    }
    if (row.shapeIssue) {
      return { rowNumber: row.rowNumber, sourceValues: row.values, status: "invalid", issue: row.shapeIssue };
    }

    try {
      const pokemon = findPokemon(cell(row, input.mapping, "species"), input.catalog);
      const cp = wholeNumber(cell(row, input.mapping, "cp"), "CP", 10000);
      if (cp < 10) throw new Error("CP must be from 10 to 10000.");
      const ivs = parseIvs(row, input.mapping);
      const fastMoveId = findMove(
        cell(row, input.mapping, "fastMove"),
        pokemon.fastMoves,
        "fast move",
      );
      const chargedMoveIds = [
        cell(row, input.mapping, "chargedMove1"),
        cell(row, input.mapping, "chargedMove2"),
      ]
        .filter(Boolean)
        .map((value, index) => findMove(value, pokemon.chargedMoves, `charged move ${index + 1}`));
      if (chargedMoveIds.length === 0) throw new Error("At least one charged move is required.");
      if (new Set(chargedMoveIds).size !== chargedMoveIds.length) {
        throw new Error("Charged moves must be different.");
      }
      const notes = cell(row, input.mapping, "notes");
      if (notes.length > 2000) throw new Error("Notes must be 2000 characters or fewer.");
      const megaSpeciesId = cell(row, input.mapping, "megaSpecies");
      const favorite = parseFavorite(cell(row, input.mapping, "favorite"));

      const record = createInventoryPokemon(
        {
          speciesId: pokemon.speciesId,
          ...(megaSpeciesId ? { megaSpeciesId } : {}),
          buildStatus: "current",
          currentBuild: {
            cp,
            ivProfile: { source: "user-entered", ivs },
            moveset: { fastMoveId, chargedMoveIds },
          },
          favorite,
          notes,
        },
        { catalog: input.catalog },
      );
      const key = duplicateKey(record);
      if (existingKeys.has(key)) {
        return {
          rowNumber: row.rowNumber,
          sourceValues: row.values,
          status: "duplicate-existing",
          speciesName: pokemon.speciesName,
          speciesId: pokemon.speciesId,
          cp,
          ivs,
          moves: [fastMoveId, ...chargedMoveIds],
          record,
        };
      }
      if (importedKeys.has(key)) {
        return {
          rowNumber: row.rowNumber,
          sourceValues: row.values,
          status: "duplicate-file",
          speciesName: pokemon.speciesName,
          speciesId: pokemon.speciesId,
          cp,
          ivs,
          moves: [fastMoveId, ...chargedMoveIds],
          record,
        };
      }
      importedKeys.add(key);
      return {
        rowNumber: row.rowNumber,
        sourceValues: row.values,
        status: "ready",
        speciesName: pokemon.speciesName,
        speciesId: pokemon.speciesId,
        cp,
        ivs,
        moves: [fastMoveId, ...chargedMoveIds],
        record,
      };
    } catch (error) {
      return {
        rowNumber: row.rowNumber,
        sourceValues: row.values,
        status: "invalid",
        issue: error instanceof Error ? error.message : "This row could not be imported.",
      };
    }
  });

  return {
    rows,
    configurationIssues,
    readyCount: rows.filter((row) => row.status === "ready").length,
    duplicateCount: rows.filter((row) => row.status === "duplicate-existing" || row.status === "duplicate-file").length,
    invalidCount: rows.filter((row) => row.status === "invalid").length,
  };
}

export function inventoryCsvTemplate(): string {
  return [
    "species_id,cp,attack_iv,defense_iv,hp_iv,fast_move_id,charged_move_1_id,charged_move_2_id,mega_species_id,favorite,notes",
    "",
  ].join("\r\n");
}
