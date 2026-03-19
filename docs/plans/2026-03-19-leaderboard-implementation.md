# Leaderboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global leaderboard where players submit name + score + level after Game Over / Victory, viewable from the menu.

**Architecture:** Convex backend (new setup in this project) with a `leaderboard` table. HTML modal overlay styled with Brice Bold pixelated text. Score submission via text input on Game Over / Victory overlays.

**Tech Stack:** Convex (backend + client SDK), existing Vite + TypeScript setup, HTML/CSS modal, Brice Bold font

---

### Task 1: Set Up Convex

**Files:**
- Create: `convex/schema.ts`
- Create: `convex/leaderboard.ts`
- Create: `convex/tsconfig.json`
- Modify: `package.json`

**Step 1: Install Convex**

Run: `cd ~/.openclaw/workspace/projects/vibetown-runner && npm install convex`

**Step 2: Initialize Convex project**

Run: `npx convex init`
Follow prompts — select existing project or create new one named `vibetown-runner`.

**Step 3: Create the schema**

Create `convex/schema.ts`:
```typescript
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
```

**Step 4: Create leaderboard functions**

Create `convex/leaderboard.ts`:
```typescript
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
    await ctx.db.insert("leaderboard", {
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
```

**Step 5: Deploy Convex schema**

Run: `npx convex dev` (starts dev server, pushes schema)
Note the deployment URL for the client.

**Step 6: Commit**

```bash
git add convex/ package.json package-lock.json
git commit -m "feat: set up Convex backend with leaderboard schema"
```

---

### Task 2: Create Convex Client Wrapper

**Files:**
- Create: `src/leaderboard.ts`

**Step 1: Create the client module**

Create `src/leaderboard.ts`:
```typescript
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

export async function submitScore(name: string, score: number, level: number): Promise<void> {
  await client.mutation(api.leaderboard.submit, { name, score, level });
}

export async function getTop25(): Promise<LeaderboardEntry[]> {
  return await client.query(api.leaderboard.getTop25) as LeaderboardEntry[];
}
```

**Step 2: Add env variable**

Create `.env.local`:
```
VITE_CONVEX_URL=<your convex deployment URL>
```

**Step 3: Commit**

```bash
git add src/leaderboard.ts .env.local
git commit -m "feat: add Convex client wrapper for leaderboard"
```

---

### Task 3: Add Leaderboard Modal HTML/CSS

**Files:**
- Modify: `index.html`

**Step 1: Add CSS for leaderboard modal + score submission modal**

Add styles for `#leaderboard-modal`, `#leaderboard-box`, `#leaderboard-list`, `.lb-header`, `.lb-row`, `.lb-rank`, `.lb-name`, `.lb-score`, `.lb-level`, `.lb-row.highlight`, `#score-submit`, `#score-submit-box`, `#score-name-input`.

All text in Brice Bold with `image-rendering: pixelated`. Dark background `#1a1a1a`, gold border `#F5D76E`.

**Step 2: Add HTML for both modals**

Leaderboard modal with header row (RANK, NAME, SCORE, LVL), entries container, BACK button.
Score submission modal with title, score display, name text input (max 12 chars), SUBMIT and SKIP buttons.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add leaderboard and score submission modal HTML/CSS"
```

---

### Task 4: Wire Up Leaderboard Display

**Files:**
- Modify: `src/main.ts`

**Step 1: Import leaderboard functions**

```typescript
import { getTop25, submitScore, LeaderboardEntry } from './leaderboard';
```

**Step 2: Add renderLeaderboard function**

Build leaderboard rows using DOM methods (createElement, textContent — no innerHTML for security). Each row shows rank, name, score, level. Optional highlight class for the player's own entry.

**Step 3: Add showLeaderboard function**

Fetches top 25 via `getTop25()`, calls `renderLeaderboard()`, shows the modal.

**Step 4: Wire LEADERBOARD menu button**

Replace the `btn-quit` handler with `showLeaderboard()`.

**Step 5: Wire BACK button**

Hides the leaderboard modal.

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire leaderboard button to fetch and display top 25"
```

---

### Task 5: Add Score Submission on Game Over / Victory

**Files:**
- Modify: `src/main.ts`

**Step 1: Add submission state**

Track `hasSubmittedThisRun` boolean, reset on `game.restart()`.

**Step 2: Add showScoreSubmit function**

Populates score display, clears name input, shows the submission modal, focuses the input.

**Step 3: Wire SUBMIT button**

On click: validate name, hide modal, call `submitScore()`, then `showLeaderboard()` with highlight.

**Step 4: Wire SKIP button**

Hides modal, sets `hasSubmittedThisRun = true`.

**Step 5: Trigger submission on game end**

When Game Over or Victory is detected and Enter is pressed, show the score submission modal before allowing retry.

**Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: add score submission on game over and victory"
```

---

### Task 6: Final Polish + Deploy

**Step 1: Rename btn-quit to btn-leaderboard** in index.html and main.ts.

**Step 2: Set VITE_CONVEX_URL** in Vercel environment variables.

**Step 3: Run npx convex deploy** to push schema to production.

**Step 4: Test full flow**
- Play → die → Game Over → submit name → see leaderboard
- Menu → LEADERBOARD → see scores
- Victory → submit → see leaderboard

**Step 5: Commit and deploy**

```bash
git add -A
git commit -m "feat: complete leaderboard with Convex backend"
git push
npx vercel --prod --yes
```
