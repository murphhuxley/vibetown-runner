import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    name: v.string(),
    score: v.number(),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().toUpperCase().slice(0, 12);
    if (name.length === 0) throw new Error("Name required");

    // Check if player already has a leaderboard entry
    const existing = await ctx.db
      .query("leaderboard")
      .filter((q) => q.eq(q.field("name"), name))
      .first();

    if (existing) {
      // Only update if new score is higher
      if (args.score > existing.score) {
        await ctx.db.patch(existing._id, {
          score: args.score,
          level: args.level,
          createdAt: Date.now(),
        });
        return existing._id;
      }
      return existing._id;
    }

    return await ctx.db.insert("leaderboard", {
      name,
      score: args.score,
      level: args.level,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("leaderboard") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("leaderboard").collect();
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
