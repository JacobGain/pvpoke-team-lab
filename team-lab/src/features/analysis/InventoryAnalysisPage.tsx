import { Pencil, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/PageHeader";
import { PokemonSprite } from "@/components/PokemonSprite";
import type {
  AnalyzedPokemonBuild,
  InventoryBuildAnalysis,
} from "@/domain/analysis/buildAnalysis";
import { useInventoryBuildAnalysis } from "@/features/analysis/analysisQueries";
import { useInventoryPokemon } from "@/features/inventory/inventoryQueries";
import { usePokemonCatalog } from "@/features/meta/usePokemonCatalog";
import { NamedOpponentInsights } from "@/features/analysis/NamedOpponentInsights";
import {
  formatIdentifier,
  formatMoveList,
  formatMoveName,
} from "@/utils/formatters";

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
        <div className="analysis-panel__identity">
          <PokemonSprite
            size="large"
            speciesId={build.speciesId}
            speciesName={build.speciesName}
          />
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
              ? `best role: ${formatIdentifier(build.metaRanking.strongestRole.role)} #${build.metaRanking.strongestRole.rank}`
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
                {formatIdentifier(build.ivSource)}
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
                {formatMoveName(build.moves.enteredFastMoveId)} ·{" "}
                {formatMoveList(build.moves.enteredChargedMoveIds)}
              </dd>
            </div>
            <div>
              <dt>PvPoke recommended</dt>
              <dd>
                {build.moves.recommendedFastMoveId
                  ? formatMoveName(build.moves.recommendedFastMoveId)
                  : "No published fast move"}
                {" · "}
                {formatMoveList(build.moves.recommendedChargedMoveIds) ||
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
                        ? `missing ${formatMoveList(
                            build.moves.missingRecommendedChargedMoveIds,
                            ", ",
                          )}`
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
                  <dt>{formatIdentifier(role.role)}</dt>
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
  const moveIds = [
    analysis.current.moves.enteredFastMoveId,
    ...analysis.current.moves.enteredChargedMoveIds,
    analysis.current.moves.recommendedFastMoveId,
    ...analysis.current.moves.recommendedChargedMoveIds,
    analysis.planned?.moves.enteredFastMoveId,
    ...(analysis.planned?.moves.enteredChargedMoveIds ?? []),
    analysis.planned?.moves.recommendedFastMoveId,
    ...(analysis.planned?.moves.recommendedChargedMoveIds ?? []),
  ].filter((moveId): moveId is string => Boolean(moveId));
  const formatRequirement = (message: string) =>
    moveIds.reduce(
      (formatted, moveId) =>
        formatted.replaceAll(moveId, formatMoveName(moveId)),
      message,
    );

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
              <strong>{formatIdentifier(requirement.code)}</strong>
              <span>{formatRequirement(requirement.message)}</span>
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

  if (error || !analysisResult.data || !catalogResult.data) {
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
      <PageHeader
        actions={
          <>
            <Link
              className="primary-link"
              to={`/inventory/${analysis.inventoryId}`}
            >
              <Pencil size={18} />
              Edit build
            </Link>
            <Link className="secondary-link" to="/teams/new">
              <Users size={18} />
              Use in a team
            </Link>
          </>
        }
        aside={
          <PokemonSprite
            eager
            size="hero"
            speciesId={analysis.current.speciesId}
            speciesName={analysis.current.speciesName}
          />
        }
        back={{ to: "/inventory", label: "Inventory" }}
        description={
          <p>
            Exact build stats and general stat-product ranking against PvPoke
            data {analysis.current.dataVersion}.
          </p>
        }
        eyebrow="Open Great League analysis"
        title={analysis.current.speciesName}
      />

      <BuildPanel build={analysis.current} />
      {analysis.planned ? <BuildPanel build={analysis.planned} /> : null}
      <NamedOpponentInsights
        analysis={analysis}
        catalog={catalogResult.data}
      />
      <Requirements analysis={analysis} />

      <aside className="analysis-scope">
        <strong>Current scope</strong>
        <p>
          IV rank measures stat product, not matchup quality. Attack percentile
          provides broad CMP context only. Named-opponent CMP and fast-move
          thresholds use the displayed default opponent build. Full simulated
          matchup impact remains a later integration.
        </p>
      </aside>
    </main>
  );
}
