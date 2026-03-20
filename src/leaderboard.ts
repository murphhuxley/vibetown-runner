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

// ── Auth ──

export async function registerPlayer(name: string, password: string): Promise<string> {
  const result = await client.mutation(api.auth.register, { name, password });
  return result.name;
}

export async function loginPlayer(name: string, password: string): Promise<string> {
  const result = await client.mutation(api.auth.login, { name, password });
  return result.name;
}

export function getStoredPlayer(): string | null {
  return localStorage.getItem('vibetown-player');
}

export function storePlayer(name: string): void {
  localStorage.setItem('vibetown-player', name);
}

export function clearStoredPlayer(): void {
  localStorage.removeItem('vibetown-player');
}

// ── Leaderboard ──

export async function submitScore(name: string, score: number, level: number): Promise<string> {
  return await client.mutation(api.leaderboard.submit, { name, score, level }) as string;
}

export async function getTop25(): Promise<LeaderboardEntry[]> {
  return await client.query(api.leaderboard.getTop25) as LeaderboardEntry[];
}
