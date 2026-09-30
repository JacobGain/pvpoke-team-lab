import {
  InvalidStoredRecommendationHistoryError,
  RecommendationHistoryRunNotFoundError,
  type RecommendationHistoryRepository,
} from "@/domain/recommendations/historyRepository";
import {
  recommendationHistoryRecordSchema,
  type RecommendationHistoryRecord,
} from "@/domain/recommendations/history";
import type { TeamLabDatabase } from "@/infrastructure/database/TeamLabDatabase";

function parseStoredRecord(value: unknown): RecommendationHistoryRecord {
  const result = recommendationHistoryRecordSchema.safeParse(value);

  if (result.success) return result.data;

  const historyId =
    typeof value === "object" &&
    value !== null &&
    "historyId" in value &&
    typeof value.historyId === "string"
      ? value.historyId
      : "unknown";

  throw new InvalidStoredRecommendationHistoryError(historyId, result.error);
}

export class DexieRecommendationHistoryRepository
  implements RecommendationHistoryRepository
{
  constructor(private readonly database: TeamLabDatabase) {}

  async list(): Promise<readonly RecommendationHistoryRecord[]> {
    const records = await this.database.recommendationHistory
      .orderBy("createdAt")
      .reverse()
      .toArray();

    return records.map(parseStoredRecord);
  }

  async get(historyId: string): Promise<RecommendationHistoryRecord | undefined> {
    const record = await this.database.recommendationHistory.get(historyId);
    return record === undefined ? undefined : parseStoredRecord(record);
  }

  async create(record: RecommendationHistoryRecord): Promise<void> {
    await this.database.recommendationHistory.add(
      recommendationHistoryRecordSchema.parse(record),
    );
  }

  async delete(historyId: string): Promise<void> {
    const existing = await this.database.recommendationHistory.get(historyId);
    if (existing === undefined) {
      throw new RecommendationHistoryRunNotFoundError(historyId);
    }
    await this.database.recommendationHistory.delete(historyId);
  }

  async clear(): Promise<number> {
    const count = await this.database.recommendationHistory.count();
    await this.database.recommendationHistory.clear();
    return count;
  }

  count(): Promise<number> {
    return this.database.recommendationHistory.count();
  }
}
