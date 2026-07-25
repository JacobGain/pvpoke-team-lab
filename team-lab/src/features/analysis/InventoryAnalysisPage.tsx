import { Link, useParams } from "react-router-dom";

import type {
  AnalyzedPokemonBuild,
  InventoryBuildAnalysis,
} from "@/domain/analysis/buildAnalysis";
import { useInventoryBuildAnalysis } from "@/features/analysis/analysisQueries";
import { useInventoryPokemon } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "TeamLab could not analyze this build.";
}

function BuildPanel({ build }: { readonly build: AnalyzedPokemonBuild }) {
  const primaryLevel = build.levels[0]!;
  const rank = build.ivRanking;
  const statProductDelta =
    rank.rankOne.stats.statProduct - rank.combination.stats.statProduct;

  return (
    <section className="analysis-panel">
      <div className="analysis-panel__heading">
        <div>
          <p className="eyebrow">{build.context} build</p>
          <h2>{build.speciesName}</h2>
          <p>
            CP {build.cp}
            {build.cpSource === "derived-maximum"
              ? " · highest legal CP inferred"
              : ""}
            {" · "}
            Level {build.levels.map((level) => level.level).join(" or ")}
            {build.levels.some((level) => level.isBestBuddy)
              ? " · Best Buddy"
              : ""}
          </p>
        </div>
        <span className="analysis-rank">Rank {rank.rank}</span>
      </div>

      <div className="analysis-metrics">
        <div>
          <span>IV percentile</span>
          <strong>{formatNumber(rank.percentile, 1)}%</strong>
          <small>among {rank.count.toLocaleString()} general spreads</small>
        </div>
        <div>
          <span>Rank-one product</span>
          <strong>{formatNumber(rank.statProductPercentage, 2)}%</strong>
          <small>{formatNumber(statProductDelta, 0)} product behind</small>
        </div>
        <div>
          <span>PvPoke overall</span>
          <strong>
            {build.metaRanking.rank
              ? `#${build.metaRanking.rank}`
              : "Unranked"}
          </strong>
          <small>
            {build.metaRanking.strongestRole
              ? `best role: ${build.metaRanking.strongestRole.role} #${build.metaRanking.strongestRole.rank}`
              : build.metaRanking.isMeta
                ? "current meta group"
                : "not meta-tagged"}
          </small>
        </div>
        <div>
          <span>Attack percentile</span>
          <strong>{formatNumber(rank.attackPercentile, 1)}%</strong>
          <small>CMP context, not matchup proof</small>
        </div>
      </div>

      <div className="analysis-columns">
        <section>
          <h3>Effective stats</h3>
          <dl className="analysis-stat-list">
            <div>
              <dt>Attack</dt>
              <dd>{formatNumber(primaryLevel.stats.attack)}</dd>
            </div>
            <div>
              <dt>Defense</dt>
              <dd>{formatNumber(primaryLevel.stats.defense)}</dd>
            </div>
            <div>
              <dt>HP</dt>
              <dd>{primaryLevel.stats.hp}</dd>
            </div>
            <div>
              <dt>Stat product</dt>
              <dd>{formatNumber(primaryLevel.stats.statProduct, 0)}</dd>
            </div>
          </dl>
          {build.levels.length > 1 ? (
            <p className="analysis-notice">
              CP is ambiguous at multiple levels. The displayed stats use level{" "}
              {primaryLevel.level}; TeamLab retains every possible level above.
            </p>
          ) : null}
        </section>

        <section>
          <h3>IV comparison</h3>
          <dl className="analysis-detail-list">
            <div>
              <dt>Your spread</dt>
              <dd>
                {build.ivs.attack}/{build.ivs.defense}/{build.ivs.hp} ·{" "}
                {build.ivSource}
              </dd>
            </div>
            <div>
              <dt>Rank one</dt>
              <dd>
                {rank.rankOne.ivs.attack}/{rank.rankOne.ivs.defense}/
                {rank.rankOne.ivs.hp} · L{rank.rankOne.level} · CP{" "}
                {rank.rankOne.cp}
              </dd>
            </div>
            <div>
              <dt>Highest Attack spread</dt>
              <dd>
                {rank.highestAttack.ivs.attack}/
                {rank.highestAttack.ivs.defense}/
                {rank.highestAttack.ivs.hp} ·{" "}
                {formatNumber(rank.highestAttack.stats.attack)} Attack
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>Moves</h3>
          <dl className="analysis-detail-list">
            <div>
              <dt>Entered</dt>
              <dd>
                {build.moves.enteredFastMoveId} ·{" "}
                {build.moves.enteredChargedMoveIds.join(" / ")}
              </dd>
            </div>
            <div>
              <dt>PvPoke recommended</dt>
              <dd>
                {build.moves.recommendedFastMoveId ?? "No published fast move"}
                {" · "}
                {build.moves.recommendedChargedMoveIds.join(" / ") ||
                  "No published charged moves"}
              </dd>
            </div>
            <div>
              <dt>Comparison</dt>
              <dd>
                {build.moves.fastMoveMatches &&
                build.moves.missingRecommendedChargedMoveIds.length === 0
                  ? "Matches the published recommendation"
                  : [
                      !build.moves.fastMoveMatches ? "fast move differs" : "",
                      build.moves.missingRecommendedChargedMoveIds.length > 0
                        ? `missing ${build.moves.missingRecommendedChargedMoveIds.join(", ")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3>PvPoke roles</h3>
          {build.metaRanking.roles.length > 0 ? (
            <dl className="analysis-stat-list">
              {build.metaRanking.roles.map((role) => (
                <div key={role.role}>
                  <dt>{role.role}</dt>
                  <dd>
                    #{role.rank} · {formatNumber(role.score, 1)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No published role scores.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function Requirements({
  analysis,
}: {
  readonly analysis: InventoryBuildAnalysis;
}) {
  return (
    <section className="analysis-requirements">
      <p className="eyebrow">Build readiness</p>
      <h2>Requirements</h2>
      {analysis.requirements.length === 0 ? (
        <p>This build has no identified move, evolution, or power-up changes.</p>
      ) : (
        <ul>
          {analysis.requirements.map((requirement) => (
            <li key={`${requirement.code}-${requirement.message}`}>
              <strong>{requirement.code.replaceAll("-", " ")}</strong>
              <span>{requirement.message}</span>
            </li>
          ))}
        </ul>
      )}
      <small>
        Costs are qualitative in the MVP. Stardust, Candy, and XL balances are
        not tracked.
      </small>
    </section>
  );
}

export function InventoryAnalysisPage() {
  const { inventoryId } = useParams();
  const inventoryResult = useInventoryPokemon(inventoryId);
  const catalogResult = usePokemonCatalog();
  const analysisResult = useInventoryBuildAnalysis(
    inventoryResult.data,
    catalogResult.data,
  );

  if (
    inventoryResult.isPending ||
    catalogResult.isLoading ||
    (inventoryResult.data !== undefined &&
      catalogResult.data !== undefined &&
      analysisResult.isPending)
  ) {
    return <main className="analysis-page">Calculating build analysis…</main>;
  }

  const error =
    inventoryResult.error ?? catalogResult.error ?? analysisResult.error;

  if (!inventoryResult.data && !error) {
    return (
      <main className="analysis-page">
        <Link to="/inventory">← Inventory</Link>
        <h1>Inventory record not found</h1>
      </main>
    );
  }

  if (error || !analysisResult.data) {
    return (
      <main className="analysis-page">
        <Link to="/inventory">← Inventory</Link>
        <p className="inventory-error" role="alert">
          {formatError(error)}
        </p>
      </main>
    );
  }

  const analysis = analysisResult.data;

  return (
    <main className="analysis-page">
      <header className="analysis-header">
        <Link to="/inventory">← Inventory</Link>
        <p className="eyebrow">Open Great League analysis</p>
        <h1>{analysis.current.speciesName}</h1>
        <p>
          Exact build stats and general stat-product ranking against PvPoke
          data {analysis.current.dataVersion}.
        </p>
      </header>

      <BuildPanel build={analysis.current} />
      {analysis.planned ? <BuildPanel build={analysis.planned} /> : null}
      <Requirements analysis={analysis} />

      <aside className="analysis-scope">
        <strong>Current scope</strong>
        <p>
          IV rank measures stat product, not matchup quality. Attack percentile
          provides CMP context only. Opponent-specific breakpoints, bulkpoints,
          role rankings, and simulated matchup impact require later Phase 3
          integrations.
        </p>
      </aside>
    </main>
  );
}
