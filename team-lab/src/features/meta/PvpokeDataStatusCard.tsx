import { usePvpokeDataStatus } from "@/features/meta/usePvpokeDataStatus";

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not load its bundled battle data.";
}

export function PvpokeDataStatusCard() {
  const { data, error, isLoading, refetch } = usePvpokeDataStatus();

  if (isLoading) {
    return (
      <section className="data-card" aria-live="polite">
        <p className="eyebrow">Bundled PvPoke data</p>
        <h2>Loading…</h2>
        <p>Validating the bundled Game Master, rankings, and Great League meta.</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="data-card data-card--error" role="alert">
        <p className="eyebrow">Bundled PvPoke data</p>
        <h2>Data unavailable</h2>
        <p>{formatError(error)}</p>
        <button type="button" onClick={() => void refetch()}>
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="data-card" aria-labelledby="pvpoke-data-title">
      <div className="data-card__heading">
        <div>
          <p className="eyebrow">Bundled PvPoke data</p>
          <h2 id="pvpoke-data-title">Ready</h2>
        </div>
        <span className="connection-badge">Schema valid</span>
      </div>

      <dl className="data-grid">
        <div>
          <dt>Game Master</dt>
          <dd>{data.gameMasterTitle}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{data.gameMasterTimestamp}</dd>
        </div>
        <div>
          <dt>Pokémon</dt>
          <dd>{data.pokemonCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Moves</dt>
          <dd>{data.moveCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{data.formatTitle}</dd>
        </div>
        <div>
          <dt>Cup rules</dt>
          <dd>{data.cupAvailable ? "Available" : "Missing"}</dd>
        </div>
        <div>
          <dt>Ranked builds</dt>
          <dd>{data.rankingCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Meta entries</dt>
          <dd>{data.metaEntryCount.toLocaleString()}</dd>
        </div>
      </dl>
    </section>
  );
}
