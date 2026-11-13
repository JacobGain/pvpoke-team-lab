import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";
import { defaultMegaLevel, isMega, type MegaLevel } from "@/domain/pokemon/mega";

export interface MegaBuildSettings {
  readonly megaLevel?: MegaLevel;
  readonly extraChargedMoveId?: string;
}

export function MegaBuildFields({ pokemon, value, onChange, label = "" }: {
  readonly pokemon: PokemonCatalogEntry;
  readonly value: MegaBuildSettings;
  readonly onChange: (value: MegaBuildSettings) => void;
  readonly label?: string;
}) {
  if (!isMega(pokemon)) return null;
  const prefix = label ? `${label} ` : "";
  return <>
    <label className="form-field" data-mega-level>
      <span>{prefix}Mega level</span>
      <select value={value.megaLevel ?? defaultMegaLevel(pokemon)} onChange={event => onChange({ ...value, megaLevel: Number(event.target.value) as MegaLevel })}>
        {([1, 2, 3, 4] as const).map(level => <option key={level} value={level}>{level}{level === 4 ? " · Super Mega" : ""}</option>)}
      </select>
    </label>
    <label className="form-field">
      <span>{prefix}extra charged attack</span>
      <select value={value.extraChargedMoveId ?? ""} onChange={event => onChange({ ...value, extraChargedMoveId: event.target.value || undefined })}>
        <option value="">None</option>
        {value.extraChargedMoveId && !pokemon.extraChargedMoves?.some(move => move.id === value.extraChargedMoveId)
          ? <option value={value.extraChargedMoveId}>Unavailable: {value.extraChargedMoveId} — choose a legal attack</option> : null}
        {(pokemon.extraChargedMoves ?? []).map(move => <option key={move.id} value={move.id}>{move.name}{move.isElite || move.isLegacy ? " *" : ""}</option>)}
      </select>
    </label>
    <p className="form-helper form-field--wide">The extra attack has its own move pool. Mega level changes its damage bonus; level 4 supports effective battle levels up to 52. Changing forms resets these selections.</p>
  </>;
}
