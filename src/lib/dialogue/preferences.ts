import { z } from "zod";
import { dietaryRestrictionsSchema } from "../marketplace/discovery-types";

export const preferenceSchema = z.object({
  dietaryRestrictions: dietaryRestrictionsSchema.optional(),
  cuisines: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
  typicalBudgetPaise: z.number().int().positive().max(10_000_000).optional(),
}).strict();
export type Preferences = z.infer<typeof preferenceSchema>;
export const preferenceActionSchema = z.object({
  action: z.literal("preferences"), userApproved: z.literal(true), preferences: preferenceSchema.nullable(),
}).strict();
