#!/usr/bin/env python3
"""
Process ALPHA SPRITE individual frames into game-ready sprite strips.

1. Auto-crop each frame to character bounding box
2. Threshold alpha (remove anti-aliasing — fully opaque or fully transparent)
3. Scale to target height (44px)
4. Combine run frames into horizontal sprite strip
5. Create mirrored (left-facing) version
6. Process idle and hanging frames
"""

from PIL import Image
import os
import sys

SRC_DIR = os.path.expanduser("~/Downloads/ALPHA SPRITE")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "assets", "sprites")
TARGET_HEIGHT = 44
ALPHA_THRESHOLD = 128  # Pixels below this become fully transparent, above become fully opaque


def threshold_alpha(img: Image.Image) -> Image.Image:
    """Convert all semi-transparent pixels to either fully opaque or fully transparent."""
    img = img.convert("RGBA")
    data = img.getdata()
    new_data = []
    for r, g, b, a in data:
        if a < ALPHA_THRESHOLD:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, 255))
    img.putdata(new_data)
    return img


def auto_crop(img: Image.Image) -> tuple:
    """Return the bounding box (left, top, right, bottom) of non-transparent pixels."""
    bbox = img.getbbox()
    return bbox


def find_union_bbox(images: list[Image.Image]) -> tuple:
    """Find the union bounding box across all images for consistent framing."""
    min_l, min_t = 99999, 99999
    max_r, max_b = 0, 0
    for img in images:
        bbox = auto_crop(img)
        if bbox:
            l, t, r, b = bbox
            min_l = min(min_l, l)
            min_t = min(min_t, t)
            max_r = max(max_r, r)
            max_b = max(max_b, b)
    return (min_l, min_t, max_r, max_b)


def process_frame(img: Image.Image, bbox: tuple, target_h: int) -> Image.Image:
    """Crop to bbox, threshold alpha, scale to target height."""
    cropped = img.crop(bbox)
    cropped = threshold_alpha(cropped)

    # Scale to target height, preserving aspect ratio
    w, h = cropped.size
    scale = target_h / h
    target_w = max(1, round(w * scale))

    # Use NEAREST for clean pixel art scaling
    scaled = cropped.resize((target_w, target_h), Image.NEAREST)
    return scaled


def make_strip(frames: list[Image.Image]) -> Image.Image:
    """Combine frames into a horizontal sprite strip."""
    # Use the max width across frames for uniform frame width
    max_w = max(f.width for f in frames)
    h = frames[0].height

    strip = Image.new("RGBA", (max_w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        # Center each frame within its slot
        offset_x = (max_w - frame.width) // 2
        strip.paste(frame, (i * max_w + offset_x, 0))

    return strip, max_w


def mirror_strip(strip: Image.Image, frame_width: int) -> Image.Image:
    """Mirror each frame in the strip individually (not the whole strip)."""
    frame_count = strip.width // frame_width
    mirrored = Image.new("RGBA", strip.size, (0, 0, 0, 0))

    for i in range(frame_count):
        frame = strip.crop((i * frame_width, 0, (i + 1) * frame_width, strip.height))
        frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
        mirrored.paste(frame, (i * frame_width, 0))

    return mirrored


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Load all frames
    run_names = [f"Run_{i}.png" for i in range(1, 6)]
    run_images = []
    for name in run_names:
        path = os.path.join(SRC_DIR, name)
        if not os.path.exists(path):
            print(f"Missing: {path}")
            sys.exit(1)
        run_images.append(Image.open(path).convert("RGBA"))

    idle_img = Image.open(os.path.join(SRC_DIR, "Idle.png")).convert("RGBA")
    hang1_img = Image.open(os.path.join(SRC_DIR, "Hanging_1.png")).convert("RGBA")
    hang2_img = Image.open(os.path.join(SRC_DIR, "Hangin_2.png")).convert("RGBA")

    # Find union bounding box across ALL frames for consistent sizing
    all_images = run_images + [idle_img, hang1_img, hang2_img]
    union_bbox = find_union_bbox(all_images)
    print(f"Union bounding box: {union_bbox}")

    char_w = union_bbox[2] - union_bbox[0]
    char_h = union_bbox[3] - union_bbox[1]
    print(f"Character size in source: {char_w}x{char_h}")

    # Process run frames
    run_frames = [process_frame(img, union_bbox, TARGET_HEIGHT) for img in run_images]
    run_strip, frame_w = make_strip(run_frames)
    print(f"Run strip: {run_strip.size}, frame width: {frame_w}, {len(run_frames)} frames")

    # Save run-right (source sprites face right)
    run_strip.save(os.path.join(OUT_DIR, "player-run-right.png"))
    print(f"Saved player-run-right.png")

    # Mirror for run-left
    run_left = mirror_strip(run_strip, frame_w)
    run_left.save(os.path.join(OUT_DIR, "player-run-left.png"))
    print(f"Saved player-run-left.png")

    # Process idle
    idle_frame = process_frame(idle_img, union_bbox, TARGET_HEIGHT)
    idle_frame.save(os.path.join(OUT_DIR, "player-idle.png"))
    print(f"Saved player-idle.png ({idle_frame.size})")

    # Process climbing (hanging frames → 2-frame climb strip)
    climb_frames = [
        process_frame(hang1_img, union_bbox, TARGET_HEIGHT),
        process_frame(hang2_img, union_bbox, TARGET_HEIGHT),
    ]
    climb_strip, climb_fw = make_strip(climb_frames)
    climb_strip.save(os.path.join(OUT_DIR, "player-climb.png"))
    print(f"Saved player-climb.png ({climb_strip.size}, frame width: {climb_fw})")

    # Also save hanging as rope sprite (same frames work for rope hanging)
    climb_strip.save(os.path.join(OUT_DIR, "player-rope.png"))
    print(f"Saved player-rope.png")

    print("\nDone! Frame dimensions for SpriteSheet.ts:")
    print(f"  runRight/runLeft: frameWidth={frame_w}, frameHeight={TARGET_HEIGHT}, frameCount=5")
    print(f"  idle: frameWidth={idle_frame.width}, frameHeight={TARGET_HEIGHT}, frameCount=1")
    print(f"  climb/rope: frameWidth={climb_fw}, frameHeight={TARGET_HEIGHT}, frameCount=2")


if __name__ == "__main__":
    main()
