import type {
  GameMasterData,
  MetaGroupEntry,
  Ranking,
} from "@/pvpoke/types/schemas";

export interface RankingRequest {
  cup: string;
  category: string;
  cp: number;
}

export interface GameMasterRepository {
  load(): Promise<GameMasterData>;
}

export interface RankingRepository {
  load(request: RankingRequest): Promise<Ranking[]>;
}

export interface MetaGroupRepository {
  load(groupId: string): Promise<MetaGroupEntry[]>;
}

export interface PvpokeRepositories {
  gameMaster: GameMasterRepository;
  rankings: RankingRepository;
  metaGroups: MetaGroupRepository;
}
