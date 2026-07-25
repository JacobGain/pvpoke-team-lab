import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createInventoryPokemon,
  updateInventoryPokemon as buildUpdatedInventoryPokemon,
  type CreateInventoryPokemonInput,
} from "@/domain/inventory/factory";
import type { InventoryPokemon } from "@/domain/inventory/schemas";
import {
  calculateCombatPower,
  inferCombatPowerLevel,
} from "@/domain/pokemon/combatPower";
import type {
  PokemonCatalog,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import {
  useCreateInventoryPokemon,
  useInventoryPokemon,
  useUpdateInventoryPokemon,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

interface InventoryFormProps {
  readonly catalog: PokemonCatalog;
  readonly existingRecord?: InventoryPokemon;
}

interface InventoryFormFieldsProps extends InventoryFormProps {
  readonly initialPokemon: PokemonCatalogEntry;
  readonly pokemonOptions: readonly PokemonCatalogEntry[];
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save this record.";
}

function getAvailablePokemon(
  catalog: PokemonCatalog,
): readonly PokemonCatalogEntry[] {
  return [...catalog.entries]
    .filter(
      (pokemon) =>
        pokemon.isReleased &&
        pokemon.fastMoves.length > 0 &&
        pokemon.chargedMoves.length > 0,
    )
    .sort((left, right) =>
      left.speciesName.localeCompare(right.speciesName),
    );
}

function InventoryFormFields({
  catalog,
  existingRecord,
  initialPokemon,
  pokemonOptions,
}: InventoryFormFieldsProps) {
  const navigate = useNavigate();
  const createMutation = useCreateInventoryPokemon();
  const updateMutation = useUpdateInventoryPokemon();
  const initialBuild = existingRecord?.currentBuild;
  const initialDefaultIvs = initialPokemon.defaultGreatLeagueIvs;
  const initialIvSource =
    initialBuild?.ivProfile.source ??
    (initialDefaultIvs ? "assumed-rank-1" : "user-entered");
  const initialIvs = initialBuild?.ivProfile.ivs ??
    initialDefaultIvs ?? { attack: 0, defense: 15, hp: 15 };
  const initialCp =
    initialBuild?.cp ??
    (initialDefaultIvs
      ? calculateCombatPower(
          initialPokemon.baseStats,
          initialDefaultIvs,
          initialDefaultIvs.level,
        )
      : 1500);
  const [speciesId, setSpeciesId] = useState(initialPokemon.speciesId);
  const [buildStatus, setBuildStatus] = useState<"current" | "planned">(
    existingRecord?.buildStatus ?? "current",
  );
  const [cp, setCp] = useState(String(initialCp));
  const [ivSource, setIvSource] = useState<
    "user-entered" | "assumed-rank-1"
  >(initialIvSource);
  const [attackIv, setAttackIv] = useState(
    String(initialIvs.attack),
  );
  const [defenseIv, setDefenseIv] = useState(
    String(initialIvs.defense),
  );
  const [hpIv, setHpIv] = useState(
    String(initialIvs.hp),
  );
  const [fastMoveId, setFastMoveId] = useState(
    initialBuild?.moveset.fastMoveId ?? initialPokemon.fastMoves[0]!.id,
  );
  const [chargedMoveOne, setChargedMoveOne] = useState(
    initialBuild?.moveset.chargedMoveIds[0] ??
      initialPokemon.chargedMoves[0]!.id,
  );
  const [chargedMoveTwo, setChargedMoveTwo] = useState(
    initialBuild?.moveset.chargedMoveIds[1] ?? "",
  );
  const existingPlan =
    existingRecord?.buildStatus === "planned"
      ? existingRecord.plannedBuild
      : undefined;
  const [targetSpeciesId, setTargetSpeciesId] = useState(
    existingPlan?.targetSpeciesId ?? initialPokemon.speciesId,
  );
  const [targetCp, setTargetCp] = useState(
    existingPlan?.targetCp === undefined
      ? ""
      : String(existingPlan.targetCp),
  );
  const initialTarget =
    catalog.entries.find(
      (pokemon) => pokemon.speciesId === existingPlan?.targetSpeciesId,
    ) ?? initialPokemon;
  const [desiredFastMoveId, setDesiredFastMoveId] = useState(
    existingPlan?.desiredMoveset.fastMoveId ??
      initialTarget.fastMoves[0]?.id ??
      "",
  );
  const [desiredChargedMoveOne, setDesiredChargedMoveOne] = useState(
    existingPlan?.desiredMoveset.chargedMoveIds[0] ??
      initialTarget.chargedMoves[0]?.id ??
      "",
  );
  const [desiredChargedMoveTwo, setDesiredChargedMoveTwo] = useState(
    existingPlan?.desiredMoveset.chargedMoveIds[1] ?? "",
  );
  const [favorite, setFavorite] = useState(existingRecord?.favorite ?? false);
  const [notes, setNotes] = useState(existingRecord?.notes ?? "");
  const [formError, setFormError] = useState<unknown>();

  const selectedPokemon =
    catalog.entries.find((pokemon) => pokemon.speciesId === speciesId) ??
    initialPokemon;
  const targetOptions = [
    selectedPokemon,
    ...selectedPokemon.evolutionIds.flatMap((evolutionId) => {
      const evolution = catalog.entries.find(
        (pokemon) => pokemon.speciesId === evolutionId,
      );
      return evolution ? [evolution] : [];
    }),
  ];
  const selectedTarget =
    targetOptions.find((pokemon) => pokemon.speciesId === targetSpeciesId) ??
    selectedPokemon;
  const effectiveIvs =
    ivSource === "assumed-rank-1"
      ? selectedPokemon.defaultGreatLeagueIvs
      : {
          attack: Number(attackIv),
          defense: Number(defenseIv),
          hp: Number(hpIv),
        };
  const cpInference =
    effectiveIvs &&
    Number.isInteger(Number(cp)) &&
    Number(cp) >= 10 &&
    Number(cp) <= 1500
      ? inferCombatPowerLevel(selectedPokemon, effectiveIvs, Number(cp))
      : undefined;

  function resetMoves(pokemon: PokemonCatalogEntry) {
    setFastMoveId(pokemon.fastMoves[0]?.id ?? "");
    setChargedMoveOne(pokemon.chargedMoves[0]?.id ?? "");
    setChargedMoveTwo("");
  }

  function resetTarget(pokemon: PokemonCatalogEntry) {
    setTargetSpeciesId(pokemon.speciesId);
    setDesiredFastMoveId(pokemon.fastMoves[0]?.id ?? "");
    setDesiredChargedMoveOne(pokemon.chargedMoves[0]?.id ?? "");
    setDesiredChargedMoveTwo("");
    setTargetCp("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    try {
      const chargedMoveIds = [chargedMoveOne, chargedMoveTwo].filter(
        (moveId) => moveId !== "",
      );
      const currentBuild = {
        cp: Number(cp),
        ivProfile:
          ivSource === "assumed-rank-1"
            ? ({ source: "assumed-rank-1" } as const)
            : ({
                source: "user-entered",
                ivs: {
                  attack: Number(attackIv),
                  defense: Number(defenseIv),
                  hp: Number(hpIv),
                },
              } as const),
        moveset: {
          fastMoveId,
          chargedMoveIds,
        },
      };
      const commonInput = {
        speciesId,
        currentBuild,
        favorite,
        notes,
      };
      const input: CreateInventoryPokemonInput =
        buildStatus === "planned"
          ? {
              ...commonInput,
              buildStatus,
              plannedBuild: {
                targetSpeciesId,
                targetCp: targetCp === "" ? undefined : Number(targetCp),
                desiredMoveset: {
                  fastMoveId: desiredFastMoveId,
                  chargedMoveIds: [
                    desiredChargedMoveOne,
                    desiredChargedMoveTwo,
                  ].filter((moveId) => moveId !== ""),
                },
              },
            }
          : { ...commonInput, buildStatus };
      const record = existingRecord
        ? buildUpdatedInventoryPokemon(existingRecord, input, { catalog })
        : createInventoryPokemon(input, { catalog });
      const mutation = existingRecord ? updateMutation : createMutation;

      mutation.mutate(record, {
        onSuccess: () => {
          void navigate("/inventory");
        },
        onError: setFormError,
      });
    } catch (error) {
      setFormError(error);
    }
  }

  const mutationPending =
    createMutation.isPending || updateMutation.isPending;

  return (
    <form className="inventory-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <div className="form-section__heading">
          <div>
            <p className="eyebrow">Owned specimen</p>
            <h2>Current Pokémon</h2>
          </div>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={favorite}
              onChange={(event) => {
                setFavorite(event.target.checked);
              }}
            />
            Favorite
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Species, form, and Shadow state</span>
            <select
              value={speciesId}
              onChange={(event) => {
                const pokemon = catalog.entries.find(
                  (entry) => entry.speciesId === event.target.value,
                );

                if (pokemon) {
                  setSpeciesId(pokemon.speciesId);
                  resetMoves(pokemon);
                  resetTarget(pokemon);
                  if (!pokemon.defaultGreatLeagueIvs) {
                    setIvSource("user-entered");
                  } else if (ivSource === "assumed-rank-1") {
                    const defaultIvs = pokemon.defaultGreatLeagueIvs;
                    setCp(
                      String(
                        calculateCombatPower(
                          pokemon.baseStats,
                          defaultIvs,
                          defaultIvs.level,
                        ),
                      ),
                    );
                  }
                }
              }}
            >
              {pokemonOptions.map((pokemon) => (
                <option value={pokemon.speciesId} key={pokemon.speciesId}>
                  {pokemon.speciesName}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Current CP</span>
            <input
              required
              type="number"
              min="10"
              max="1500"
              value={cp}
              onChange={(event) => {
                setCp(event.target.value);
              }}
            />
          </label>

          <fieldset className="form-field form-field--wide">
            <legend>IV source</legend>
            <label className="radio-control">
              <input
                type="radio"
                name="iv-source"
                checked={ivSource === "user-entered"}
                onChange={() => {
                  setIvSource("user-entered");
                }}
              />
              Enter actual IVs
            </label>
            <label className="radio-control">
              <input
                type="radio"
                name="iv-source"
                checked={ivSource === "assumed-rank-1"}
                disabled={!selectedPokemon.defaultGreatLeagueIvs}
                onChange={() => {
                  setIvSource("assumed-rank-1");
                  const defaultIvs = selectedPokemon.defaultGreatLeagueIvs;
                  if (defaultIvs) {
                    setAttackIv(String(defaultIvs.attack));
                    setDefenseIv(String(defaultIvs.defense));
                    setHpIv(String(defaultIvs.hp));
                    setCp(
                      String(
                        calculateCombatPower(
                          selectedPokemon.baseStats,
                          defaultIvs,
                          defaultIvs.level,
                        ),
                      ),
                    );
                  }
                }}
              />
              Use PvPoke’s default rank-one spread
            </label>
          </fieldset>

          {ivSource === "user-entered" ? (
            <div className="iv-grid form-field--wide">
              {[
                ["Attack", attackIv, setAttackIv],
                ["Defense", defenseIv, setDefenseIv],
                ["HP", hpIv, setHpIv],
              ].map(([label, value, setter]) => (
                <label className="form-field" key={String(label)}>
                  <span>{String(label)} IV</span>
                  <input
                    required
                    type="number"
                    min="0"
                    max="15"
                    value={String(value)}
                    onChange={(event) => {
                      (setter as (value: string) => void)(event.target.value);
                    }}
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="assumption-notice form-field--wide">
              Assumed IVs: {effectiveIvs?.attack}/{effectiveIvs?.defense}/
              {effectiveIvs?.hp}. This remains visibly marked as an assumption.
            </p>
          )}

          <div className="level-result form-field--wide">
            <strong>Level inference</strong>
            {!cpInference ? (
              <span>Enter complete CP and IV values.</span>
            ) : cpInference.status === "no-match" ? (
              <span className="invalid-value">
                This CP and IV combination is not legal for this Pokémon.
              </span>
            ) : (
              <span>
                Level{" "}
                {cpInference.matches.map((match) => match.level).join(" or ")}
                {cpInference.matches.some((match) => match.isBestBuddy)
                  ? " (includes Best Buddy)"
                  : ""}
              </span>
            )}
          </div>

          <label className="form-field">
            <span>Fast move</span>
            <select
              value={fastMoveId}
              onChange={(event) => {
                setFastMoveId(event.target.value);
              }}
            >
              {selectedPokemon.fastMoves.map((move) => (
                <option value={move.id} key={move.id}>
                  {move.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Charged move 1</span>
            <select
              value={chargedMoveOne}
              onChange={(event) => {
                setChargedMoveOne(event.target.value);
              }}
            >
              {selectedPokemon.chargedMoves.map((move) => (
                <option value={move.id} key={move.id}>
                  {move.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Charged move 2</span>
            <select
              value={chargedMoveTwo}
              onChange={(event) => {
                setChargedMoveTwo(event.target.value);
              }}
            >
              <option value="">Not unlocked / not entered</option>
              {selectedPokemon.chargedMoves
                .filter((move) => move.id !== chargedMoveOne)
                .map((move) => (
                  <option value={move.id} key={move.id}>
                    {move.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <p className="eyebrow">Build intent</p>
        <h2>Current or planned</h2>
        <div className="status-selector">
          <label>
            <input
              type="radio"
              name="build-status"
              checked={buildStatus === "current"}
              onChange={() => {
                setBuildStatus("current");
              }}
            />
            <strong>Current</strong>
            <span>Evaluate exactly what this Pokémon knows now.</span>
          </label>
          <label>
            <input
              type="radio"
              name="build-status"
              checked={buildStatus === "planned"}
              onChange={() => {
                setBuildStatus("planned");
              }}
            />
            <strong>Planned</strong>
            <span>Save a desired evolution and/or moveset.</span>
          </label>
        </div>

        {buildStatus === "planned" ? (
          <div className="form-grid planned-fields">
            <label className="form-field form-field--wide">
              <span>Desired species</span>
              <select
                value={selectedTarget.speciesId}
                onChange={(event) => {
                  const target = targetOptions.find(
                    (pokemon) => pokemon.speciesId === event.target.value,
                  );
                  if (target) {
                    resetTarget(target);
                  }
                }}
              >
                {targetOptions.map((pokemon) => (
                  <option value={pokemon.speciesId} key={pokemon.speciesId}>
                    {pokemon.speciesName}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Desired CP (optional)</span>
              <input
                type="number"
                min="10"
                max="1500"
                value={targetCp}
                onChange={(event) => {
                  setTargetCp(event.target.value);
                }}
              />
            </label>
            <label className="form-field">
              <span>Desired fast move</span>
              <select
                value={desiredFastMoveId}
                onChange={(event) => {
                  setDesiredFastMoveId(event.target.value);
                }}
              >
                {selectedTarget.fastMoves.map((move) => (
                  <option value={move.id} key={move.id}>
                    {move.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Desired charged move 1</span>
              <select
                value={desiredChargedMoveOne}
                onChange={(event) => {
                  setDesiredChargedMoveOne(event.target.value);
                }}
              >
                {selectedTarget.chargedMoves.map((move) => (
                  <option value={move.id} key={move.id}>
                    {move.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Desired charged move 2</span>
              <select
                value={desiredChargedMoveTwo}
                onChange={(event) => {
                  setDesiredChargedMoveTwo(event.target.value);
                }}
              >
                <option value="">Not planned</option>
                {selectedTarget.chargedMoves
                  .filter((move) => move.id !== desiredChargedMoveOne)
                  .map((move) => (
                    <option value={move.id} key={move.id}>
                      {move.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <section className="form-section">
        <label className="form-field">
          <span>Notes</span>
          <textarea
            maxLength={2000}
            rows={4}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
            }}
            placeholder="Optional build context"
          />
        </label>
      </section>

      {formError ? (
        <p className="inventory-error" role="alert">
          {formatError(formError)}
        </p>
      ) : null}

      <div className="form-actions">
        <Link className="secondary-link" to="/inventory">
          Cancel
        </Link>
        <button type="submit" disabled={mutationPending}>
          {mutationPending
            ? "Saving…"
            : existingRecord
              ? "Save changes"
              : "Add to inventory"}
        </button>
      </div>
    </form>
  );
}

function InventoryForm(props: InventoryFormProps) {
  const pokemonOptions = useMemo(
    () => getAvailablePokemon(props.catalog),
    [props.catalog],
  );
  const initialPokemon =
    pokemonOptions.find(
      (pokemon) => pokemon.speciesId === props.existingRecord?.speciesId,
    ) ??
    pokemonOptions.find(
      (pokemon) => pokemon.defaultGreatLeagueIvs !== undefined,
    ) ??
    pokemonOptions[0];

  if (!initialPokemon) {
    return <p role="alert">No released Pokémon with complete movepools exist.</p>;
  }

  return (
    <InventoryFormFields
      {...props}
      initialPokemon={initialPokemon}
      pokemonOptions={pokemonOptions}
    />
  );
}

export function InventoryFormPage() {
  const { inventoryId } = useParams();
  const catalogResult = usePokemonCatalog();
  const inventoryResult = useInventoryPokemon(inventoryId);
  const isEditing = inventoryId !== undefined;

  if (
    catalogResult.isLoading ||
    (isEditing && inventoryResult.isPending)
  ) {
    return <main className="inventory-page">Loading inventory form…</main>;
  }

  const error = catalogResult.error ?? inventoryResult.error;

  if (error || !catalogResult.data) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      </main>
    );
  }

  if (isEditing && !inventoryResult.data) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <h1>Inventory record not found</h1>
      </main>
    );
  }

  return (
    <main className="inventory-page inventory-form-page">
      <header className="form-page-header">
        <Link to="/inventory">← Inventory</Link>
        <p className="eyebrow">Open Great League</p>
        <h1>{isEditing ? "Edit Pokémon" : "Add Pokémon"}</h1>
        <p>
          Record the specimen you own, its exact current build, and an optional
          future plan.
        </p>
      </header>
      <InventoryForm
        catalog={catalogResult.data}
        existingRecord={inventoryResult.data}
      />
    </main>
  );
}
