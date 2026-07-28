import { bundledPvpokeBaseUrl } from "@/pvpoke/config";
import { createHttpPvpokeRepositories } from "@/pvpoke/repositories/HttpPvpokeRepositories";

export const pvpokeRepositories =
  createHttpPvpokeRepositories(bundledPvpokeBaseUrl);
