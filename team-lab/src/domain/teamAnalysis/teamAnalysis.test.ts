import { describe, expect, it } from "vitest";

import { analyzeSavedTeamMatrix } from "@/domain/teamAnalysis/teamAnalysis";
import type { SavedTeamRankerRun } from "@/domain/simulation/savedTeamRanking";

function run(): SavedTeamRankerRun {
  const targets = [
    {
      speciesId: "team_wall",
      speciesName: "Team Wall",
      averageRating: 700,
      score: 700,
      ratings: [700, 650, 600],
    },
    {
      speciesId: "core_breaker",
      speciesName: "Core Breaker",
      averageRating: 550,
      score: 550,
      ratings: [620, 560, 400],
    },
    {
      speciesId: "covered",
      speciesName: "Covered Target",
      averageRating: 350,
      score: 350,
      ratings: [300, 450, 500],
    },
  ];

  return {
    scope: {
      teamId: "team",
      teamName: "Test team",
      targetLimit: 5,
      selectedTargetCount: 3,
      availableTargetCount: 3,
      teamShields: 1,
      targetShields: 1,
      targetSpeciesIds: targets.map((target) => target.speciesId),
    },
    result: {
      rankings: targets.map((target) => ({
        speciesId: target.speciesId,
        speciesName: target.speciesName,
        averageRating: target.averageRating,
        score: target.score,
        matchups: target.ratings.map((rating, index) => ({
          opponentSpeciesId: ["lead", "switch", "closer"][index]!,
          rating,
          score: rating,
          durationMs: 30_000,
          fastMoveDamage: 3,
          incomingFastMoveDamage: 4,
          attackDifferential: 0,
        })),
      })),
      teamRatings: [[], [], []],
      battleCount: 9,
      dataVersion: "test-data-v1",
      engine: "pvpoke-team-ranker",
      assumptions: ["Exact targets"],
    },
    evidence: {
      members: [
        {
          position: "lead",
          speciesId: "lead",
          stats: { attack: 100, defense: 3, hp: 100, statProduct: 30_000 },
          roleScores: {
            lead: 90,
            closer: 80,
            switch: 70,
            charger: 80,
            attacker: 85,
            consistency: 90,
          },
        },
        {
          position: "switch",
          speciesId: "switch",
          stats: { attack: 100, defense: 2, hp: 100, statProduct: 20_000 },
          roleScores: {
            lead: 70,
            closer: 70,
            switch: 90,
            charger: 70,
            attacker: 70,
            consistency: 80,
          },
        },
        {
          position: "closer",
          speciesId: "closer",
          stats: { attack: 100, defense: 1, hp: 100, statProduct: 10_000 },
          roleScores: {
            lead: 60,
            closer: 90,
            switch: 60,
            charger: 60,
            attacker: 60,
            consistency: 70,
          },
        },
      ],
      targets: [
        {
          speciesId: "team_wall",
          stats: { attack: 100, defense: 1, hp: 100, statProduct: 10_000 },
        },
        {
          speciesId: "core_breaker",
          stats: { attack: 100, defense: 2, hp: 100, statProduct: 20_000 },
        },
        {
          speciesId: "covered",
          stats: { attack: 100, defense: 3, hp: 100, statProduct: 30_000 },
        },
      ],
    },
    durationMs: 100,
    performance: "within-interactive-budget",
  };
}

describe("saved-team matrix analysis", () => {
  it("derives coverage, threats, core breakers, and team walls", () => {
    const analysis = analyzeSavedTeamMatrix(
      run(),
      () => new Date("2026-07-25T21:00:00.000Z"),
    );

    expect(analysis.coverage).toMatchObject({
      grade: "C",
      score: 66.66666666666666,
      coveredTargets: 2,
      totalTargets: 3,
      positiveMatchups: 3,
      totalMatchups: 9,
    });
    expect(analysis.bulk).toMatchObject({
      grade: "C",
      score: 66.66666666666667,
      evidenceSource: "exact-effective-stats",
      evidenceCount: 3,
      evidenceTotal: 3,
    });
    expect(analysis.safety).toMatchObject({
      grade: "D",
      score: 33.33333333333333,
      evidenceSource: "simulated-matchup-distribution",
      evidenceCount: 1,
      evidenceTotal: 3,
    });
    expect(analysis.consistency).toMatchObject({
      grade: "A",
      score: 80,
      evidenceSource: "pvpoke-static-role-scores",
      evidenceCount: 3,
      evidenceTotal: 3,
    });
    expect(
      analysis.threats.map((threat) => [
        threat.speciesId,
        threat.threatLevel,
        threat.hasTeamAnswer,
      ]),
    ).toEqual([
      ["team_wall", "team-wall", false],
      ["core_breaker", "core-breaker", true],
      ["covered", "covered", true],
    ]);
    expect(analysis.coreBreakers.map((threat) => threat.speciesId)).toEqual([
      "team_wall",
      "core_breaker",
    ]);
    expect(analysis.teamWalls.map((threat) => threat.speciesId)).toEqual([
      "team_wall",
    ]);
    expect(analysis.members).toMatchObject([
      { position: "lead", speciesId: "lead", wins: 1, losses: 2 },
      { position: "switch", speciesId: "switch", wins: 1, losses: 2 },
      { position: "closer", speciesId: "closer", wins: 1, losses: 1, ties: 1 },
    ]);
    expect(analysis).toMatchObject({
      dataVersion: "test-data-v1",
      shieldScenario: "1-1",
      generatedAt: "2026-07-25T21:00:00.000Z",
    });
  });
});
