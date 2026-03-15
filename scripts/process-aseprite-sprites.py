#!/usr/bin/env python3
"""
Process Aseprite-exported individual frames into game sprite strips.

Key fix: aligns all frames by their BOTTOM edge (feet baseline) so the character
doesn't bounce up/down between frames. Each frame is placed in a uniform-size
slot with feet anchored to the bottom.
"""

from PIL import Image
import os

DL = os.path.expanduser("~/Downloads")
OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "assets", "sprites")

# Run frames in cycle order (all face right)
RUN_FRAMES = [
    os.path.join(DL, "RUN0.png"),
    os.path.join(DL, "RUN-1-export.png"),
    os.path.join(DL, "RUN-2-export.png"),
    os.path.join(DL, "RUN4--expornewt.png"),
    os.path.join(DL, "RUN5--expornewt.png"),
]

IDLE_PATH = os.path.join(DL, "Craig-export.png")
CLIMB_FRAMES = [
    os.path.join(DL, "HANGING1--export.png"),
    os.path.join(DL, "HANGING2--export.png"),
]


TARGET_H = 84  # Uniform height for all sprites


def get_content_bbox(img: Image.Image) -> tuple:
    """Get bounding box of non-transparent pixels."""
    return img.getbbox()  # (left, top, right, bottom)


def make_aligned_strip(paths: list[str]) -> tuple[Image.Image, int]:
    """
    Load frames, crop to content, scale each to TARGET_H (nearest neighbor),
    place in uniform slots centered horizontally.
    """
    frames = [Image.open(p).convert("RGBA") for p in paths]
    bboxes = [get_content_bbox(f) for f in frames]

    scaled = []
    for frame, bbox in zip(frames, bboxes):
        content = frame.crop(bbox)
        cw, ch = content.size
        ratio = TARGET_H / ch
        new_w = max(1, round(cw * ratio))
        scaled.append(content.resize((new_w, TARGET_H), Image.NEAREST))

    widths = [s.width for s in scaled]
    print(f"  Scaled widths: {widths} (all {TARGET_H}px tall)")

    max_w = max(widths)
    slot_w = max_w + 4

    print(f"  Uniform slot: {slot_w}x{TARGET_H}")

    strip = Image.new("RGBA", (slot_w * len(scaled), TARGET_H), (0, 0, 0, 0))

    for i, sf in enumerate(scaled):
        offset_x = (slot_w - sf.width) // 2
        strip.paste(sf, (i * slot_w + offset_x, 0))

    return strip, slot_w, TARGET_H


def mirror_strip(strip: Image.Image, frame_width: int) -> Image.Image:
    """Mirror each frame individually within the strip."""
    frame_count = strip.width // frame_width
    mirrored = Image.new("RGBA", strip.size, (0, 0, 0, 0))

    for i in range(frame_count):
        frame = strip.crop((i * frame_width, 0, (i + 1) * frame_width, strip.height))
        frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
        mirrored.paste(frame, (i * frame_width, 0))

    return mirrored


def make_aligned_single(path: str) -> Image.Image:
    """Process a single frame: crop, scale to TARGET_H (nearest neighbor)."""
    img = Image.open(path).convert("RGBA")
    bbox = get_content_bbox(img)
    content = img.crop(bbox)
    cw, ch = content.size
    ratio = TARGET_H / ch
    new_w = max(1, round(cw * ratio))
    scaled = content.resize((new_w, TARGET_H), Image.NEAREST)

    sw = new_w + 4
    out = Image.new("RGBA", (sw, TARGET_H), (0, 0, 0, 0))
    offset_x = (sw - new_w) // 2
    out.paste(scaled, (offset_x, 0))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)

    # Verify all files exist
    all_paths = RUN_FRAMES + [IDLE_PATH] + CLIMB_FRAMES
    for p in all_paths:
        if not os.path.exists(p):
            print(f"MISSING: {p}")
            return

    # --- Run strips (bottom-aligned) ---
    print("Run frames:")
    run_strip, run_fw, run_fh = make_aligned_strip(RUN_FRAMES)
    run_strip.save(os.path.join(OUT, "player-run-right.png"))
    print(f"  -> player-run-right.png: {run_strip.size}, frame={run_fw}x{run_fh}, frames={len(RUN_FRAMES)}")

    run_left = mirror_strip(run_strip, run_fw)
    run_left.save(os.path.join(OUT, "player-run-left.png"))
    print(f"  -> player-run-left.png: (mirrored)")

    # --- Idle (use same slot height as run for consistency) ---
    print("Idle:")
    idle = make_aligned_single(IDLE_PATH)
    idle.save(os.path.join(OUT, "player-idle.png"))
    print(f"  -> player-idle.png: {idle.size}")

    # --- Climb strip (bottom-aligned) ---
    print("Climb frames:")
    climb_strip, climb_fw, climb_fh = make_aligned_strip(CLIMB_FRAMES)
    climb_strip.save(os.path.join(OUT, "player-climb-back.png"))
    print(f"  -> player-climb-back.png: {climb_strip.size}, frame={climb_fw}x{climb_fh}")

    climb_strip.save(os.path.join(OUT, "player-rope-hang.png"))
    print(f"  -> player-rope-hang.png: (same)")

    # --- Summary ---
    print(f"\n=== For SpriteSheet.ts (source dims, before /PLAYER_SPRITE_SOURCE_SCALE) ===")
    print(f"  run:   sourceFrameWidth={run_fw}, sourceFrameHeight={run_fh}, frameCount={len(RUN_FRAMES)}")
    print(f"  idle:  sourceFrameWidth={idle.width}, sourceFrameHeight={idle.height}, frameCount=1")
    print(f"  climb: sourceFrameWidth={climb_fw}, sourceFrameHeight={climb_fh}, frameCount={len(CLIMB_FRAMES)}")
    print(f"\n=== In-game (after /2) ===")
    print(f"  run:   {run_fw//2}x{run_fh//2}")
    print(f"  idle:  {idle.width//2}x{idle.height//2}")
    print(f"  climb: {climb_fw//2}x{climb_fh//2}")


if __name__ == "__main__":
    main()
