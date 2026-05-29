# Decisions

This file is the single source of truth for architectural, design, and organizational decisions made without an explicit user-directed implementation choice.

## Decision Log Rules

- Log decisions that change architecture, data flow, game rules, asset organization, build/deploy behavior, or long-term maintainability.
- Do not log direct execution of explicit user instructions unless an independent implementation choice is required.
- Each entry must include context, decision, standards-backed evidence, why the decision was made independently, and consequences.
- Prefer one clean information flow over fallbacks, compatibility branches, or legacy support.

## 2026-05-27 — Use Live Outstanding Bag State For Hidden Ladder Reveal

**Context:** Hidden ladders sometimes failed to reveal after all visible money bags were gone, especially on levels where ducks can steal and later drop bags. The user explicitly wanted to preserve ducks picking up bags, but did not prescribe the state model for reveal eligibility.

**Decision:** Hidden ladder reveal eligibility is derived only from the live game state: money bags still on the grid plus money bags currently carried by ducks.

**Standards-backed evidence:** ISO/IEC/IEEE 42010 emphasizes documenting architectural decisions and rationale as part of an architecture description. This decision also follows the single-source-of-truth principle: the authoritative game rule should come from the live collectible state, not from a counter that can drift when entities temporarily own collectibles. The local Lode Runner research states hidden escape ladders appear when all gold is collected, so the implementation now models the rule as "no gold remains collectable or carried."

**Why this was independent:** The prompt identified the symptom and clarified that duck bag pickup should remain. I chose the live-state derivation because it fixes intermittent counter drift without removing the feature or adding a parallel compatibility path.

**Consequences:** The hidden ladder can reveal after every bag has been truly cleared, including bags stolen and later recovered from ducks. It will not reveal while a duck is still carrying a bag. This keeps one clean rule for level completion and avoids special-case retry/death behavior.

## 2026-05-27 — Treat Rope-Ladder Crossings As Climbable Ladder Continuity

**Context:** Some ladder segments could be climbed upward but not downward when a rope occupied the middle cell of the ladder. The level art and player intent communicate a ladder/rope crossing, but the tile grid can store only one tile type per cell.

**Decision:** A `Rope` tile is considered climbable when a `Ladder` tile exists directly above or below it in the same column. This makes rope-ladder crossings behave as continuous ladder routes while preserving rope traversal.

**Standards-backed evidence:** ISO/IEC/IEEE 42010 supports recording rationale for architecture-relevant representation decisions. The local Lode Runner research notes that controls should be fluent and that rope-to-ladder transitions should be seamless. Treating the crossing as climbable also follows the principle of making the domain model match player-visible semantics: the visible crossing means "both rope and ladder are usable here."

**Why this was independent:** The prompt identified the bug, but did not prescribe how to model intersections. I chose this rule because it preserves the single tile grid, avoids parallel overlay/fallback systems, and turns the existing rendered structure into one consistent movement truth.

**Consequences:** Players can descend through rope interruptions in ladder columns. Horizontal rope movement is unchanged. Any rope tile adjacent vertically to a ladder in the same column now also acts as climbable, so level authors should avoid placing decorative rope directly between unrelated ladder tiles unless they intend a crossing.

## 2026-05-27 — Centralize Duck Pressure In A Campaign Curve

**Context:** Feedback called out that level 18 felt under-pressured with only three ducks, while also asking to cap duck counts at five for the current 25-level campaign until performance and later expansion are ready.

**Decision:** Duck counts are now derived from one campaign pressure function: levels 1-5 use one duck, 6-10 use two, 11-15 use three, 16-17 use four, and levels 18+ use five under the current cap.

**Standards-backed evidence:** ISO/IEC/IEEE 42010 frames architecture decisions around explicit concerns and rationale; centralizing progression in one module keeps the balancing concern traceable. The local Lode Runner research notes that enemy pressure is a primary difficulty lever, but level pressure should increase through route design and guard count together rather than isolated ad hoc edits.

**Why this was independent:** The prompt requested a cap and directionally asked for stronger level-18 pressure, but did not prescribe an implementation model. I chose a single pressure curve to avoid duplicating duck-count rules across levels, validators, tests, and future generators.

**Consequences:** Every authored and mirrored variant is validated against the same target count. Future 50-level work can extend the pressure curve in one place instead of hunting through individual level files, while the current campaign stays capped at five ducks.

## 2026-05-27 — Use One Duck Occupancy Map Per Movement Tick

**Context:** Raising later levels to five ducks increases simultaneous enemy movement. The duck AI already avoids occupied duck tiles, but it rebuilt that occupancy data inside each duck decision.

**Decision:** Duck movement now builds one occupied-position set per duck movement tick and updates it as each duck moves.

**Standards-backed evidence:** ISO/IEC/IEEE 25010 identifies performance efficiency and reliability as product quality characteristics. A per-tick occupancy map reduces repeated allocation/work and keeps enemy collision decisions consistent across a single simulation step. It also follows the single-source-of-truth principle: duck occupancy for that tick is represented once and passed through the movement decision.

**Why this was independent:** The user requested a five-duck cap and smoother difficulty scaling, but did not prescribe how duck movement should manage occupancy. I chose this model because it supports the new pressure curve without adding a secondary AI mode or compatibility branch.

**Consequences:** Five-duck levels have less avoidable per-duck overhead, and ducks make movement choices against the latest reserved positions for the current tick. Duck AI behavior remains the same in intent, but stacking and same-step contention are handled more cleanly.

## 2026-05-27 — Align Beatability Validation With Runtime Movement Semantics

**Context:** The campaign already had a validator that checks money-bag reachability and post-collection escape reachability. During the final beatability audit, that validator still treated false bricks as physical support even though runtime physics treats `TrapSand` as non-solid, and it had its own climb checks separate from the player movement rules.

**Decision:** The validator now separates visual solids from physical solids. False bricks still count as visual geometry for rope/headroom audits, but only real platform tiles count as physical support or blocking for reachability. Reachability also models rope-ladder crossings as climbable continuity, matching the player movement model.

**Standards-backed evidence:** ISO/IEC/IEEE 25010 names functional suitability and reliability as product quality characteristics; a beatability proof is only reliable when it models the same rules the game runtime uses. ISO/IEC/IEEE 42010 supports documenting architecture-impacting rationale, and the local Lode Runner research identifies false bricks as visually solid but physically pass-through.

**Why this was independent:** The prompt asked whether the game was still beatable, but did not prescribe how to audit that. I chose to correct the validator first because otherwise the audit could pass for the wrong reason, creating a false sense of safety before launch.

**Consequences:** Level-pack tests now catch routes that only work if a false brick is incorrectly treated as a real floor. Visual spacing checks still protect the player sprite from clipping into trap-brick art. Future movement-rule changes should update this validator in the same pass so beatability remains one clean source of truth.

## 2026-05-27 — Freeze Trapped Duck Escape Timers During LFV

**Context:** LFV already freezes normal duck movement, but trapped-duck escape timers continued ticking. That created a mismatch where a duck could look like a trapped bridge while LFV was active, then escape mid-crossing and become lethal.

**Decision:** LFV now freezes all duck behavior, including trapped-duck escape timers, until LFV ends.

**Standards-backed evidence:** ISO/IEC/IEEE 25010 defines functional suitability and reliability as quality characteristics; a player-facing power mode should behave consistently with its communicated rule. This also keeps one information flow for duck freezing: the same LFV freeze state gates both active movement and trapped escape updates.

**Why this was independent:** The prompt identified the bug, but did not prescribe whether to ignore collisions, add invulnerability, or change trap timers. I chose to freeze trapped timers because it preserves the bridge mechanic and avoids adding a separate collision exception or fallback rule.

**Consequences:** Trapped ducks remain safe bridge tiles for the whole LFV window. They resume their escape countdown after LFV ends, while hole closing and duck death from closing holes can still proceed normally.

## 2026-05-27 — Keep Weather As Visual Flavor Only

**Context:** Weather had visual effects and gameplay speed multipliers. The player asked to remove weather speed dilation so movement stays consistent.

**Decision:** Weather speed now resolves to `1` for every weather type and entity, while the weather effects function still owns particles, rope sway, and high-tide visuals.

**Standards-backed evidence:** ISO/IEC/IEEE 25010 includes usability and functional suitability as quality characteristics; consistent controls are especially important in precision arcade platformers. Keeping the neutral multiplier in the existing weather module preserves a single source of truth for weather gameplay impact instead of scattering no-op checks through movement code.

**Why this was independent:** The prompt directed the gameplay outcome, but not the implementation shape. I chose to keep the weather multiplier API as the single neutral rule so future weather visuals do not accidentally reintroduce movement drift through a separate path.

**Consequences:** Rain, sunshine, trade winds, and high tide no longer change player or duck speed. Existing rendering and theme effects remain intact, and tests now lock weather speed behavior to consistent timing.

## 2026-05-28 — Resolve Duck Hole Entry In The Same Movement Tick

**Context:** Ducks could visually float over a dug hole for one frame because horizontal chase movement allowed them to step onto the unsupported air cell above the open cavity before gravity ran on the next duck tick.

**Decision:** Duck movement now collapses an unsupported horizontal chase step into an immediate downward move when the cell below is open, so a duck entering a dug hole commits to falling in the same simulation tick.

**Standards-backed evidence:** ISO/IEC/IEEE 25010 identifies functional suitability and reliability as software quality characteristics. Arcade collision rules should keep visual state and simulation state aligned; a one-frame contradiction creates unreliable feedback. The local Lode Runner research also treats dug holes as trap commitments for enemies, not as bridgeable air cells.

**Why this was independent:** The prompt identified the symptom but did not prescribe whether to fix animation, collision, or AI. I chose the simulation-level fix because it keeps rendering honest and avoids masking the issue with a sprite-specific fallback.

**Consequences:** Ducks no longer get a standing or turning frame over open holes. They still chase into holes when pathing dictates it, but trap entry is immediate and consistent with player expectation.
