import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple hash — not cryptographic but good enough for a game leaderboard.
// We don't store sensitive data, just preventing name squatting.
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Run it through multiple rounds for basic security
  for (let round = 0; round < 100; round++) {
    hash = ((hash << 5) - hash) + (hash >>> 16);
    hash = hash & hash;
  }
  return hash.toString(36);
}

export const register = mutation({
  args: {
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().toUpperCase().slice(0, 12);
    if (name.length === 0) throw new Error("Name required");
    if (args.password.length < 3) throw new Error("Password must be at least 3 characters");

    // Check if name already taken
    const existing = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    if (existing) throw new Error("Name already taken");

    await ctx.db.insert("players", {
      name,
      passwordHash: simpleHash(args.password),
      createdAt: Date.now(),
    });

    return { name };
  },
});

export const login = mutation({
  args: {
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().toUpperCase().slice(0, 12);

    const player = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    if (!player) throw new Error("Player not found");
    if (player.passwordHash !== simpleHash(args.password)) {
      throw new Error("Wrong password");
    }

    return { name: player.name };
  },
});

export const checkName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const name = args.name.trim().toUpperCase().slice(0, 12);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    return { taken: !!existing };
  },
});
