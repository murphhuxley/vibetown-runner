import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    name: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  leaderboard: defineTable({
    name: v.string(),
    score: v.number(),
    level: v.number(),
    createdAt: v.number(),
  }).index("by_score", ["score"]),
});
