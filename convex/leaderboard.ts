import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    name: v.string(),
    score: v.number(),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 12);
    if (name.length === 0) throw new Error("Name required");
    return await ctx.db.insert("leaderboard", {
      name,
      score: args.score,
      level: args.level,
      createdAt: Date.now(),
    });
  },
});

export const getTop25 = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("leaderboard")
      .withIndex("by_score")
      .order("desc")
      .take(25);
    return entries;
  },
});
