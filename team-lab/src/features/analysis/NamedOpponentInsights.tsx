import { useMemo, useState } from "react";

import {
  analyzeNamedOpponent,
  type DamageThreshold,
} from "@/domain/analysis/matchupThresholds";
import type { InventoryBuildAnalysis } from "@/domain/analysis/buildAnalysis";
import type { PokemonCatalog } from "@/domain/pokemon/catalog";

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function effectivenessLabel(effectiveness: number): string {
  if (effectiveness > 1) return "super effective";
  if (effectiveness < 1) return "resisted";
  return "neutral";
}

function moveLabel(threshold: DamageThreshold): string {
  return `${threshold.move.name} · ${threshold.damage} damage · ${threshold.turns} turn${threshold.turns === 1 ? "" : "s"} · ${effectivenessLabel(threshold.effectiveness)}`;
}

export function NamedOpponentInsights({
  analysis,
  catalog,
}: {
  readonly analysis: InventoryBuildAnalysis;
  readonly catalog: PokemonCatalog;
}) {
  const [context, setContext] = useState<"current" | "planned">("current");
  const build =
    context === "planned" && analysis.planned
      ? analysis.planned
      : analysis.current;
  const eligibleOpponents = useMemo(
    () =>
      catalog.entries.filter(
        (entry) =>
          entry.isMeta &&
          entry.defaultGreatLeagueIvs !== undefined &&
          entry.ranking !== undefined &&
          entry.fastMoves.some((move) =>
            entry.ranking?.recommendedMoveIds.includes(move.id),
          ),
      ),
    [catalog],
  );
  const initialOpponent =
    eligibleOpponents.find((entry) => entry.speciesId !== build.speciesId) ??
    eligibleOpponents[0];
  const [opponentId, setOpponentId] = useState(
    initialOpponent?.speciesId ?? "",
  );
  const opponent =
    eligibleOpponents.find((entry) => entry.speciesId === opponentId) ??
    initialOpponent;
  const pokemon = catalog.entries.find(
    (entry) => entry.speciesId === build.speciesId,
  );
  const matchup = useMemo(
    () =>
      pokemon && opponent
        ? analyzeNamedOpponent(build, pokemon, opponent)
        : undefined,
    [build, opponent, pokemon],
  );

  if (!matchup) {
    return null;
  }

  return (
    <section className="analysis-panel matchup-panel">
      <div className="analysis-panel__heading">
        <div>
          <p className="eyebrow">Named-opponent evidence</p>
          <h2>CMP and fast-move thresholds</h2>
          <p>
            Compare one exact inventory build with a published PvPoke Open
            Great League meta build.
          </p>
        </div>
        <div className="matchup-controls">
          {analysis.planned ? (
            <label>
              Your build
              <select
                value={context}
                onChange={(event) =>
                  setContext(event.target.value as "current" | "planned")
                }
              >
                <option value="current">Current</option>
                <option value="planned">Planned</option>
              </select>
            </label>
          ) : null}
          <label>
            Meta opponent
            <select
              value={matchup.opponent.speciesId}
              onChange={(event) => setOpponentId(event.target.value)}
            >
              {eligibleOpponents.map((entry) => (
                <option key={entry.speciesId} value={entry.speciesId}>
                  {entry.speciesName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="analysis-notice">
        Opponent assumption: {matchup.opponent.speciesName} at level{" "}
        {matchup.opponentLevel}, IVs {matchup.opponentIvs.attack}/
        {matchup.opponentIvs.defense}/{matchup.opponentIvs.hp}, using PvPoke’s
        recommended {matchup.opponentFastMove.name}. Data{" "}
        {matchup.dataVersion}.
      </p>

      <div className="matchup-results">
        {matchup.levels.map((result) => (
          <article key={result.level}>
            <h3>Your level {result.level}</h3>
            <dl className="analysis-detail-list">
              <div>
                <dt>CMP Attack comparison</dt>
                <dd>
                  {result.cmp === "win"
                    ? "Higher Attack"
                    : result.cmp === "loss"
                      ? "Lower Attack"
                      : "Tied Attack"}{" "}
                  · {result.attackDifference >= 0 ? "+" : ""}
                  {formatNumber(result.attackDifference)}
                </dd>
              </div>
              <div>
                <dt>Your fast move</dt>
                <dd>{moveLabel(result.outgoing)}</dd>
              </div>
              <div>
                <dt>Next offensive breakpoint</dt>
                <dd>
                  {formatNumber(
                    result.outgoing.attackRequiredForNextDamage,
                  )}{" "}
                  Attack for {result.outgoing.nextDamage} damage ·{" "}
                  {result.outgoing.attackShortfall === 0
                    ? "already reached"
                    : `${formatNumber(result.outgoing.attackShortfall)} short`}
                  {" · "}
                  {result.outgoing.achievableWithinGeneralIvSpace
                    ? "available in the general IV space"
                    : "outside the general IV space"}
                </dd>
              </div>
              <div>
                <dt>Incoming fast move</dt>
                <dd>{moveLabel(result.incoming)}</dd>
              </div>
              <div>
                <dt>Next defensive bulkpoint</dt>
                <dd>
                  {result.incoming.defenseRequiredForReducedDamage ===
                  undefined
                    ? "Already at the one-damage floor"
                    : `${formatNumber(result.incoming.defenseRequiredForReducedDamage)} Defense for ${result.incoming.reducedDamage} damage · ${
                        result.incoming.defenseShortfall === 0
                          ? "already reached"
                          : `${formatNumber(result.incoming.defenseShortfall ?? 0)} short`
                      } · ${
                        result.incoming.achievableWithinGeneralIvSpace
                          ? "available in the general IV space"
                          : "outside the general IV space"
                      }`}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <small>
        CMP compares unmodified effective Attack; Shadow damage bonuses do not
        alter CMP. Thresholds use PvPoke’s damage constants and Shadow
        modifiers. They do not claim a matchup flip: shields, charged moves,
        timing, HP, and full battle sequencing have not been simulated.
      </small>
    </section>
  );
}
