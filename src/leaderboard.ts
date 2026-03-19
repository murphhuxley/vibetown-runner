import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL as string);

export interface LeaderboardEntry {
  _id: string;
  name: string;
  score: number;
  level: number;
  createdAt: number;
}

export async function submitScore(name: string, score: number, level: number): Promise<string> {
  return await client.mutation(api.leaderboard.submit, { name, score, level }) as string;
}

export async function getTop25(): Promise<LeaderboardEntry[]> {
  return await client.query(api.leaderboard.getTop25) as LeaderboardEntry[];
}
