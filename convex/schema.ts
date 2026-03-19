import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leaderboard: defineTable({
    name: v.string(),
    score: v.number(),
    level: v.number(),
    createdAt: v.number(),
  }).index("by_score", ["score"]),
});
