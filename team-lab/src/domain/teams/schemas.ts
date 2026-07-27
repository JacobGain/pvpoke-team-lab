import { z } from "zod";

export const SAVED_TEAM_SCHEMA_VERSION = 1 as const;
export const GREAT_LEAGUE_FORMAT_ID = "great-league" as const;

const teamIdSchema = z.string().uuid();
const inventoryIdSchema = z.string().uuid();

export const savedTeamMembersSchema = z
  .object({
    leadInventoryId: inventoryIdSchema,
    switchInventoryId: inventoryIdSchema,
    closerInventoryId: inventoryIdSchema,
  })
  .superRefine((members, context) => {
    const inventoryIds = [
      members.leadInventoryId,
      members.switchInventoryId,
      members.closerInventoryId,
    ];

    if (new Set(inventoryIds).size !== inventoryIds.length) {
      context.addIssue({
        code: "custom",
        message: "A saved team must reference three different inventory records.",
      });
    }
  });

export const savedTeamSchema = z
  .object({
    schemaVersion: z.literal(SAVED_TEAM_SCHEMA_VERSION),
    teamId: teamIdSchema,
    name: z.string().trim().min(1).max(100),
    formatId: z.literal(GREAT_LEAGUE_FORMAT_ID),
    members: savedTeamMembersSchema,
    notes: z.string().trim().max(2000),
    lastAnalyzedDataVersion: z.string().trim().min(1).max(200).optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((team, context) => {
    if (Date.parse(team.updatedAt) < Date.parse(team.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "updatedAt cannot be earlier than createdAt.",
        path: ["updatedAt"],
      });
    }
  });

export const savedTeamArraySchema = z.array(savedTeamSchema);

export type SavedTeamMembers = z.infer<typeof savedTeamMembersSchema>;
export type SavedTeam = z.infer<typeof savedTeamSchema>;
export type SavedTeamPosition = "lead" | "switch" | "closer";

export function getSavedTeamInventoryIds(
  members: SavedTeamMembers,
): readonly [string, string, string] {
  return [
    members.leadInventoryId,
    members.switchInventoryId,
    members.closerInventoryId,
  ];
}
