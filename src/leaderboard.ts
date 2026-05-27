import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
let client: ConvexHttpClient | null = null;

function getClient(): ConvexHttpClient {
  if (!convexUrl) {
    throw new Error("Leaderboard unavailable: VITE_CONVEX_URL is not configured.");
  }
  client ??= new ConvexHttpClient(convexUrl);
  return client;
}

export interface LeaderboardEntry {
  _id: string;
  name: string;
  score: number;
  level: number;
  createdAt: number;
}

// ── Auth ──

export async function registerPlayer(name: string, password: string): Promise<string> {
  const result = await getClient().mutation(api.auth.register, { name, password });
  return result.name;
}

export async function loginPlayer(name: string, password: string): Promise<string> {
  const result = await getClient().mutation(api.auth.login, { name, password });
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
  return await getClient().mutation(api.leaderboard.submit, { name, score, level }) as string;
}

export async function getTop25(): Promise<LeaderboardEntry[]> {
  return await getClient().query(api.leaderboard.getTop25) as LeaderboardEntry[];
}
