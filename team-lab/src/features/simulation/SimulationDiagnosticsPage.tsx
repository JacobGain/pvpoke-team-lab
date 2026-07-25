import { useState } from "react";
import { Link } from "react-router-dom";

import {
  runSimulationCharacterizationSuite,
  type SimulationCharacterizationReport,
} from "@/domain/simulation/characterization";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { createPvpokeOneOnOneAdapter } from "@/pvpoke/simulation";

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The PvPoke characterization suite failed.";
}

function downloadReport(report: SimulationCharacterizationReport) {
  const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pvpoke-characterization-${report.dataVersion.replaceAll(/[^a-zA-Z0-9.-]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function SimulationDiagnosticsPage() {
  const catalogResult = usePokemonCatalog();
  const [report, setReport] = useState<SimulationCharacterizationReport>();
  const [error, setError] = useState<unknown>();
  const [running, setRunning] = useState(false);

  if (catalogResult.isLoading) {
    return <main className="diagnostics-page">Loading upstream data…</main>;
  }

  if (!catalogResult.data || catalogResult.error) {
    return (
      <main className="diagnostics-page">
        <Link to="/">← Home</Link>
        <p className="inventory-error" role="alert">
          {formatError(catalogResult.error)}
        </p>
      </main>
    );
  }

  const dataVersion = catalogResult.data.dataVersion;

  async function runSuite() {
    setRunning(true);
    setError(undefined);
    setReport(undefined);

    try {
      const adapter = createPvpokeOneOnOneAdapter(dataVersion);
      setReport(await runSimulationCharacterizationSuite(adapter, dataVersion));
    } catch (runError) {
      setError(runError);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="diagnostics-page">
      <header className="form-page-header">
        <Link to="/">← Home</Link>
        <p className="eyebrow">Phase 5 diagnostics</p>
        <h1>PvPoke engine characterization</h1>
        <p>
          Load the real upstream classic scripts, run known exact Great League
          battles twice, and verify deterministic translated results.
        </p>
      </header>

      <section className="form-section diagnostics-summary">
        <div>
          <h2>Browser engine check</h2>
          <p>
            Source data {dataVersion}. This check runs four upstream
            simulations across two known matchups and does not persist battle
            results.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={running}
          onClick={() => void runSuite()}
        >
          {running ? "Running real engine…" : "Run characterization"}
        </button>
      </section>

      {error ? (
        <section className="inventory-error" role="alert">
          <strong>Engine characterization failed</strong>
          <p>{formatError(error)}</p>
          <small>
            Confirm the PvPoke container/proxy is reachable and that the
            configured base URL serves upstream JavaScript and Game Master
            data.
          </small>
        </section>
      ) : null}

      {report ? (
        <>
          <section
            className={`diagnostics-banner ${
              report.passed
                ? "diagnostics-banner--pass"
                : "diagnostics-banner--fail"
            }`}
          >
            <div>
              <p className="eyebrow">Characterization result</p>
              <h2>{report.passed ? "Passed" : "Failed"}</h2>
              <p>
                {report.observations.length} cases · generated{" "}
                {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
            <button type="button" onClick={() => downloadReport(report)}>
              Download fixture JSON
            </button>
          </section>

          <section className="diagnostics-grid">
            {report.observations.map((observation) => (
              <article className="team-card" key={observation.caseId}>
                <div className="team-card__heading">
                  <div>
                    <p className="eyebrow">{observation.caseId}</p>
                    <h2>
                      {observation.invariantFailures.length === 0
                        ? "Passed"
                        : "Failed"}
                    </h2>
                  </div>
                  <span className="rank-badge">
                    {Math.round(observation.durationMs)} ms
                  </span>
                </div>
                <p>{observation.description}</p>
                <dl className="analysis-detail-list">
                  <div>
                    <dt>Deterministic repeat</dt>
                    <dd>{observation.deterministic ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Winner</dt>
                    <dd>
                      {observation.result.winner === "tie"
                        ? "Tie"
                        : observation.result.combatants[
                            observation.result.winner
                          ].speciesId}
                    </dd>
                  </div>
                  <div>
                    <dt>Battle ratings</dt>
                    <dd>
                      {observation.result.combatants[0].battleRating} /{" "}
                      {observation.result.combatants[1].battleRating}
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining HP</dt>
                    <dd>
                      {observation.result.combatants[0].remainingHp} /{" "}
                      {observation.result.combatants[1].remainingHp}
                    </dd>
                  </div>
                </dl>
                {observation.invariantFailures.length > 0 ? (
                  <ul className="inventory-error">
                    {observation.invariantFailures.map((failure) => (
                      <li key={failure}>{failure}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        </>
      ) : null}

      <aside className="analysis-scope">
        <strong>Developer-only scope</strong>
        <p>
          Passing proves that the current browser can bootstrap this upstream
          version and reproduce deterministic summary results. It does not
          validate every species, move, special form, or TeamRanker behavior.
        </p>
      </aside>
    </main>
  );
}
