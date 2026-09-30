import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";

export interface InventoryPokemonOption {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly label: string;
}

const RESULT_LIMIT = 12;

export function InventoryPokemonCombobox({
  label,
  options,
  selectedId,
  selectedLabel,
  onSelect,
}: {
  readonly label: string;
  readonly options: readonly InventoryPokemonOption[];
  readonly selectedId: string;
  readonly selectedLabel: string;
  readonly onSelect: (inventoryId: string) => void;
}) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = editing ? draft : selectedLabel;

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return options
      .filter(
        (option) =>
          normalized === "" ||
          option.name.toLocaleLowerCase().includes(normalized) ||
          option.detail.toLocaleLowerCase().includes(normalized),
      )
      .slice(0, RESULT_LIMIT);
  }, [options, query]);

  function choose(option: InventoryPokemonOption) {
    onSelect(option.id);
    inputRef.current?.setCustomValidity("");
    setDraft("");
    setEditing(false);
    setOpen(false);
    setActiveIndex(0);
  }

  function scrollToOption(index: number) {
    const option = matches[index];
    if (option) {
      document
        .getElementById(`${listboxId}-${option.id}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.min(
        open ? activeIndex + 1 : 0,
        Math.max(matches.length - 1, 0),
      );
      scrollToOption(nextIndex);
      setOpen(true);
      setActiveIndex(nextIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousIndex = Math.max(activeIndex - 1, 0);
      scrollToOption(previousIndex);
      setActiveIndex(previousIndex);
    } else if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setDraft("");
      setEditing(false);
      inputRef.current?.setCustomValidity("");
    }
  }

  return (
    <div
      className="pokemon-combobox form-field inventory-pokemon-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setDraft("");
          setEditing(false);
          inputRef.current?.setCustomValidity("");
        }
      }}
    >
      <label htmlFor={inputId}>
        <span>{label}</span>
      </label>
      <div className="pokemon-combobox__input">
        <Search aria-hidden="true" size={18} />
        <input
          ref={inputRef}
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${listboxId}-${matches[activeIndex].id}`
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          autoComplete="off"
          id={inputId}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setDraft(nextQuery);
            setOpen(true);
            setActiveIndex(0);
            inputRef.current?.setCustomValidity(
              nextQuery.trim()
                ? "Choose a Pokémon from your inventory suggestions."
                : "",
            );
          }}
          onFocus={() => {
            setEditing(true);
            setDraft("");
            setOpen(true);
            setActiveIndex(0);
            inputRef.current?.setCustomValidity("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search your inventory"
          required={!selectedId}
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
            matches.map((option, index) => (
              <button
                aria-selected={option.id === selectedId}
                className={
                  index === activeIndex
                    ? "pokemon-combobox__option pokemon-combobox__option--active"
                    : "pokemon-combobox__option"
                }
                id={`${listboxId}-${option.id}`}
                key={option.id}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => {
                  if (event.pointerType !== "mouse") {
                    event.preventDefault();
                    choose(option);
                  }
                }}
                role="option"
                type="button"
              >
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.detail}</small>
                </span>
                {option.id === selectedId ? (
                  <Check aria-hidden="true" size={17} />
                ) : null}
              </button>
            ))
          ) : (
            <p>No owned Pokémon match “{query}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
