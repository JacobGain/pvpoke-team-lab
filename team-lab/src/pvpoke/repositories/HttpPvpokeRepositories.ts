import {
  gameMasterSchema,
  metaGroupSchema,
  rankingCollectionSchema,
} from "@/pvpoke/types/schemas";
import type {
  GameMasterRepository,
  MetaGroupRepository,
  PvpokeRepositories,
  RankingRepository,
  RankingRequest,
} from "@/pvpoke/repositories/contracts";
import { fetchValidatedJson } from "@/pvpoke/repositories/http";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

class HttpGameMasterRepository implements GameMasterRepository {
  constructor(private readonly baseUrl: string) {}

  load() {
    return fetchValidatedJson(
      `${this.baseUrl}/data/gamemaster.min.json`,
      gameMasterSchema,
    );
  }
}

class HttpRankingRepository implements RankingRepository {
  constructor(private readonly baseUrl: string) {}

  load({ cup, category, cp }: RankingRequest) {
    return fetchValidatedJson(
      `${this.baseUrl}/data/rankings/${encodeURIComponent(cup)}/${encodeURIComponent(category)}/rankings-${String(cp)}.json`,
      rankingCollectionSchema,
    );
  }
}

class HttpMetaGroupRepository implements MetaGroupRepository {
  constructor(private readonly baseUrl: string) {}

  load(groupId: string) {
    return fetchValidatedJson(
      `${this.baseUrl}/data/groups/${encodeURIComponent(groupId)}.json`,
      metaGroupSchema,
    );
  }
}

export function createHttpPvpokeRepositories(
  baseUrl: string,
): PvpokeRepositories {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  return {
    gameMaster: new HttpGameMasterRepository(normalizedBaseUrl),
    rankings: new HttpRankingRepository(normalizedBaseUrl),
    metaGroups: new HttpMetaGroupRepository(normalizedBaseUrl),
  };
}
