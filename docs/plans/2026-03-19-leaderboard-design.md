# Leaderboard Design

## Overview
Global leaderboard for Vibetown Runner. Players submit name + score + level reached after Game Over or Victory. Top 25 displayed.

## Backend — Convex
- **Table:** `leaderboard` — `name` (string, 12 char max), `score` (number), `level` (number), `createdAt` (number/timestamp)
- **Mutation:** `submit(name, score, level)` — validates name length, inserts entry
- **Query:** `getTop25()` — returns top 25 entries sorted by score descending

## Score Submission Flow
1. Game ends (GameOver or Victory phase)
2. Phase overlay shows final score + text input for name
3. Player types name (max 12 chars), hits SUBMIT
4. Convex mutation fires, entry saved
5. Leaderboard modal opens with their entry highlighted

## Leaderboard Screen
- HTML modal overlay (same pattern as Instructions/Options modals)
- Dark background `#1a1a1a`, gold border `#F5D76E`
- Title "LEADERBOARD" in Brice Bold, pixelated (render small, scale up)
- Columns: RANK, NAME, SCORE, LVL
- All text in Brice Bold with `image-rendering: pixelated`
- Top 25 entries
- BACK button to return to menu

## Menu Integration
- LEADERBOARD button (4th button, replaces QUIT) opens the leaderboard modal
- New button handler in main.ts

## Entry Data
- `name`: string, max 12 characters
- `score`: number (from game.state.score)
- `level`: number (from game.state.currentLevel)
- `createdAt`: Date.now() timestamp
