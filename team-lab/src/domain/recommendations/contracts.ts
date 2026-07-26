import { z } from "zod";

import { GREAT_LEAGUE_FORMAT_ID } from "@/domain/teams/schemas";

export const RECOMMENDATION_RESULT_COUNT_MIN = 1;
export const RECOMMENDATION_RESULT_COUNT_MAX = 5;

export const recommendationAnchorPositionSchema = z.enum([
  "lead",
  "switch",
  "closer",
  "flex",
]);

export const recommendationAnchorSchema = z.object({
  inventoryId: z.string().uuid(),
  position: recommendationAnchorPositionSchema,
});

export const recommendationBuildStatusScopeSchema = z.enum([
  "all",
  "ready-now-only",
  "planned-only",
]);

export const recommendationPartnerScopeSchema = z.enum([
  "owned-only",
  "owned-and-ranked",
]);

export const recommendationRequestSchema = z
  .object({
    formatId: z.literal(GREAT_LEAGUE_FORMAT_ID),
    anchors: z.array(recommendationAnchorSchema).min(1).max(2),
    resultCount: z
      .number()
      .int()
      .min(RECOMMENDATION_RESULT_COUNT_MIN)
      .max(RECOMMENDATION_RESULT_COUNT_MAX),
    buildStatusScope: recommendationBuildStatusScopeSchema,
    partnerScope: recommendationPartnerScopeSchema.default("owned-only"),
  })
  .superRefine((request, context) => {
    const inventoryIds = request.anchors.map((anchor) => anchor.inventoryId);

    if (new Set(inventoryIds).size !== inventoryIds.length) {
      context.addIssue({
        code: "custom",
        message: "Recommendation anchors must reference different inventory records.",
        path: ["anchors"],
      });
    }

    const fixedPositions = request.anchors.flatMap((anchor) =>
      anchor.position === "flex" ? [] : [anchor.position],
    );

    if (new Set(fixedPositions).size !== fixedPositions.length) {
      context.addIssue({
        code: "custom",
        message: "Two recommendation anchors cannot lock the same team position.",
        path: ["anchors"],
      });
    }
  });

export type RecommendationAnchorPosition = z.infer<
  typeof recommendationAnchorPositionSchema
>;
export type RecommendationAnchor = z.infer<
  typeof recommendationAnchorSchema
>;
export type RecommendationBuildStatusScope = z.infer<
  typeof recommendationBuildStatusScopeSchema
>;
export type RecommendationPartnerScope = z.infer<
  typeof recommendationPartnerScopeSchema
>;
export type RecommendationRequest = z.infer<
  typeof recommendationRequestSchema
>;
