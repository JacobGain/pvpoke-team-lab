import {
  ArrowRight,
  Boxes,
  CircleCheckBig,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { PokemonSprite } from "@/components/PokemonSprite";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { PvpokeDataStatusCard } from "@/features/meta/PvpokeDataStatusCard";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";
import { formatMoveList } from "@/utils/formatters";

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  readonly label: string;
  readonly value: number;
  readonly detail: string;
  readonly icon: React.ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-card__icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function HomePage() {
  const inventoryResult = useInventoryList();
  const teamsResult = useSavedTeamList();
  const catalogResult = usePokemonCatalog();
  const inventory = inventoryResult.data ?? [];
  const teams = teamsResult.data ?? [];
  const currentCount = inventory.filter(
    (record) => record.buildStatus === "current",
  ).length;
  const plannedCount = inventory.length - currentCount;
  const assumedCount = inventory.filter(
    (record) => record.currentBuild.ivProfile.source === "assumed-rank-1",
  ).length;
  const recent = [...inventory]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 4);
  const metaWatch = [...(catalogResult.data?.entries ?? [])]
    .filter((entry) => entry.ranking !== undefined)
    .sort(
      (left, right) =>
        (left.ranking?.rank ?? Number.POSITIVE_INFINITY) -
        (right.ranking?.rank ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, 3);

  const nextAction =
    inventory.length === 0
      ? {
          eyebrow: "Start your lab",
          title: "Add your first Great League Pokémon",
          description:
            "Record its CP, IVs, and moves to unlock exact build analysis.",
          label: "Add your first Pokémon",
          to: "/inventory/new",
        }
      : inventory.length < 3
        ? {
            eyebrow: "Build your roster",
            title: `Add ${3 - inventory.length} more to start building teams`,
            description:
              "A complete team needs a lead, safe switch, and closer.",
            label: "Continue inventory",
            to: "/inventory/new",
          }
        : teams.length === 0
          ? {
              eyebrow: "Your next experiment",
              title: "Turn your inventory into a team",
              description:
                "Choose three exact builds manually or let TeamLab recommend a lineup around an anchor.",
              label: "Build a team",
              to: "/teams/new",
            }
          : {
              eyebrow: "Keep optimizing",
              title: "Test a new team around an anchor",
              description:
                "Use your exact owned builds to discover materially different lineups.",
              label: "Generate recommendations",
              to: "/recommend",
            };

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <div className="dashboard-hero__serial">
            <span>TL–GL / 001</span>
            <span>Open Great League</span>
          </div>
          <p className="eyebrow">Competitive battle workspace</p>
          <h1>
            Turn your roster into a
            <span> battle plan.</span>
          </h1>
          <p>
            Inventory exact Pokémon, understand their builds, and test teams
            against the current PvPoke meta.
          </p>
          <div className="page-actions">
            <Link className="primary-link" to="/inventory/new">
              <Plus size={18} />
              Add Pokémon
            </Link>
            <Link className="secondary-link" to="/recommend">
              <Sparkles size={18} />
              Find a team
            </Link>
          </div>
        </div>
        <aside className="dashboard-meta-watch" aria-label="Current meta leaders">
          <div className="dashboard-meta-watch__heading">
            <div>
              <span>Meta watch</span>
              <strong>Current leaders</strong>
            </div>
            <Link to="/catalog">
              Rankings
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </div>
          {metaWatch.length > 0 ? (
            <ol>
              {metaWatch.map((pokemon) => (
                <li key={pokemon.speciesId}>
                  <span className="dashboard-meta-watch__rank">
                    #{pokemon.ranking?.rank}
                  </span>
                  <PokemonSprite
                    eager
                    size="small"
                    speciesId={pokemon.speciesId}
                    speciesName={pokemon.speciesName}
                  />
                  <div>
                    <strong>{pokemon.speciesName}</strong>
                    <small>{pokemon.types.join(" · ")}</small>
                    <span>
                      {formatMoveList(
                        pokemon.ranking?.recommendedMoveIds ?? [],
                        " · ",
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="dashboard-meta-watch__empty">
              Current rankings will appear when bundled battle data is ready.
            </p>
          )}
        </aside>
      </section>

      <section className="metric-grid" aria-label="TeamLab overview">
        <MetricCard
          detail="Exact inventory records"
          icon={<Boxes size={21} />}
          label="Inventory"
          value={inventory.length}
        />
        <MetricCard
          detail={`${plannedCount} planned`}
          icon={<CircleCheckBig size={21} />}
          label="Ready now"
          value={currentCount}
        />
        <MetricCard
          detail="Ordered lineups"
          icon={<Users size={21} />}
          label="Saved teams"
          value={teams.length}
        />
        <MetricCard
          detail="Worth reviewing"
          icon={<Target size={21} />}
          label="Assumed IVs"
          value={assumedCount}
        />
      </section>

      <div className="dashboard-grid">
        <section className="next-action-card">
          <div className="next-action-card__icon">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="eyebrow">{nextAction.eyebrow}</p>
            <h2>{nextAction.title}</h2>
            <p>{nextAction.description}</p>
          </div>
          <Link className="primary-link" to={nextAction.to}>
            {nextAction.label}
            <ArrowRight size={17} />
          </Link>
        </section>

        <PvpokeDataStatusCard />
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your lab bench</p>
            <h2>Recently updated</h2>
          </div>
          <Link className="text-link" to="/inventory">
            View inventory <ArrowRight size={16} />
          </Link>
        </div>

        {recent.length > 0 ? (
          <div className="recent-grid">
            {recent.map((record) => {
              const pokemon = catalogResult.data?.entries.find(
                (entry) => entry.speciesId === record.speciesId,
              );
              const name = pokemon?.speciesName ?? record.speciesId;
              return (
                <Link
                  className="recent-pokemon"
                  key={record.inventoryId}
                  to={`/inventory/${record.inventoryId}/analysis`}
                >
                  <PokemonSprite
                    size="medium"
                    speciesId={record.speciesId}
                    speciesName={name}
                  />
                  <span>
                    <small>
                      {record.buildStatus === "current"
                        ? "Ready now"
                        : "Planned build"}
                    </small>
                    <strong>{name}</strong>
                    <span>CP {record.currentBuild.cp}</span>
                  </span>
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty">
            <Boxes size={28} />
            <div>
              <h3>Your lab bench is clear</h3>
              <p>Add a Pokémon and it will appear here for quick access.</p>
            </div>
            <Link className="secondary-link" to="/inventory/new">
              Add Pokémon
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
