import { z } from "zod";

const rankChangeSchema = z.object({
  before: z.number().int().positive().nullable(),
  after: z.number().int().positive().nullable(),
  recommendedBefore: z.array(z.string()),
  recommendedAfter: z.array(z.string()),
});

export const updateReviewSchema = z.object({
  formatVersion: z.literal(1),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  fromCommit: z.string().regex(/^[a-f0-9]{40}$/),
  toCommit: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  species: z.record(z.string(), z.object({
    name: z.string(),
    details: z.array(z.string()),
    rankings: z.record(z.string(), rankChangeSchema),
  })),
});

export type PvpokeUpdateReview = z.infer<typeof updateReviewSchema>;
