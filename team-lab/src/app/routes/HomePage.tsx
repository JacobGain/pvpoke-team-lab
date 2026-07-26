import {
  ArrowRight,
  Boxes,
  CircleCheckBig,
  Plus,
  Sparkles,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PokemonSprite } from "@/components/PokemonSprite";
import { useInventoryList } from "@/features/inventory/inventoryQueries";
import { PvpokeDataStatusCard } from "@/features/meta/PvpokeDataStatusCard";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { useSavedTeamList } from "@/features/teams/savedTeamQueries";

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
            Build with what
            <span> you actually own.</span>
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
        <div className="dashboard-protocol">
          <div className="dashboard-protocol__heading">
            <span>Battle protocol</span>
            <strong>03 phases</strong>
          </div>
          <ol>
            <li>
              <span>01</span>
              <Boxes aria-hidden="true" size={20} />
              <div>
                <strong>Record the roster</strong>
                <small>Exact CP, IVs, moves, and build state</small>
              </div>
            </li>
            <li>
              <span>02</span>
              <Users aria-hidden="true" size={20} />
              <div>
                <strong>Set the formation</strong>
                <small>Lead, safe switch, and closer</small>
              </div>
            </li>
            <li>
              <span>03</span>
              <Swords aria-hidden="true" size={20} />
              <div>
                <strong>Test the field</strong>
                <small>Exact battles against the current meta</small>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="metric-grid" aria-label="TeamLab overview">
        <MetricCard
          detail="Exact local records"
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
