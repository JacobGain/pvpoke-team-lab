import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { PokemonSprite } from "@/components/PokemonSprite";
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
  useInventoryList,
  useInventoryPokemon,
  useUpdateInventoryPokemon,
} from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { formatMoveList, formatMoveName } from "@/utils/formatters";

interface InventoryFormProps {
  readonly catalog: PokemonCatalog;
  readonly existingRecord?: InventoryPokemon;
  readonly initialRecord?: InventoryPokemon;
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

function getDefaultMoves(pokemon: PokemonCatalogEntry) {
  const recommendedMoveIds = pokemon.ranking?.recommendedMoveIds ?? [];
  const fastMoveId =
    recommendedMoveIds.find((moveId) =>
      pokemon.fastMoves.some((move) => move.id === moveId),
    ) ??
    pokemon.fastMoves[0]?.id ??
    "";
  const chargedMoveIds = recommendedMoveIds
    .filter((moveId) =>
      pokemon.chargedMoves.some((move) => move.id === moveId),
    )
    .slice(0, 2);

  return {
    fastMoveId,
    chargedMoveOne:
      chargedMoveIds[0] ?? pokemon.chargedMoves[0]?.id ?? "",
    chargedMoveTwo: chargedMoveIds[1] ?? "",
  };
}

function InventoryFormFields({
  catalog,
  existingRecord,
  initialRecord,
  initialPokemon,
  pokemonOptions,
}: InventoryFormFieldsProps) {
  const navigate = useNavigate();
  const createMutation = useCreateInventoryPokemon();
  const updateMutation = useUpdateInventoryPokemon();
  const sourceRecord = existingRecord ?? initialRecord;
  const initialBuild = sourceRecord?.currentBuild;
  const initialDefaultIvs = initialPokemon.defaultGreatLeagueIvs;
  const initialIvSource =
    initialBuild?.ivProfile.source ?? "user-entered";
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
  const initialDefaultMoves = getDefaultMoves(initialPokemon);
  const [speciesId, setSpeciesId] = useState(initialPokemon.speciesId);
  const [buildStatus, setBuildStatus] = useState<"current" | "planned">(
    sourceRecord?.buildStatus ?? "current",
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
    initialBuild?.moveset.fastMoveId ?? initialDefaultMoves.fastMoveId,
  );
  const [chargedMoveOne, setChargedMoveOne] = useState(
    initialBuild?.moveset.chargedMoveIds[0] ??
      initialDefaultMoves.chargedMoveOne,
  );
  const [chargedMoveTwo, setChargedMoveTwo] = useState(
    initialBuild?.moveset.chargedMoveIds[1] ??
      initialDefaultMoves.chargedMoveTwo,
  );
  const existingPlan =
    sourceRecord?.buildStatus === "planned"
      ? sourceRecord.plannedBuild
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
  const initialTargetDefaultMoves = getDefaultMoves(initialTarget);
  const [desiredFastMoveId, setDesiredFastMoveId] = useState(
    existingPlan?.desiredMoveset.fastMoveId ??
      initialTargetDefaultMoves.fastMoveId,
  );
  const [desiredChargedMoveOne, setDesiredChargedMoveOne] = useState(
    existingPlan?.desiredMoveset.chargedMoveIds[0] ??
      initialTargetDefaultMoves.chargedMoveOne,
  );
  const [desiredChargedMoveTwo, setDesiredChargedMoveTwo] = useState(
    existingPlan?.desiredMoveset.chargedMoveIds[1] ??
      initialTargetDefaultMoves.chargedMoveTwo,
  );
  const [favorite, setFavorite] = useState(sourceRecord?.favorite ?? false);
  const [notes, setNotes] = useState(sourceRecord?.notes ?? "");
  const [formError, setFormError] = useState<unknown>();
  const [step, setStep] = useState(0);

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
    const defaults = getDefaultMoves(pokemon);
    setFastMoveId(defaults.fastMoveId);
    setChargedMoveOne(defaults.chargedMoveOne);
    setChargedMoveTwo(defaults.chargedMoveTwo);
  }

  function resetTarget(pokemon: PokemonCatalogEntry) {
    const defaults = getDefaultMoves(pokemon);
    setTargetSpeciesId(pokemon.speciesId);
    setDesiredFastMoveId(defaults.fastMoveId);
    setDesiredChargedMoveOne(defaults.chargedMoveOne);
    setDesiredChargedMoveTwo(defaults.chargedMoveTwo);
    setTargetCp("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const saveIntent = submitter?.value ?? "finish";

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
          void navigate(
            !existingRecord && saveIntent === "add-another"
              ? `/inventory/new?duplicate=${record.inventoryId}&continued=${Date.now()}`
              : "/inventory",
          );
        },
        onError: setFormError,
      });
    } catch (error) {
      setFormError(error);
    }
  }

  const mutationPending =
    createMutation.isPending || updateMutation.isPending;
  const exactBuildComplete =
    cpInference !== undefined && cpInference.status !== "no-match";
  const steps = [
    { label: "Exact build", hint: "Required" },
    { label: "Build intent", hint: "Required" },
    { label: "Review", hint: "Optional details" },
  ] as const;

  return (
    <form className="inventory-form" onSubmit={handleSubmit}>
      <nav className="form-stepper" aria-label="Inventory form progress">
        {steps.map((item, index) => (
          <button
            aria-current={step === index ? "step" : undefined}
            className={
              step === index
                ? "form-step form-step--active"
                : index < step
                  ? "form-step form-step--complete"
                  : "form-step"
            }
            disabled={index > step}
            key={item.label}
            onClick={() => {
              if (index <= step) setStep(index);
            }}
            type="button"
          >
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            <strong>{item.label}</strong>
            <small>{item.hint}</small>
          </button>
        ))}
      </nav>

      {step === 0 ? (
      <section className="form-section guided-form-panel">
        <div className="form-section__heading">
          <div>
            <p className="eyebrow">Step 1 · Required</p>
            <h2>Record the exact Pokémon</h2>
            <p>
              CP and IVs let TeamLab infer the legal level and calculate the
              build you actually own.
            </p>
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

        <div className="selected-pokemon-preview">
          <PokemonSprite
            eager
            size="large"
            speciesId={selectedPokemon.speciesId}
            speciesName={selectedPokemon.speciesName}
          />
          <div>
            <small>Selected specimen</small>
            <strong>{selectedPokemon.speciesName}</strong>
            <span>#{String(selectedPokemon.dex).padStart(4, "0")}</span>
          </div>
        </div>

        <div className="form-grid">
          <PokemonCombobox
            label="Species, form, and Shadow state"
            onSelect={(pokemon) => {
              setSpeciesId(pokemon.speciesId);
              resetMoves(pokemon);
              resetTarget(pokemon);
              if (!pokemon.defaultGreatLeagueIvs) {
                setIvSource("user-entered");
              } else {
                const defaultIvs = pokemon.defaultGreatLeagueIvs;
                setAttackIv(String(defaultIvs.attack));
                setDefenseIv(String(defaultIvs.defense));
                setHpIv(String(defaultIvs.hp));
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
            }}
            options={pokemonOptions}
            selected={selectedPokemon}
          />

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
            <>
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
              <p className="form-helper form-field--wide">
                Required for an exact build. Replace the suggested starting
                values with the IVs shown in Pokémon appraisal.
              </p>
            </>
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
      ) : null}

      {step === 1 ? (
      <section className="form-section guided-form-panel">
        <p className="eyebrow">Step 2 · Required</p>
        <h2>Current or planned</h2>
        <p className="form-section__intro">
          Analyze the build as it is today, or keep the owned specimen while
          planning an evolution, target CP, or moveset.
        </p>
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
      ) : null}

      {step === 2 ? (
      <>
      <section className="form-section guided-form-panel review-panel">
        <p className="eyebrow">Step 3 · Review</p>
        <h2>Confirm the build</h2>
        <div className="build-review">
          <PokemonSprite
            size="large"
            speciesId={selectedPokemon.speciesId}
            speciesName={selectedPokemon.speciesName}
          />
          <dl>
            <div>
              <dt>Pokémon</dt>
              <dd>{selectedPokemon.speciesName}</dd>
            </div>
            <div>
              <dt>Exact build</dt>
              <dd>
                CP {cp} · {effectiveIvs?.attack}/{effectiveIvs?.defense}/
                {effectiveIvs?.hp} IVs
              </dd>
            </div>
            <div>
              <dt>Inferred level</dt>
              <dd>
                {cpInference && cpInference.status !== "no-match"
                  ? cpInference.matches.map((match) => match.level).join(" or ")
                  : "Unresolved"}
              </dd>
            </div>
            <div>
              <dt>Moves</dt>
              <dd>
                {formatMoveName(fastMoveId)} ·{" "}
                {formatMoveList(
                  [chargedMoveOne, chargedMoveTwo].filter(Boolean),
                )}
              </dd>
            </div>
            <div>
              <dt>Intent</dt>
              <dd>{buildStatus === "current" ? "Ready now" : "Planned build"}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="form-section">
        <label className="form-field">
          <span>Notes <small>Optional</small></span>
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
      </>
      ) : null}

      {formError ? (
        <p className="inventory-error" role="alert">
          {formatError(formError)}
        </p>
      ) : null}

      <div className="form-actions">
        {step === 0 ? (
          <Link className="secondary-link" to="/inventory">
            Cancel
          </Link>
        ) : (
          <button
            className="secondary-button"
            onClick={() => {
              setStep((current) => Math.max(0, current - 1));
            }}
            type="button"
          >
            <ChevronLeft size={18} />
            Back
          </button>
        )}
        {step < 2 ? (
          <button
            className="primary-button"
            disabled={step === 0 && !exactBuildComplete}
            onClick={() => {
              setStep((current) => Math.min(2, current + 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            type="button"
          >
            Continue
            <ChevronRight size={18} />
          </button>
        ) : null}
        {step === 2 && !existingRecord ? (
          <button
            type="submit"
            name="save-intent"
            value="add-another"
            disabled={mutationPending}
          >
            {mutationPending ? "Saving…" : "Save and add another"}
          </button>
        ) : null}
        {step === 2 ? (
        <button
          className="primary-button"
          type="submit"
          name="save-intent"
          value="finish"
          disabled={mutationPending}
        >
          <Save size={18} />
          {mutationPending
            ? "Saving…"
            : existingRecord
              ? "Save changes"
              : "Add to inventory"}
        </button>
        ) : null}
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
      (pokemon) =>
        pokemon.speciesId ===
        (props.existingRecord ?? props.initialRecord)?.speciesId,
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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const duplicateId = searchParams.get("duplicate") ?? undefined;
  const continued = searchParams.has("continued");
  const sourceRecordId = inventoryId ?? duplicateId;
  const catalogResult = usePokemonCatalog();
  const inventoryListResult = useInventoryList();
  const inventoryResult = useInventoryPokemon(sourceRecordId);
  const isEditing = inventoryId !== undefined;
  const isDuplicating = !isEditing && duplicateId !== undefined;

  if (
    catalogResult.isLoading ||
    (sourceRecordId !== undefined && inventoryResult.isPending)
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

  if (sourceRecordId !== undefined && !inventoryResult.data) {
    return (
      <main className="inventory-page">
        <Link to="/inventory">← Inventory</Link>
        <h1>
          {isDuplicating
            ? "Source inventory record not found"
            : "Inventory record not found"}
        </h1>
      </main>
    );
  }

  return (
    <main className="inventory-page inventory-form-page">
      <PageHeader
        back={{ to: "/inventory", label: "Inventory" }}
        description={
          <p>
            Record the specimen you own, its exact current build, and an
            optional future plan.
          </p>
        }
        eyebrow="Open Great League inventory"
        title={
          isEditing
            ? "Edit Pokémon"
            : isDuplicating
              ? "Duplicate Pokémon"
              : "Add Pokémon"
        }
      />
      {continued ? (
        <p className="backup-success" role="status">
          Previous Pokémon saved. Your inventory now contains{" "}
          {inventoryListResult.data?.length ?? "the saved"}{" "}
          {inventoryListResult.data?.length === 1 ? "record" : "records"};
          adjust the carried-forward fields for the next specimen.
        </p>
      ) : null}
      <InventoryForm
        key={location.key}
        catalog={catalogResult.data}
        existingRecord={isEditing ? inventoryResult.data : undefined}
        initialRecord={isDuplicating ? inventoryResult.data : undefined}
      />
    </main>
  );
}
