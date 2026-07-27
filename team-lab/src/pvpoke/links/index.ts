export {
  createPvpokeBattleLink,
  createPvpokeTeamBuilderLink,
} from "@/pvpoke/links/upstreamLinks";

export const pvpokeBaseUrl =
  import.meta.env.VITE_PVPOKE_BASE_URL?.trim() ||
  "/pvpoke/src";
