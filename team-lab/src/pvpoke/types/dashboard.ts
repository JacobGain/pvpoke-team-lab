import { z } from "zod";

const dashboardLeaderSchema = z.object({
  rank: z.number().int().positive(),
  speciesId: z.string().min(1),
  speciesName: z.string().min(1),
  types: z.array(z.string().min(1)).min(1).max(2),
  recommendedMoveIds: z.array(z.string().min(1)),
});

export const dashboardDataSchema = z.object({
  formatVersion: z.literal(1),
  dataVersion: z.string().min(1),
  speciesNames: z.record(z.string(), z.string().min(1)),
  leaders: z.object({
    "great-league": z.array(dashboardLeaderSchema).length(3),
    "ultra-league": z.array(dashboardLeaderSchema).length(3),
    "master-league": z.array(dashboardLeaderSchema).length(3),
  }),
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;
