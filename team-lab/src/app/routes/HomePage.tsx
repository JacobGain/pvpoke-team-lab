import { PvpokeDataStatusCard } from "@/features/meta/PvpokeDataStatusCard";
import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="app-shell">
      <section className="welcome-card">
        <p className="eyebrow">A PvPoke fork</p>
        <h1>TeamLab</h1>
        <p>
          Inventory your Great League Pokémon, analyze exact builds, and create
          teams around what you own.
        </p>
        <p className="status">Application foundation initialized.</p>
        <div className="home-actions">
          <Link className="primary-link" to="/catalog">
            Explore the Great League catalog
          </Link>
          <Link className="secondary-link" to="/inventory">
            Open your inventory
          </Link>
          <Link className="secondary-link" to="/teams">
            Build saved teams
          </Link>
        </div>
      </section>
      <PvpokeDataStatusCard />
    </main>
  );
}
