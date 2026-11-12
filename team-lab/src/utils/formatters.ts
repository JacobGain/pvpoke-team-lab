export function formatIdentifier(value: string): string {
  const words = value
    .replaceAll(/[_-]+/g, " ")
    .trim()
    .toLocaleLowerCase();

  if (words === "") return "";

  return `${words[0]!.toLocaleUpperCase()}${words.slice(1)}`
    .replaceAll(/\bPvpoke\b/g, "PvPoke")
    .replaceAll(/\bIvs\b/g, "IVs");
}

export function formatMoveName(moveId: string): string {
  return formatIdentifier(moveId).replace(/ plus$/i, "+");
}

export function formatMegaBuild(settings: { readonly megaLevel?: number; readonly extraChargedMoveId?: string }): string {
  return [settings.megaLevel === undefined ? "" : `Mega level ${settings.megaLevel}`,
    settings.extraChargedMoveId ? `Extra attack: ${formatMoveName(settings.extraChargedMoveId)}` : ""].filter(Boolean).join(" · ");
}

export function formatInventoryMegaBuild(record: import("@/domain/inventory/schemas").InventoryPokemon): string {
  const build = record.buildStatus === "planned" ? record.plannedBuild : record.currentBuild;
  const moves = "desiredMoveset" in build ? build.desiredMoveset : build.moveset;
  return formatMegaBuild({ megaLevel: build.megaLevel, extraChargedMoveId: moves.extraChargedMoveId });
}

export function formatMoveList(
  moveIds: readonly string[],
  separator = " / ",
): string {
  return moveIds.map(formatMoveName).join(separator);
}

export function formatTeamPosition(
  position: "lead" | "switch" | "closer",
): string {
  if (position === "switch") return "Safe switch";
  return formatIdentifier(position);
}

export function formatCalendarDate(value: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
