import { teamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";
import { DexieRecommendationHistoryRepository } from "@/infrastructure/recommendations/DexieRecommendationHistoryRepository";

export const recommendationHistoryRepository =
  new DexieRecommendationHistoryRepository(teamLabDatabase);

export { DexieRecommendationHistoryRepository };
