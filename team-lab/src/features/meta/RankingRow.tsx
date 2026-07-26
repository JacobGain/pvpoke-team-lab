import { useState, type SyntheticEvent } from "react";
import {
  BarChart3,
  ChevronDown,
  HeartPulse,
  Shield,
  Swords,
  Zap,
} from "lucide-react";

import { PokemonSprite } from "@/components/PokemonSprite";
import type {
  CatalogMove,
  CatalogRankedOpponent,
  CatalogRoleScores,
  PokemonCatalogEntry,
} from "@/domain/pokemon/catalog";
import {
  buildDefensiveProfile,
  formatEffectiveness,
  getMoveUsagePercent,
  getRankingStats,
} from "@/features/meta/rankingDetails";
import { formatIdentifier } from "@/utils/formatters";

interface RankingRowProps {
  readonly pokemon: PokemonCatalogEntry;
  readonly catalogById: ReadonlyMap<string, PokemonCatalogEntry>;
}

const PERFORMANCE_ROLES: readonly {
  readonly key: keyof CatalogRoleScores;
  readonly label: string;
}[] = [
  { key: "lead", label: "Lead" },
  { key: "switch", label: "Switch" },
  { key: "charger", label: "Charger" },
  { key: "closer", label: "Closer" },
  { key: "consistency", label: "Consistency" },
  { key: "attacker", label: "Attacker" },
];

function recommendedMoveNames(pokemon: PokemonCatalogEntry): string {
  if (!pokemon.ranking) {
    return "No published moveset";
  }

  const moves = [...pokemon.fastMoves, ...pokemon.chargedMoves];

  return pokemon.ranking.recommendedMoveIds
    .map(
      (moveId) =>
        moves.find((move) => move.id === moveId)?.name ??
        formatIdentifier(moveId),
    )
    .join(" · ");
}

function performancePoint(
  value: number,
  index: number,
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const normalized = Math.min(Math.max((value - 30) / 70, 0.05), 1);
  const angle = -Math.PI / 2 + index * (Math.PI / 3);
  return `${centerX + Math.cos(angle) * radius * normalized},${centerY + Math.sin(angle) * radius * normalized}`;
}

function gridPoint(
  index: number,
  centerX: number,
  centerY: number,
  radius: number,
): string {
  const angle = -Math.PI / 2 + index * (Math.PI / 3);
  return `${centerX + Math.cos(angle) * radius},${centerY + Math.sin(angle) * radius}`;
}

function PerformanceGraph({
  scores,
}: {
  readonly scores: CatalogRoleScores;
}) {
  const centerX = 110;
  const centerY = 86;
  const radius = 70;
  const values = PERFORMANCE_ROLES.map(({ key }) => scores[key]);
  const label = PERFORMANCE_ROLES.map(
    ({ label: role, key }) => `${role} ${Math.round(scores[key])}`,
  ).join(", ");

  return (
    <div className="performance-graph">
      <svg
        aria-label={`Performance graph: ${label}`}
        className="performance-graph__chart"
        role="img"
        viewBox="0 0 220 172"
      >
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            className="performance-graph__grid"
            key={level}
            points={PERFORMANCE_ROLES.map((_, index) =>
              gridPoint(index, centerX, centerY, radius * level),
            ).join(" ")}
          />
        ))}
        {PERFORMANCE_ROLES.map((_, index) => (
          <line
            className="performance-graph__axis"
            key={index}
            x1={centerX}
            x2={gridPoint(index, centerX, centerY, radius).split(",")[0]}
            y1={centerY}
            y2={gridPoint(index, centerX, centerY, radius).split(",")[1]}
          />
        ))}
        <polygon
          className="performance-graph__value"
          points={values
            .map((value, index) =>
              performancePoint(value, index, centerX, centerY, radius),
            )
            .join(" ")}
        />
      </svg>
      <dl className="performance-graph__legend">
        {PERFORMANCE_ROLES.map(({ key, label: role }) => (
          <div key={key}>
            <dt>{role}</dt>
            <dd>{Math.round(scores[key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MatchupList({
  catalogById,
  emptyLabel,
  matchups,
}: {
  readonly catalogById: ReadonlyMap<string, PokemonCatalogEntry>;
  readonly emptyLabel: string;
  readonly matchups: readonly CatalogRankedOpponent[];
}) {
  if (matchups.length === 0) {
    return <p className="ranking-detail__empty">{emptyLabel}</p>;
  }

  return (
    <ul className="ranking-matchups">
      {matchups.map((matchup) => {
        const opponent = catalogById.get(matchup.speciesId);
        const speciesName =
          opponent?.speciesName ?? formatIdentifier(matchup.speciesId);

        return (
          <li key={matchup.speciesId}>
            <PokemonSprite
              size="small"
              speciesId={matchup.speciesId}
              speciesName={speciesName}
            />
            <span>
              <strong>{speciesName}</strong>
              <small>Battle score {Math.round(matchup.rating)}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MoveList({
  moves,
  pokemon,
}: {
  readonly moves: readonly CatalogMove[];
  readonly pokemon: PokemonCatalogEntry;
}) {
  return (
    <ul className="ranking-movepool">
      {moves.map((move) => {
        const usage = getMoveUsagePercent(pokemon, move);
        const isRecommended =
          pokemon.ranking?.recommendedMoveIds.includes(move.id) ?? false;

        return (
          <li key={move.id}>
            <div className="ranking-movepool__heading">
              <strong>{move.name}</strong>
              <div>
                {isRecommended ? (
                  <span className="move-badge move-badge--recommended">
                    Recommended
                  </span>
                ) : null}
                {move.isElite ? (
                  <span className="move-badge">Elite</span>
                ) : move.isLegacy ? (
                  <span className="move-badge">Legacy</span>
                ) : null}
              </div>
            </div>
            <div className="ranking-movepool__facts">
              <span className={`type-pill type-pill--${move.type}`}>
                {move.type}
              </span>
              <span>{move.power} damage</span>
              {move.kind === "fast" ? (
                <>
                  <span>+{move.energyGain} energy</span>
                  <span>
                    {move.turns} {move.turns === 1 ? "turn" : "turns"}
                  </span>
                </>
              ) : (
                <span>{move.energy} energy</span>
              )}
              {usage !== undefined ? (
                <span>{Math.round(usage)}% usage</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RankingDetail({
  catalogById,
  pokemon,
}: RankingRowProps) {
  const ranking = pokemon.ranking;
  const defensiveProfile = buildDefensiveProfile(
    pokemon.types.filter((type) => type !== "none"),
  );
  const stats = getRankingStats(pokemon);
  const statRows = stats
    ? [
        {
          label: "Attack",
          value: stats.attack.toFixed(1),
          max: 250,
          raw: stats.attack,
        },
        {
          label: "Defense",
          value: stats.defense.toFixed(1),
          max: 250,
          raw: stats.defense,
        },
        {
          label: "HP",
          value: Math.round(stats.hp).toString(),
          max: 250,
          raw: stats.hp,
        },
        {
          label: "Stat product",
          value: Math.round(stats.statProduct).toLocaleString(),
          max: 3_000,
          raw: stats.statProduct,
        },
      ]
    : [];

  return (
    <div className="ranking-detail">
      <section className="ranking-detail__panel ranking-detail__performance">
        <div className="ranking-detail__title">
          <BarChart3 aria-hidden="true" size={19} />
          <div>
            <h3>Performance</h3>
            <p>PvPoke role scores and Great League stat totals</p>
          </div>
        </div>
        {ranking ? (
          <PerformanceGraph scores={ranking.roleScores} />
        ) : (
          <p className="ranking-detail__empty">
            No published performance scores.
          </p>
        )}
        {statRows.length > 0 ? (
          <dl className="ranking-stats" aria-label="Stat totals">
            {statRows.map((stat) => (
              <div key={stat.label}>
                <dt>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </dt>
                <dd>
                  <span
                    aria-hidden="true"
                    style={{
                      width: `${Math.min((stat.raw / stat.max) * 100, 100)}%`,
                    }}
                  />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {ranking?.editorNotes ? (
          <p className="ranking-detail__notes">{ranking.editorNotes}</p>
        ) : null}
      </section>

      <section className="ranking-detail__panel">
        <div className="ranking-detail__title">
          <Swords aria-hidden="true" size={19} />
          <div>
            <h3>Key wins</h3>
            <p>Matchups this Pokémon is best positioned to win</p>
          </div>
        </div>
        <MatchupList
          catalogById={catalogById}
          emptyLabel="No key wins are published for this ranking."
          matchups={ranking?.matchups ?? []}
        />
      </section>

      <section className="ranking-detail__panel">
        <div className="ranking-detail__title">
          <Shield aria-hidden="true" size={19} />
          <div>
            <h3>Key losses</h3>
            <p>Common counters that put this Pokémon at risk</p>
          </div>
        </div>
        <MatchupList
          catalogById={catalogById}
          emptyLabel="No key losses are published for this ranking."
          matchups={ranking?.counters ?? []}
        />
      </section>

      <section className="ranking-detail__panel">
        <div className="ranking-detail__title">
          <HeartPulse aria-hidden="true" size={19} />
          <div>
            <h3>Defensive typing</h3>
            <p>Incoming damage multipliers in Pokémon GO</p>
          </div>
        </div>
        <div className="ranking-typing">
          <div>
            <h4>Weak to</h4>
            <div className="ranking-typing__list">
              {defensiveProfile.weaknesses.map(({ multiplier, type }) => (
                <span className={`type-pill type-pill--${type}`} key={type}>
                  {type} <small>{formatEffectiveness(multiplier)}</small>
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4>Resists</h4>
            <div className="ranking-typing__list">
              {defensiveProfile.resistances.map(({ multiplier, type }) => (
                <span className={`type-pill type-pill--${type}`} key={type}>
                  {type} <small>{formatEffectiveness(multiplier)}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="ranking-detail__panel ranking-detail__movepool">
        <div className="ranking-detail__title">
          <Zap aria-hidden="true" size={19} />
          <div>
            <h3>Full movepool</h3>
            <p>Published move stats and ranking usage</p>
          </div>
        </div>
        <div className="ranking-move-groups">
          <div>
            <h4>Fast moves</h4>
            <MoveList moves={pokemon.fastMoves} pokemon={pokemon} />
          </div>
          <div>
            <h4>Charged moves</h4>
            <MoveList moves={pokemon.chargedMoves} pokemon={pokemon} />
          </div>
        </div>
      </section>
    </div>
  );
}

export function RankingRow({
  catalogById,
  pokemon,
}: RankingRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const optimalIvs = pokemon.defaultGreatLeagueIvs;

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setIsOpen(event.currentTarget.open);
  }

  return (
    <details className="ranking-row" onToggle={handleToggle}>
      <summary className="ranking-row__summary">
        <div className="ranking-row__rank">
          <span>Rank</span>
          <strong>
            {pokemon.ranking ? `#${pokemon.ranking.rank}` : "—"}
          </strong>
          {pokemon.ranking ? (
            <small>{pokemon.ranking.score.toFixed(1)} score</small>
          ) : (
            <small>Unranked</small>
          )}
        </div>
        <div className="ranking-row__identity">
          <PokemonSprite
            size="large"
            speciesId={pokemon.speciesId}
            speciesName={pokemon.speciesName}
          />
          <div>
            <span>#{String(pokemon.dex).padStart(4, "0")}</span>
            <h2>{pokemon.speciesName}</h2>
          </div>
        </div>
        <div className="ranking-row__types">
          <span className="ranking-row__label">Typing</span>
          <div className="type-list">
            {pokemon.types
              .filter((type) => type !== "none")
              .map((type) => (
                <span className={`type-pill type-pill--${type}`} key={type}>
                  {type}
                </span>
              ))}
          </div>
        </div>
        <div className="ranking-row__moves">
          <span className="ranking-row__label">Recommended moves</span>
          <strong>{recommendedMoveNames(pokemon)}</strong>
        </div>
        <div className="ranking-row__ivs">
          <span className="ranking-row__label">Optimal IVs</span>
          <strong>
            {optimalIvs
              ? `${optimalIvs.attack}/${optimalIvs.defense}/${optimalIvs.hp}`
              : "Not provided"}
          </strong>
          {optimalIvs ? <small>Level {optimalIvs.level}</small> : null}
        </div>
        <span className="ranking-row__expand" aria-hidden="true">
          <span>Details</span>
          <ChevronDown size={20} />
        </span>
      </summary>
      {isOpen ? (
        <RankingDetail catalogById={catalogById} pokemon={pokemon} />
      ) : null}
    </details>
  );
}
