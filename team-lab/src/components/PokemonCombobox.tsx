import {
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Search } from "lucide-react";

import type { PokemonCatalogEntry } from "@/domain/pokemon/catalog";

const RESULT_LIMIT = 12;

export function PokemonCombobox({
  label,
  options,
  selected,
  onSelect,
}: {
  readonly label: string;
  readonly options: readonly PokemonCatalogEntry[];
  readonly selected: PokemonCatalogEntry;
  readonly onSelect: (pokemon: PokemonCatalogEntry) => void;
}) {
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState(selected.speciesName);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = options.filter(
      (pokemon) =>
        normalized === "" ||
        pokemon.speciesName.toLocaleLowerCase().includes(normalized) ||
        pokemon.speciesId.toLocaleLowerCase().includes(normalized),
    );

    return filtered.slice(0, RESULT_LIMIT);
  }, [options, query]);

  function choose(pokemon: PokemonCatalogEntry) {
    onSelect(pokemon);
    setQuery(pokemon.speciesName);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, Math.max(matches.length - 1, 0)),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected.speciesName);
    }
  }

  return (
    <div
      className="pokemon-combobox form-field form-field--wide"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(selected.speciesName);
        }
      }}
    >
      <label htmlFor={inputId}>
        <span>{label}</span>
      </label>
      <div className="pokemon-combobox__input">
        <Search aria-hidden="true" size={18} />
        <input
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${listboxId}-${matches[activeIndex].speciesId}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          data-selected-species-id={selected.speciesId}
          id={inputId}
          onChange={(event) => {
            const nextQuery = event.target.value;
            const normalized = nextQuery.trim().toLocaleLowerCase();
            setQuery(nextQuery);
            setOpen(true);
            setActiveIndex(0);

            const exact = options.find(
              (pokemon) =>
                pokemon.speciesId.toLocaleLowerCase() === normalized ||
                pokemon.speciesName.toLocaleLowerCase() === normalized,
            );
            if (exact) {
              onSelect(exact);
              setQuery(exact.speciesName);
            }
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by Pokémon name or form"
          role="combobox"
          type="search"
          value={query}
        />
      </div>
      {open ? (
        <div
          aria-label={`${label} suggestions`}
          className="pokemon-combobox__results"
          id={listboxId}
          role="listbox"
        >
          {matches.length > 0 ? (
            matches.map((pokemon, index) => (
              <button
                aria-selected={pokemon.speciesId === selected.speciesId}
                className={
                  index === activeIndex
                    ? "pokemon-combobox__option pokemon-combobox__option--active"
                    : "pokemon-combobox__option"
                }
                data-species-id={pokemon.speciesId}
                id={`${listboxId}-${pokemon.speciesId}`}
                key={pokemon.speciesId}
                onClick={() => choose(pokemon)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <span>
                  <strong>{pokemon.speciesName}</strong>
                  <small>#{String(pokemon.dex).padStart(4, "0")}</small>
                </span>
                {pokemon.speciesId === selected.speciesId ? (
                  <Check aria-hidden="true" size={17} />
                ) : null}
              </button>
            ))
          ) : (
            <p>No Pokémon match “{query}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
