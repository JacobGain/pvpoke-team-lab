import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  createSavedTeam,
  updateSavedTeam,
} from "@/domain/teams/factory";
import type { SavedTeam } from "@/domain/teams/schemas";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import {
  useCreateSavedTeam,
  useSavedTeam,
  useUpdateSavedTeam,
} from "@/features/teams/savedTeamQueries";

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save this team.";
}

interface SavedTeamFormProps {
  readonly existingTeam?: SavedTeam;
  readonly duplicateTeam?: SavedTeam;
}

function SavedTeamForm({
  existingTeam,
  duplicateTeam,
}: SavedTeamFormProps) {
  const navigate = useNavigate();
  const inventoryResult = useInventoryList();
  const catalogResult = usePokemonCatalog();
  const createMutation = useCreateSavedTeam();
  const updateMutation = useUpdateSavedTeam();
  const sourceTeam = existingTeam ?? duplicateTeam;
  const inventory = inventoryResult.data ?? [];
  const catalog = catalogResult.data;
  const defaultIds = inventory.slice(0, 3).map((record) => record.inventoryId);
  const defaultLeadInventoryId = defaultIds[0];
  const defaultSwitchInventoryId = defaultIds[1];
  const defaultCloserInventoryId = defaultIds[2];
  const defaultsInitialized = useRef(sourceTeam !== undefined);
  const [name, setName] = useState(
    duplicateTeam ? `${duplicateTeam.name} copy` : (existingTeam?.name ?? ""),
  );
  const [leadInventoryId, setLeadInventoryId] = useState(
    sourceTeam?.members.leadInventoryId ?? defaultIds[0] ?? "",
  );
  const [switchInventoryId, setSwitchInventoryId] = useState(
    sourceTeam?.members.switchInventoryId ?? defaultIds[1] ?? "",
  );
  const [closerInventoryId, setCloserInventoryId] = useState(
    sourceTeam?.members.closerInventoryId ?? defaultIds[2] ?? "",
  );
  const [notes, setNotes] = useState(sourceTeam?.notes ?? "");
  const [formError, setFormError] = useState<unknown>();

  useEffect(() => {
    if (
      defaultsInitialized.current ||
      !defaultLeadInventoryId ||
      !defaultSwitchInventoryId ||
      !defaultCloserInventoryId
    ) {
      return;
    }

    setLeadInventoryId(defaultLeadInventoryId);
    setSwitchInventoryId(defaultSwitchInventoryId);
    setCloserInventoryId(defaultCloserInventoryId);
    defaultsInitialized.current = true;
  }, [
    defaultCloserInventoryId,
    defaultLeadInventoryId,
    defaultSwitchInventoryId,
  ]);

  if (inventoryResult.isPending || catalogResult.isLoading) {
    return <main className="teams-page">Loading team editor…</main>;
  }

  if (!catalog || inventoryResult.error || catalogResult.error) {
    return (
      <main className="teams-page">
        <Link to="/teams">← Saved teams</Link>
        <p className="inventory-error" role="alert">
          {formatError(inventoryResult.error ?? catalogResult.error)}
        </p>
      </main>
    );
  }
  const loadedCatalog = catalog;

  const pokemonById = new Map(
    loadedCatalog.entries.map((pokemon) => [pokemon.speciesId, pokemon]),
  );
  const inventoryOptions = [...inventory].sort((left, right) => {
    const leftSpeciesId =
      left.buildStatus === "planned"
        ? left.plannedBuild.targetSpeciesId
        : left.speciesId;
    const rightSpeciesId =
      right.buildStatus === "planned"
        ? right.plannedBuild.targetSpeciesId
        : right.speciesId;
    return (
      pokemonById
        .get(leftSpeciesId)
        ?.speciesName.localeCompare(
          pokemonById.get(rightSpeciesId)?.speciesName ?? rightSpeciesId,
        ) ?? leftSpeciesId.localeCompare(rightSpeciesId)
    );
  });
  const selectedIds = [
    leadInventoryId,
    switchInventoryId,
    closerInventoryId,
  ];

  function optionLabel(inventoryId: string): string {
    const record = inventory.find(
      (candidate) => candidate.inventoryId === inventoryId,
    );

    if (!record) {
      return `Missing inventory record · ${inventoryId}`;
    }

    const speciesId =
      record.buildStatus === "planned"
        ? record.plannedBuild.targetSpeciesId
        : record.speciesId;
    const pokemon = pokemonById.get(speciesId);
    const cp =
      record.buildStatus === "planned" && record.plannedBuild.targetCp
        ? record.plannedBuild.targetCp
        : record.currentBuild.cp;

    return `${pokemon?.speciesName ?? speciesId} · CP ${cp} · ${
      record.buildStatus
    } · ${record.currentBuild.ivProfile.ivs.attack}/${
      record.currentBuild.ivProfile.ivs.defense
    }/${record.currentBuild.ivProfile.ivs.hp}`;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);

    try {
      const input = {
        name,
        members: {
          leadInventoryId,
          switchInventoryId,
          closerInventoryId,
        },
        notes,
      };
      const dependencies = { inventory, catalog: loadedCatalog };
      const team = existingTeam
        ? updateSavedTeam(existingTeam, input, dependencies)
        : createSavedTeam(input, dependencies);
      const mutation = existingTeam ? updateMutation : createMutation;

      mutation.mutate(team, {
        onSuccess: () => {
          void navigate("/teams");
        },
        onError: setFormError,
      });
    } catch (error) {
      setFormError(error);
    }
  }

  function swap(
    first: "lead" | "switch" | "closer",
    second: "lead" | "switch" | "closer",
  ) {
    const values = {
      lead: leadInventoryId,
      switch: switchInventoryId,
      closer: closerInventoryId,
    };
    const setters = {
      lead: setLeadInventoryId,
      switch: setSwitchInventoryId,
      closer: setCloserInventoryId,
    };
    setters[first](values[second]);
    setters[second](values[first]);
  }

  const positions = [
    {
      id: "lead",
      title: "Lead",
      description: "Starts the battle and establishes opening pressure.",
      value: leadInventoryId,
      setValue: setLeadInventoryId,
    },
    {
      id: "switch",
      title: "Safe switch",
      description: "Your intended response when the lead matchup is poor.",
      value: switchInventoryId,
      setValue: setSwitchInventoryId,
    },
    {
      id: "closer",
      title: "Closer",
      description: "Finishes games when shields or resources are limited.",
      value: closerInventoryId,
      setValue: setCloserInventoryId,
    },
  ] as const;
  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="teams-page">
      <header className="form-page-header">
        <Link to="/teams">← Saved teams</Link>
        <p className="eyebrow">Open Great League team</p>
        <h1>
          {existingTeam
            ? "Edit saved team"
            : duplicateTeam
              ? "Duplicate saved team"
              : "Create saved team"}
        </h1>
        <p>
          Order matters. Every member references a live inventory record and
          must satisfy species clause.
        </p>
      </header>

      {inventory.length < 3 ? (
        <section className="form-section">
          <h2>Three inventory Pokémon required</h2>
          <p>
            Add at least three records before creating a complete Great League
            team. Separate records of the same species still conflict under
            species clause.
          </p>
          <Link className="primary-link" to="/inventory/new">
            Add Pokémon
          </Link>
        </section>
      ) : (
        <form className="inventory-form team-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="form-grid">
              <label className="form-field form-field--wide">
                <span>Team name</span>
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tournament line"
                />
              </label>
            </div>
          </section>

          <section className="team-order" aria-label="Team order">
            {positions.map((position, index) => {
              const missingSelected =
                position.value !== "" &&
                !inventory.some(
                  (record) => record.inventoryId === position.value,
                );

              return (
                <article className="team-position" key={position.id}>
                  <div className="team-position__number">{index + 1}</div>
                  <div>
                    <p className="eyebrow">{position.title}</p>
                    <p>{position.description}</p>
                  </div>
                  <label className="form-field">
                    <span>Inventory Pokémon</span>
                    <select
                      required
                      value={position.value}
                      onChange={(event) =>
                        position.setValue(event.target.value)
                      }
                    >
                      <option value="">Select a Pokémon</option>
                      {missingSelected ? (
                        <option value={position.value}>
                          {optionLabel(position.value)}
                        </option>
                      ) : null}
                      {inventoryOptions.map((record) => (
                        <option
                          key={record.inventoryId}
                          value={record.inventoryId}
                        >
                          {optionLabel(record.inventoryId)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="team-position__actions">
                    {position.id === "switch" ? (
                      <button
                        type="button"
                        onClick={() => swap("lead", "switch")}
                      >
                        Move to lead
                      </button>
                    ) : null}
                    {position.id === "closer" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => swap("switch", "closer")}
                        >
                          Move to switch
                        </button>
                        <button
                          type="button"
                          onClick={() => swap("lead", "closer")}
                        >
                          Move to lead
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>

          {new Set(selectedIds.filter(Boolean)).size <
          selectedIds.filter(Boolean).length ? (
            <p className="inventory-error" role="alert">
              Each position must reference a different inventory record.
            </p>
          ) : null}

          <section className="form-section">
            <label className="form-field">
              <span>Team notes</span>
              <textarea
                maxLength={2000}
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Matchup plan, tournament context, or substitutions"
              />
            </label>
          </section>

          {formError || createMutation.error || updateMutation.error ? (
            <p className="inventory-error" role="alert">
              {formatError(
                formError ?? createMutation.error ?? updateMutation.error,
              )}
            </p>
          ) : null}

          <div className="form-actions">
            <Link className="secondary-link" to="/teams">
              Cancel
            </Link>
            <button
              className="primary-button"
              type="submit"
              disabled={pending}
            >
              {pending ? "Saving…" : existingTeam ? "Save changes" : "Save team"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

export function SavedTeamFormPage() {
  const { teamId } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateId = teamId ? undefined : searchParams.get("duplicate") ?? undefined;
  const sourceId = teamId ?? duplicateId;
  const sourceResult = useSavedTeam(sourceId);

  if (sourceId && sourceResult.isPending) {
    return <main className="teams-page">Loading saved team…</main>;
  }

  if (sourceId && (sourceResult.error || !sourceResult.data)) {
    return (
      <main className="teams-page">
        <Link to="/teams">← Saved teams</Link>
        <p className="inventory-error" role="alert">
          {sourceResult.error
            ? formatError(sourceResult.error)
            : "Saved team not found."}
        </p>
      </main>
    );
  }

  return (
    <SavedTeamForm
      key={`${teamId ? "edit" : "create"}-${sourceId ?? "new"}`}
      existingTeam={teamId ? sourceResult.data : undefined}
      duplicateTeam={duplicateId ? sourceResult.data : undefined}
    />
  );
}
