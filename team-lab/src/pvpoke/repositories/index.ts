import { createHttpPvpokeRepositories } from "@/pvpoke/repositories/HttpPvpokeRepositories";

const pvpokeBaseUrl =
  import.meta.env.VITE_PVPOKE_BASE_URL?.trim() || "/pvpoke/src";

export const pvpokeRepositories =
  createHttpPvpokeRepositories(pvpokeBaseUrl);
