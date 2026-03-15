# Lode Runner Deep Research Report
## Technical Design Reference for Vibetown Runner

Compiled 2026-03-14 from reverse engineering docs, forum analysis, original manuals, sprite sheets, and multiple remakes.

---

## 1. Tile / Brick Dimensions & Grid Layout

### Original Apple II (1983)
- **Screen resolution**: 280 x 192 pixels (Apple II Hi-Res mode)
- **Grid**: 28 columns x 16 rows
- **Tile size**: 10 pixels wide x 11 pixels tall
- **Playable area**: 280 x 176 pixels (28 x 10 = 280w, 16 x 11 = 176h)
- **Remaining vertical space**: 16 pixels below playfield used for score/lives/level HUD
- **No margins on left/right** -- the 28 tiles fill the full 280px width exactly

### Commodore 64 Port
- **Display mode**: 160 x 200 multicolor bitmap (double-width pixels = effectively 320 x 200)
- **Grid**: 28 columns x 16 rows (same as Apple II)
- **Tile size**: 5 pixels wide x 11 pixels tall (5 "fat" pixels = 10 screen pixels)
- **Side margins**: 10 pixels on left and right
- **Bottom bar**: 24 pixels tall for HUD

### NES Port
- **Base tile unit**: 8 x 8 pixels (NES hardware constraint)
- **Metatiles**: 2 x 2 arrangements of 8x8 tiles forming 16 x 16 pixel blocks
- **Tileset sprite sheet**: 176 x 96 pixels total
- **Character sprite sheet**: 192 x 80 pixels total

### IBM PC Version
- **Grid**: 26 columns x 16 rows (narrower than original)
- **Tile size**: 12 pixels wide (adjusted for CGA/EGA)

### Key Ratio: Character vs Tile
- **Apple II**: Character fits within a single tile cell (10 x 11 px). The character sprite occupies roughly 7-8 px wide x 10-11 px tall within that cell. The character is essentially the same size as one tile.
- **This is the critical insight**: In the original, the player sprite is approximately 1 tile wide and 1 tile tall. There is no "huge character in a big tile" situation. Characters and tiles are the same scale.

### Current Vibetown Runner vs Original
| Property | Original Apple II | Vibetown Runner | Ratio |
|---|---|---|---|
| Grid cols | 28 | 28 | Same |
| Grid rows | 16 | 20 | 1.25x taller |
| Tile size | 10 x 11 px | 32 x 32 px | ~3x larger |
| Character:tile ratio | 1:1 | ~1:1 | Same concept |
| Total playfield | 280 x 176 | 896 x 672 | ~3x larger |

**Recommendation for smaller bricks**: The original's tiles were NOT square -- they were wider than tall (10:11 ratio is nearly square, but the visual "brick" pattern inside was what created the small-brick feel). Each 10x11 tile contained a 2-row brick pattern: one horizontal mortar line at the vertical midpoint, with staggered vertical mortar lines in each half. This made each visible "brick" roughly **5 x 5 pixels** (half the tile width, half the tile height). The bricks appeared small because the pattern subdivided each tile into 4 visible bricks.

---

## 2. Level Layout & Platform Spacing

### Grid Structure
- **28 columns x 16 rows** is the canonical layout
- All versions maintain 28-wide (except IBM PC at 26)
- Floor rows are typically solid brick spanning all 28 columns
- Ladders cut through floors vertically, creating openings

### Vertical Spacing Patterns
- **Typical floor gap**: 3-5 empty rows between solid brick floors
- **Level 1 pattern**: Floors at rows 2, 9, 15 (bottom) with 6-row gaps
- **Ladder columns**: Usually 2-3 ladder columns per level, spanning multiple floors
- **Rope rows**: Placed 1-2 rows below a floor, creating a horizontal traverse
- **Top of screen**: Row 0 is always empty (exit zone after collecting all gold)
- **Bottom floor**: Usually rows 15-16 are solid brick (ground level)

### Level Design Tile Types (Apple II values)
```
0 = Empty space
1 = Diggable brick (sand in Vibetown)
2 = Solid/indestructible brick (coral in Vibetown)
3 = Ladder
4 = Rope (horizontal bar for shimmying)
5 = False/trap brick (looks solid, falls through)
6 = Hidden ladder (appears when all gold collected)
7 = Gold chest (badge in Vibetown)
8 = Guard spawn (duck spawn in Vibetown)
9 = Player spawn
```

### Level Data Format
- 14 bytes per row (28 tiles / 2 = 14 bytes, each byte holding two 4-bit tile values)
- Levels stored sequentially on disk
- 150 levels in original, plus built-in level editor

### Platform Spacing Philosophy
The original used very tight spacing. With only 16 rows, vertical real estate was precious. Common patterns:
- **Single-row floors** with 2-3 row gaps
- **Inverse pyramid**: Digging creates a 3-wide trench, which allows a 2-wide trench below, then a 1-wide pit (critical puzzle pattern)
- **Pocket chambers**: Single-tile recesses in walls that trap the player if a guard blocks the exit
- **Hanging gold**: Gold placed one tile below a rope, requiring the player to drop and grab

---

## 3. Character Proportions

### Apple II Original
- **Character sprite**: Approximately 7-8 pixels wide x 10-11 pixels tall
- **Sprite buffer**: 3 bytes wide x 12 rows tall (36 bytes total) per frame
  - 3 bytes = 21 pixel columns in Apple II HGR mode (7 pixels per byte)
  - So the sprite rendering window is 21 x 12 pixels, but the visible character is smaller within that
- **Character-to-tile ratio**: Nearly 1:1 (character fills most of one tile cell)
- **Head**: ~3 px tall, torso ~4 px, legs ~3-4 px
- **The Filfre.net article references "10x12 size pixel characters"** shared with Choplifter's art pipeline

### NES Version
- **Character sprites**: Composed of multiple 8 x 8 sprites
- **Effective character size**: ~16 x 16 pixels (2 x 2 sprite arrangement)
- **Sprite sheet**: 192 x 80 pixels containing all character frames

### Proportions That Matter
- The character is a **stick figure** -- minimal detail, maximum readability
- Head is roughly 1/3 of total height
- Body is narrow (about 60-70% of tile width)
- In the original, you can see space on either side of the character within the tile
- Guards/monks are the same size as the player, distinguished only by color

---

## 4. Animation & Movement

### Movement System
- **Pixel-level movement** between tiles (this was a key Broderbund requirement)
- Doug Smith's original prototype used "block increments" (tile-snapping), which Broderbund rejected as "too primitive"
- Smith received $10,000 advance specifically to develop smooth inter-tile animation
- Characters move **1 pixel per update frame** through each tile cell
- Movement feels **sliding/gliding** -- smooth transition, not snappy or jerky

### Movement Speed
- **Player moves faster than guards** (both running and falling)
- Player falls faster than guards -- this is a critical gameplay mechanic allowing you to outrun falling guards
- The Lode Runner 2020 remake notes: "Guards' moving are calculated at every nth (varying) frame while player moves every frame"
- Guards effectively move at roughly 60-75% of player speed
- **5 speed settings** available in Championship Lode Runner

### Animation Frames
- **Run cycle**: 3-4 frames per direction (smooth four-frame animations confirmed by multiple sources)
- **Climbing**: Separate animation, typically 2-3 frames alternating arm positions
- **Rope shimmy**: Distinct hanging animation with hand-over-hand movement
- **Digging**: Separate dig animation, character bends to dig diagonally down-left or down-right
- **Falling**: Typically uses a single "arms up" falling frame
- **Idle**: Single standing frame

### Animation Timing
- **Vibetown Runner currently uses 80ms per frame** (ANIM_FRAME_MS = 80) = 12.5 animation FPS
- The original Apple II ran at approximately 1 MHz with the game loop tied to the CPU clock
- Effective animation rate was roughly 8-12 FPS for character animation, with the game updating at ~15-20 FPS overall
- Movement was smooth because it was 1-pixel increments per update, not because of high frame rate

### Control Feel
- "Controls are basically perfect with nary a missed input" (Data Driven Gamer)
- Joystick recommended over keyboard in original
- The engine is "astonishingly fluent" -- press right+up and the character walks right until hitting a ladder, then automatically climbs
- Movement is "slightly slower" than predecessor Miner 2049er -- "less twitchy without becoming sluggish"

---

## 5. Visual Style Details

### Brick/Sand Rendering (Original Apple II)
- **Brick texture**: Simple cross-hatch / mortar-line pattern
- Each tile has a **horizontal mortar line at the vertical midpoint**
- **Staggered vertical mortar lines**: In the top half, a vertical line at tile center. In the bottom half, vertical lines at 1/4 and 3/4 positions (standard brick stagger)
- This creates the appearance of **4 individual bricks per tile** (2 rows x 2 columns, staggered)
- Color: Reddish-brown bricks on Apple II, with mortar lines in darker shade
- The Apple II version's "brick lines are too thick" according to the Sega-16 review -- a common complaint
- **No texturing within individual bricks** -- just flat color with mortar lines

### Ladder Rendering
- Two vertical rails (side posts)
- 2-3 horizontal rungs evenly spaced within the tile
- White/light color on dark background
- Ladders always span full tile height and connect seamlessly between vertically adjacent ladder tiles

### Rope Rendering
- Single horizontal line at the vertical midpoint of the tile
- Typically white or tan colored
- Character hangs below the rope line (offset downward)
- Ropes connect seamlessly horizontally between adjacent rope tiles

### Gold/Badge Rendering
- Small collectible item centered in the tile
- In original: small chest or bar shape
- The Apple II version's "treasure graphics too muted" per Sega-16 review
- Should have visual pop/contrast against the background

### Hole Rendering (When Dug)
- Digging creates a visual hole in the brick
- The brick appears to crumble/disappear from one side (the side being dug from)
- Regeneration is visible -- the hole gradually fills back in
- The block check for killing happens "every 4th frame" to see if the player is inside a rematerializing block

### Indestructible Brick (Cement/Coral)
- Visually distinct from diggable brick
- Typically shown as metal or concrete with different texture/color
- Same size as diggable brick but no mortar line pattern (solid fill)

### Color Palette
- Original Apple II: Limited to ~6 hi-res colors (black, white, green, purple, orange, blue)
- Backgrounds are black
- Bricks are colored (red/orange on Apple II, different per platform)
- Ladders and ropes are white
- Player and guards are different colors (player = one color, guards = "mint" on C64)
- **4 colors used strategically** per the design constraints

### What Made It Look Good
1. **Black background** creates maximum contrast with gameplay elements
2. **Consistent tile scale** -- everything reads clearly at small sizes
3. **Minimal detail** -- just enough to identify tile types instantly
4. **Color coding** -- each element type has a distinct, non-overlapping color
5. **The grid is invisible** -- tiles flow together seamlessly (bricks connect, ladders connect)
6. **Small character scale** makes levels feel large and explorable

---

## 6. Gameplay Mechanics

### Core Loop
1. Collect ALL gold chests on the level
2. Hidden escape ladders appear (with a musical chime)
3. Climb to the very top row of the screen to complete the level
4. Advance to next level, receive 1 extra life

### Digging Rules
- Player can ONLY dig diagonally down-left or down-right
- Cannot dig straight down
- Can only dig **diggable brick** (type 1), not cement/solid (type 2)
- The tile below-and-to-the-side of the player is destroyed
- Player must be standing on a surface to dig (cannot dig while falling, climbing, or on rope)
- Only one hole can exist at a time (per original -- some versions allow multiple)

### Hole Mechanics
- **Hole regeneration time**: ~10 seconds
- **Guard escape time**: Guards begin climbing out almost immediately upon falling in, taking 2-3 seconds to escape if unhindered
- **Guard death**: If a guard hasn't escaped when the hole regenerates, the guard is killed
- **Guard respawn**: Killed guards instantly respawn at a random position near the top of the screen
- **Player death**: If the player is inside a regenerating hole, the player dies
- **Gold drop**: Guards carrying gold drop it when they fall into a hole (gold appears at the hole location)
- **Block regeneration check**: Every ~4 frames, game checks if anyone is inside a rematerializing block

### Guard/Enemy AI
- **Up to 5 guards per level**
- Guards cannot dig
- Guards move slower than the player
- **Same-level behavior**: If on the same vertical level with a clear path, guard moves directly toward the player
- **Different-level behavior**: Guards score potential moves (down/up/left/right) based on how closely each move brings them to the player's vertical position
  - Best score (0) = reaching the exact level of the player
  - Otherwise: score = number of tiles away from player's level
  - When tied, **left is preferred over right, down over up**
- **Ladder exit rules**: Guards will NOT jump off a ladder into freefall unless at the very top or bottom
- **Known AI bugs**:
  - Guards at ladder bases can get stuck in climb/descend loops
  - Wall collision uses foot position, causing guards to walk into walls sometimes
  - AI has "blind spots" -- accessible positions it won't pursue
  - Guards sometimes move away from the player when on the same ladder
- **Walking on guards**: Player can walk on top of trapped guards (stand on their heads)
- **Safe states**: Player is invulnerable while actively digging or climbing ladders

### Scoring (Original Apple II Manual)
- Gold chest collected: **500 points** (Grokipedia says 100; manual says 500)
- Guard trapped in hole: **100 points**
- Guard killed by regeneration: **100 points**
- Level completed: **2,000 points** (Grokipedia says 1,500 per level; manual/FAQ says 2,000)
- Note: C64 Wiki shows different values (250/75/75/1,500) suggesting platform variation

### Current Vibetown Runner scoring for reference:
- Badge: 250, Trap duck: 75, Kill duck: 75, Level complete: 1,500

### Lives System
- **Starting lives**: 5
- **Extra life**: 1 per level completed
- **Losing a life**: Caught by guard, or crushed by regenerating brick
- **Continue**: Can save/load game progress
- **No time limit** (guards provide pressure instead)

### Movement Properties
- Player can fall any distance without dying
- Player cannot jump (no jump mechanic at all)
- Falling is the only downward movement besides ladders
- Player on rope hangs below the rope tile
- Player can transition from rope to ladder seamlessly

---

## 7. Sequels & Later Versions

### Championship Lode Runner (1984)
- **50 levels** (fan-designed, intended for experts only)
- **Same mechanics** -- no new tile types, enemies, or items
- **Much harder** -- each level takes roughly 2x as long as original levels
- **No level editor** (removed)
- **Must play in order** (cannot skip levels)
- **5 adjustable speed settings**
- **Password system** for progress saving

### Lode Runner: The Legend Returns (1994, Presage/Sierra)
- **150 single-player levels** across 10 themed worlds:
  1. Moss Caverns (jungle)
  2. Fungus Delvings
  3. Lost City of Ur (ancient)
  4. Crystal Hoard
  5. Winter's Dungeon (ice)
  6. Skeleton's Keep (fossil)
  7. Inferno's Playground (lava)
  8. Shimmering Caverns (phosphorus)
  9. Shadowlands (dark)
  10. Meltdown Metropolis (industrial)
- **Visual upgrade**: Hand-drawn characters and environments, expressive animations
- **New items** (one at a time): Snare traps, incapacitating sprays, jackhammers, two bomb types, pickaxes, goo buckets
- **New tile type**: Gooey turf (slows both player and enemies)
- **Dynamic level elements**: Crumbling floors, moving platforms, bombs, acid drips, trap mechanisms
- **New enemy types** with different tactics required
- **Cooperative multiplayer** (2 players tackling levels together)
- **Level editor** included

### Lode Runner Online: The Mad Monks' Revenge (1995, Presage/Sierra)
- Bug-fixed and expanded version of Legend Returns
- **Online multiplayer for up to 4 players**
- Additional gameplay features beyond Legend Returns
- **Fan community still active** -- "Definitive Edition" cross-platform remake exists (mmr.quarkrobot.com)
- Same graphics, gameplay, and even intentional bug preservation

### Lode Runner 3-D (1999, N64)
- **136 single-player levels + 20 bonus levels**
- 3D environments with similar puzzle mechanics
- Lost much of the original's clarity due to perspective changes

### Lode Runner (Xbox Live Arcade, 2009)
- **220 levels** across 6 gameplay modes
- Modern HD graphics

### Lode Runner Legacy (2017)
- **200+ levels** with voxel/3D pixel art graphics
- Combines classic gameplay with modern visual style

---

## 8. Specific Recommendations for Vibetown Runner

Based on this research, here are concrete changes that would bring the game closer to the original's proportions and feel:

### Brick Size (The "Smaller Bricks" Ask)
The current 32 x 32 tiles with a 2-brick pattern (one horizontal line, two stagger lines) look chunky because each visible "brick" is 16 x 16 pixels. Options:
1. **Subdivide the brick pattern more**: Draw a 4-brick-wide x 3-brick-tall pattern within each 32px tile (bricks roughly 8 x 10 px each, with 1px mortar lines)
2. **Reduce tile size**: Going to 24 x 24 with a 16-row grid would give 672 x 384 playfield -- closer to original proportions
3. **Add mortar line detail**: The original's charm came from the mortar-line grid, not from brick surface texture. More mortar lines = smaller apparent bricks

### Grid Dimensions
The current 28 x 20 grid is 4 rows taller than the original's 28 x 16. Consider:
- Keeping 28-wide (correct)
- Reducing to 16 rows (authentic) or 18 rows (slight compromise)
- Wider vertical spacing between platforms if keeping 20 rows

### Movement Feel
Current PLAYER_SPEED = 6 pixels/frame at 32px tiles means the player crosses one tile in ~5.3 frames. The original moved 1 pixel/frame across 10px tiles = 10 frames per tile. The current movement may feel too fast relative to level size. Consider tuning speed so tile-crossing time matches the original's pacing.

### Guard Speed
Current DUCK_SPEED = 4 (67% of player speed 6). Original guards were roughly 60-75% of player speed. This is in the right range, but guards should also fall noticeably slower than the player (current: 8 vs 10 = 80%, could be pushed to 65-70%).

### Hole Regeneration
Current 10-second regen matches the original. The escape time (5s) may be generous -- original guards began escaping almost immediately and took 2-3 seconds. Consider 3-4 seconds.

### Visual Improvements to Consider from Legend Returns
- Themed worlds with distinct color palettes (already partially implemented with themes)
- New tile types (goo/slow terrain, crumbling floors, moving platforms)
- Collectible items/power-ups (one at a time)
- Dynamic level elements

---

## Sources

- [The Digital Antiquarian (Filfre.net) - Lode Runner](https://www.filfre.net/2020/12/lode-runner/)
- [Lode Runner Reverse Engineering (GitHub)](https://github.com/RobertBaruch/lode_runner_reveng)
- [Lode Runner Reverse Engineered Announcement](https://www.callapple.org/software/lode-runner-for-the-apple-ii-reverse-engineered/)
- [C64-Wiki Lode Runner](https://www.c64-wiki.com/wiki/Lode_Runner)
- [Lemon64 Forum - Tile Dimensions Discussion](https://www.lemon64.com/forum/viewtopic.php?t=65882)
- [Data Driven Gamer - Lode Runner](https://datadrivengamer.blogspot.com/2021/01/game-230-lode-runner.html)
- [Data Driven Gamer - Championship Lode Runner Guard AI](https://datadrivengamer.blogspot.com/2023/01/championship-lode-runner-guard.html)
- [Grokipedia - Lode Runner](https://grokipedia.com/page/Lode_Runner)
- [ZX81 Keyboard Adventure - Level Design Analysis](https://www.zx81keyboardadventure.com/2017/02/lode-runner-on-zx81-part-2-level-design.html)
- [Spriters Resource - NES Lode Runner Tileset](https://www.spriters-resource.com/nes/loderunner/sheet/54719/)
- [Spriters Resource - NES Lode Runner Characters](https://www.spriters-resource.com/nes/loderunner/sheet/24138/)
- [Defence-Force Forum - Oric Lode Runner](https://forum.defence-force.org/viewtopic.php?t=12)
- [Apple II Docs - Lode Runner Manual](https://gswv.apple2.org.za/a2zine/Docs/LodeRunnerDocs.txt)
- [Sega-16 - Lode Runner Review](https://www.sega-16.com/2025/09/lode-runner/)
- [TAS Videos - Hyper Lode Runner](https://tasvideos.org/GameResources/GB/HyperLodeRunner)
- [Lode Runner 2020 Remake (GitHub)](https://github.com/Ma-Pe-Ma/Lode-Runner-2020)
- [Lode Runner-NG Remake (GitHub)](https://github.com/vchimishuk/loderunner-ng)
- [Mad Monks' Revenge Definitive Edition](https://mmr.quarkrobot.com/)
- [PICO-8 Lode Runner Classic](https://www.lexaloffle.com/bbs/?tid=45988)
- [Slynyrd Pixel Art Brick Tutorial](https://www.slynyrd.com/blog/2023/7/21/pixelblog-45-bricks-walls-doors-and-more)
- [Lode Runner Classic Official Site](https://www.loderunnerclassic.com/)
- [Macintosh Repository - Lode Runner](https://www.macintoshrepository.org/8393-lode-runner)
