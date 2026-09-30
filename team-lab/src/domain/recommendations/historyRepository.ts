import type { RecommendationHistoryRecord } from "@/domain/recommendations/history";

export interface RecommendationHistoryRepository {
  list(): Promise<readonly RecommendationHistoryRecord[]>;
  get(historyId: string): Promise<RecommendationHistoryRecord | undefined>;
  create(record: RecommendationHistoryRecord): Promise<void>;
  delete(historyId: string): Promise<void>;
  clear(): Promise<number>;
  count(): Promise<number>;
}

export class InvalidStoredRecommendationHistoryError extends Error {
  readonly historyId: string;
  override readonly cause: unknown;

  constructor(historyId: string, cause: unknown) {
    super(`Stored recommendation run ${historyId} does not match a supported schema.`);
    this.name = "InvalidStoredRecommendationHistoryError";
    this.historyId = historyId;
    this.cause = cause;
  }
}

export class RecommendationHistoryRunNotFoundError extends Error {
  constructor(historyId: string) {
    super(`Recommendation run ${historyId} does not exist.`);
    this.name = "RecommendationHistoryRunNotFoundError";
  }
}
