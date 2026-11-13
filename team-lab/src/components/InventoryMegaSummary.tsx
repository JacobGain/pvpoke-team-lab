import type { InventoryPokemon } from "@/domain/inventory/schemas";
import { projectInventoryForCatalog } from "@/domain/inventory/leagueEligibility";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";
import { formatInventoryMegaBuild } from "@/utils/formatters";

export function InventoryMegaSummary({ record, catalog }: {
  readonly record: InventoryPokemon;
  readonly catalog: PokemonCatalog;
}) {
  const projected = projectInventoryForCatalog(record, catalog);
  const text = projected ? formatInventoryMegaBuild(projected) : "";
  return text ? <small className="mega-build-summary">{text}</small> : null;
}
