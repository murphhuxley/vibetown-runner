#!/usr/bin/env python3
"""
Slice 3x3 sprite grid PNGs into individual frames,
remove dithered mint-green background via edge-connected chroma key,
crop to content, scale to game size, and assemble into
horizontal strip spritesheets.
"""

from collections import deque
from PIL import Image
import os
import numpy as np

PROJ = "/Users/murphhuxley/.openclaw/workspace/projects/vibetown-runner"
OUT = os.path.join(PROJ, "public/assets/sprites")
os.makedirs(OUT, exist_ok=True)
MANUAL_SOURCE_DIR = os.path.join(OUT, "source")
LEGACY_SOURCE_DIR = os.path.join(MANUAL_SOURCE_DIR, "legacy-good")

SHEET_RUN = "/Users/murphhuxley/Downloads/Gemini_Generated_Image_84gxj684gxj684gx.png"
SHEET_IDLE = "/Users/murphhuxley/Downloads/Gemini_Generated_Image_cso527cso527cso5.png"
SHEET_ROPE = "/Users/murphhuxley/Downloads/Gemini_Generated_Image_mqtjigmqtjigmqtj.png"
MANUAL_FRONT_IDLE = os.path.join(MANUAL_SOURCE_DIR, "player-front-idle.png")
MANUAL_SIDE_IDLE = os.path.join(MANUAL_SOURCE_DIR, "player-side-idle.png")
MANUAL_RUN_RIGHT = [
    os.path.join(MANUAL_SOURCE_DIR, "player-run-right-0.png"),
    os.path.join(MANUAL_SOURCE_DIR, "player-run-right-1.png"),
    os.path.join(MANUAL_SOURCE_DIR, "player-run-right-2.png"),
]
MANUAL_BACK_HANG = [
    os.path.join(MANUAL_SOURCE_DIR, "player-back-hang-0.png"),
    os.path.join(MANUAL_SOURCE_DIR, "player-back-hang-1.png"),
]
MANUAL_SOURCE_FILES = [
    MANUAL_FRONT_IDLE,
    MANUAL_SIDE_IDLE,
    *MANUAL_RUN_RIGHT,
    *MANUAL_BACK_HANG,
]
LEGACY_IDLE = os.path.join(LEGACY_SOURCE_DIR, "idle.png")
LEGACY_RUN = [
    os.path.join(LEGACY_SOURCE_DIR, "run-0.png"),
    os.path.join(LEGACY_SOURCE_DIR, "run-1.png"),
    os.path.join(LEGACY_SOURCE_DIR, "run-2.png"),
]
LEGACY_BACK = [
    os.path.join(LEGACY_SOURCE_DIR, "back-0.png"),
    os.path.join(LEGACY_SOURCE_DIR, "back-1.png"),
]
LEGACY_SOURCE_FILES = [
    LEGACY_IDLE,
    *LEGACY_RUN,
    *LEGACY_BACK,
]
USE_LEGACY_SOURCES = all(os.path.exists(path) for path in LEGACY_SOURCE_FILES)
USE_MANUAL_SOURCES = all(os.path.exists(path) for path in MANUAL_SOURCE_FILES)
FORCE_SHEET_BUILD = True

# Fresh sheet selections based on the marked poses the user approved:
# - Run uses the clean side-profile cycle (2, 3, 4) from the run sheet.
# - Rope uses the marked back-facing hang poses (1, 2) from the hanging sheet.
# - Idle uses the marked front-facing stand pose (1) from the idle sheet.
RUN_SEQUENCE = [(1, 0), (1, 1), (1, 2)]
FRONT_IDLE_SEQUENCE = [(0, 1)]
ROPE_SEQUENCE = [(1, 0), (1, 2)]
CLIMB_SEQUENCE = [(1, 1), (1, 0)]

SOURCE_SCALE = 2
LOGICAL_TARGET_H = 44
LOGICAL_TILE = 32

# Export sprites at 2x source resolution, then draw them at logical size in-game.
TARGET_H = LOGICAL_TARGET_H * SOURCE_SCALE
TILE = LOGICAL_TILE * SOURCE_SCALE
PALETTE_STEP = 12
BACKGROUND_DISTANCE = 22
HALO_DISTANCE = 26
MIN_OPAQUE_COMPONENT = 64
MAX_INTERIOR_HOLE = 160


def slice_grid(img, rows=3, cols=3):
    w, h = img.size
    cell_w = w // cols
    cell_h = h // rows
    cells = []
    for r in range(rows):
        row = []
        for c in range(cols):
            box = (c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)
            row.append(img.crop(box))
        cells.append(row)
    return cells


def rgb_to_hsv(data):
    """Convert RGB numpy array (H,W,3) uint8 to HSV float arrays."""
    r, g, b = data[:,:,0].astype(float)/255, data[:,:,1].astype(float)/255, data[:,:,2].astype(float)/255
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    diff = maxc - minc

    # Hue
    h = np.zeros_like(maxc)
    mask_r = (maxc == r) & (diff > 0)
    mask_g = (maxc == g) & (diff > 0)
    mask_b = (maxc == b) & (diff > 0)
    h[mask_r] = (60 * ((g[mask_r] - b[mask_r]) / diff[mask_r]) + 360) % 360
    h[mask_g] = (60 * ((b[mask_g] - r[mask_g]) / diff[mask_g]) + 120)
    h[mask_b] = (60 * ((r[mask_b] - g[mask_b]) / diff[mask_b]) + 240)

    # Saturation
    s = np.zeros_like(maxc)
    nonzero = maxc > 0
    s[nonzero] = diff[nonzero] / maxc[nonzero]

    # Value
    v = maxc
    return h, s, v


def quantize_palette(rgb, step=PALETTE_STEP):
    quantized = (rgb // step) * step
    unique = np.unique(quantized.reshape(-1, 3), axis=0)
    return unique.astype(np.int16)


def label_components(mask, connectivity=4):
    height, width = mask.shape
    labels = np.full((height, width), -1, dtype=np.int32)
    sizes = []
    label = 0
    neighbors = ((1, 0), (-1, 0), (0, 1), (0, -1))
    if connectivity == 8:
        neighbors = neighbors + ((1, 1), (1, -1), (-1, 1), (-1, -1))

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or labels[y, x] != -1:
                continue

            queue = deque([(x, y)])
            labels[y, x] = label
            size = 0

            while queue:
                cx, cy = queue.popleft()
                size += 1
                for dx, dy in neighbors:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and labels[ny, nx] == -1:
                        labels[ny, nx] = label
                        queue.append((nx, ny))

            sizes.append(size)
            label += 1

    return labels, sizes


def find_border_connected(mask):
    height, width = mask.shape
    connected = np.zeros_like(mask, dtype=bool)
    queue = deque()

    for x in range(width):
        if mask[0, x]:
            connected[0, x] = True
            queue.append((x, 0))
        if mask[height - 1, x] and not connected[height - 1, x]:
            connected[height - 1, x] = True
            queue.append((x, height - 1))

    for y in range(height):
        if mask[y, 0] and not connected[y, 0]:
            connected[y, 0] = True
            queue.append((0, y))
        if mask[y, width - 1] and not connected[y, width - 1]:
            connected[y, width - 1] = True
            queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not connected[ny, nx]:
                connected[ny, nx] = True
                queue.append((nx, ny))

    return connected


def remove_small_opaque_components(data, min_size=MIN_OPAQUE_COMPONENT, connectivity=4):
    opaque = data[:,:,3] > 0
    labels, sizes = label_components(opaque, connectivity=connectivity)
    for label, size in enumerate(sizes):
        if size < min_size:
            data[labels == label] = [0, 0, 0, 0]


def remove_background(img):
    """Remove the mint grid background while preserving interior sprite colors."""
    img = img.convert("RGBA")
    data = np.array(img)
    rgb = data[:,:,:3]
    h, s, v = rgb_to_hsv(rgb)

    # Build a background palette from the edge band of the cell. The sprite stays
    # centered, so edge colors are the safest source for the mint backdrop and grid.
    band = max(4, min(img.size) // 30)
    seeds = np.concatenate([
        rgb[:band, :, :].reshape(-1, 3),
        rgb[-band:, :, :].reshape(-1, 3),
        rgb[:, :band, :].reshape(-1, 3),
        rgb[:, -band:, :].reshape(-1, 3),
    ], axis=0)
    palette = quantize_palette(seeds)

    diffs = rgb.astype(np.int16)[:,:,None,:] - palette[None,None,:,:]
    nearest_palette = np.min(np.sum(diffs * diffs, axis=3), axis=2)

    likely_bg = (nearest_palette <= BACKGROUND_DISTANCE * BACKGROUND_DISTANCE) & (s <= 0.42)
    likely_bg |= ((h >= 80) & (h <= 180) & (s <= 0.20) & (v >= 0.55))
    likely_bg |= ((h >= 70) & (h <= 180) & (v <= 0.50))
    bg_mask = find_border_connected(likely_bg)
    data[bg_mask] = [0, 0, 0, 0]
    remove_small_opaque_components(data)

    return Image.fromarray(data), palette


def remove_isolated_background(img):
    """Remove the mint backdrop from a single exported frame using its corners as palette seeds."""
    img = img.convert("RGBA")
    data = np.array(img)
    rgb = data[:,:,:3]
    h, s, v = rgb_to_hsv(rgb)

    corner = max(8, min(img.size) // 6)
    seeds = np.concatenate([
        rgb[:corner, :corner].reshape(-1, 3),
        rgb[:corner, -corner:].reshape(-1, 3),
        rgb[-corner:, :corner].reshape(-1, 3),
        rgb[-corner:, -corner:].reshape(-1, 3),
    ], axis=0)
    palette = quantize_palette(seeds)

    diffs = rgb.astype(np.int16)[:,:,None,:] - palette[None,None,:,:]
    nearest_palette = np.min(np.sum(diffs * diffs, axis=3), axis=2)

    mint = (nearest_palette <= (BACKGROUND_DISTANCE - 4) * (BACKGROUND_DISTANCE - 4))
    mint &= (h >= 70) & (h <= 180) & (s <= 0.60)

    light_dither = nearest_palette <= (BACKGROUND_DISTANCE + 2) * (BACKGROUND_DISTANCE + 2)
    light_dither &= (s <= 0.20) & (v >= 0.70)

    bg_mask = find_border_connected(mint | light_dither)
    data[bg_mask] = [0, 0, 0, 0]
    remove_small_opaque_components(data)

    return Image.fromarray(data), palette


def crop_to_content(img, padding=4):
    bbox = img.getbbox()
    if bbox is None:
        return img
    x1, y1, x2, y2 = bbox
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(img.width, x2 + padding)
    y2 = min(img.height, y2 + padding)
    return img.crop((x1, y1, x2, y2))


def union_bbox(images, padding=4):
    boxes = [img.getbbox() for img in images if img.getbbox() is not None]
    if not boxes:
        width, height = images[0].size
        return (0, 0, width, height)

    x1 = max(0, min(box[0] for box in boxes) - padding)
    y1 = max(0, min(box[1] for box in boxes) - padding)
    x2 = min(images[0].width, max(box[2] for box in boxes) + padding)
    y2 = min(images[0].height, max(box[3] for box in boxes) + padding)
    return (x1, y1, x2, y2)


def scale_to_height(img, target_h):
    if img.height == 0:
        return img
    ratio = target_h / img.height
    new_w = max(1, int(round(img.width * ratio)))
    # Preserve crisp sprite pixels rather than blending them into the background.
    return img.resize((new_w, target_h), Image.NEAREST)


def center_on_canvas(img, canvas_w, canvas_h):
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    x = (canvas_w - img.width) // 2
    y = canvas_h - img.height  # align bottom (feet on ground)
    canvas.paste(img, (x, y), img)
    return canvas


def make_strip(frames, frame_w, frame_h):
    strip = Image.new("RGBA", (frame_w * len(frames), frame_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * frame_w, 0), f)
    return strip


def trim_background_halo(img, palette, threshold=HALO_DISTANCE):
    data = np.array(img.convert("RGBA"))
    alpha = data[:,:,3] > 0
    if not np.any(alpha):
        return Image.fromarray(data)

    rgb = data[:,:,:3]
    diffs = rgb.astype(np.int16)[:,:,None,:] - palette[None,None,:,:]
    nearest_palette = np.min(np.sum(diffs * diffs, axis=3), axis=2)

    padded = np.pad(alpha.astype(np.uint8), 1, mode="constant", constant_values=0)
    neighbor_opaque = sum(
        padded[dy:dy+alpha.shape[0], dx:dx+alpha.shape[1]]
        for dy in range(3) for dx in range(3)
    )
    edge_pixels = alpha & (neighbor_opaque < 9)
    halo = edge_pixels & (nearest_palette <= threshold * threshold)
    data[halo] = [0, 0, 0, 0]
    return Image.fromarray(data)


def restore_interior_holes(clean_img, source_img, max_size=MAX_INTERIOR_HOLE):
    """Restore small enclosed cutouts that were accidentally keyed out of the sprite."""
    clean_data = np.array(clean_img.convert("RGBA"))
    source_data = np.array(source_img.convert("RGBA"))
    transparent = clean_data[:,:,3] == 0
    labels, sizes = label_components(transparent)
    if not sizes:
        return clean_img

    border_labels = {
        label for label in np.concatenate((
            labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]
        ))
        if label >= 0
    }

    for label, size in enumerate(sizes):
        if label in border_labels or size > max_size:
            continue
        mask = labels == label
        clean_data[mask] = source_data[mask]

    return Image.fromarray(clean_data)


def solidify_alpha(img):
    """Clamp any remaining nonzero alpha to fully opaque for crisp pixel-art silhouettes."""
    data = np.array(img.convert("RGBA"))
    alpha = data[:,:,3]
    data[alpha > 0, 3] = 255
    return Image.fromarray(data)


def process_frame(cell, target_h=TARGET_H):
    clean, palette = remove_background(cell)
    cropped = crop_to_content(clean)
    scaled = scale_to_height(cropped, target_h)
    canvas_w = max(TILE, scaled.width)
    # Keep source frames aligned to the export scale so logical draw sizes stay whole pixels.
    frame_multiple = SOURCE_SCALE * 2
    if canvas_w % frame_multiple != 0:
        canvas_w += frame_multiple - (canvas_w % frame_multiple)
    framed = center_on_canvas(scaled, canvas_w, target_h)
    return trim_background_halo(framed, palette)


def process_isolated_frame(path, target_h=TARGET_H):
    source = Image.open(path).convert("RGBA")
    # The manual exports already include transparent whitespace, so crop to the
    # visible mint card first and then strip the backdrop from that smaller image.
    source = crop_to_content(source, padding=0)
    clean, palette = remove_isolated_background(source)
    cropped = crop_to_content(clean)
    source_cropped = crop_to_content(source)
    scaled = scale_to_height(cropped, target_h)
    scaled_source = scale_to_height(source_cropped, target_h)
    canvas_w = max(TILE, scaled.width)
    frame_multiple = SOURCE_SCALE * 2
    if canvas_w % frame_multiple != 0:
        canvas_w += frame_multiple - (canvas_w % frame_multiple)
    framed = center_on_canvas(scaled, canvas_w, target_h)
    framed_source = center_on_canvas(scaled_source, canvas_w, target_h)
    cleaned = trim_background_halo(framed, palette)
    restored = restore_interior_holes(cleaned, framed_source)
    return solidify_alpha(restored)


def process_precut_frame(path):
    """Use an already-cut sprite frame directly, only upscaling to source resolution."""
    source = solidify_alpha(Image.open(path).convert("RGBA"))
    if source.height != TARGET_H:
        upscale = TARGET_H / source.height
        source = source.resize(
            (max(1, int(round(source.width * upscale))), TARGET_H),
            Image.NEAREST,
        )
    canvas_w = max(TILE, source.width)
    frame_multiple = SOURCE_SCALE * 2
    if canvas_w % frame_multiple != 0:
        canvas_w += frame_multiple - (canvas_w % frame_multiple)
    return center_on_canvas(source, canvas_w, TARGET_H)


def dilate_mask(mask, radius=1):
    dilated = mask.copy()
    for _ in range(radius):
        padded = np.pad(dilated.astype(np.uint8), 1, mode="constant", constant_values=0)
        neighbors = sum(
            padded[dy:dy+mask.shape[0], dx:dx+mask.shape[1]]
            for dy in range(3) for dx in range(3)
        )
        dilated = neighbors > 0
    return dilated


def keep_primary_component(img, radius=1):
    data = np.array(img.convert("RGBA"))
    opaque = data[:,:,3] > 0
    labels, sizes = label_components(opaque, connectivity=8)
    if not sizes:
        return Image.fromarray(data)

    primary_label = int(np.argmax(sizes))
    primary_mask = labels == primary_label
    keep_mask = dilate_mask(primary_mask, radius=radius) & opaque
    data[~keep_mask] = [0, 0, 0, 0]
    return Image.fromarray(data)


def neighbor_counts(mask):
    padded = np.pad(mask.astype(np.uint8), 1, mode="constant", constant_values=0)
    counts = sum(
        padded[dy:dy+mask.shape[0], dx:dx+mask.shape[1]]
        for dy in range(3) for dx in range(3)
    )
    return counts - mask.astype(np.uint8)


def fill_tiny_gaps(img):
    data = np.array(img.convert("RGBA"))
    opaque = data[:,:,3] > 0
    counts = neighbor_counts(opaque)
    fill_mask = (~opaque) & (counts >= 5)

    height, width = opaque.shape
    result = data.copy()
    for y in range(height):
        for x in range(width):
            if not fill_mask[y, x]:
                continue
            samples = []
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    if opaque[ny, nx]:
                        samples.append(data[ny, nx, :3])
            if samples:
                rgb = np.mean(samples, axis=0).astype(np.uint8)
                result[y, x] = [rgb[0], rgb[1], rgb[2], 255]

    return Image.fromarray(result)


def remove_lonely_pixels(img):
    data = np.array(img.convert("RGBA"))
    opaque = data[:,:,3] > 0
    counts = neighbor_counts(opaque)
    data[opaque & (counts <= 1)] = [0, 0, 0, 0]
    return Image.fromarray(data)


def process_cell_group(cells, coords, target_h=TARGET_H):
    tight_frames = []

    for row, col in coords:
        clean, _palette = remove_background(cells[row][col])
        clean = solidify_alpha(clean)
        tight_frames.append(crop_to_content(clean, padding=0))

    max_source_h = max(frame.height for frame in tight_frames)
    scale = target_h / max_source_h if max_source_h else 1

    scaled_frames = []
    for frame in tight_frames:
        scaled_w = max(1, int(round(frame.width * scale)))
        scaled_h = max(1, int(round(frame.height * scale)))
        scaled_frames.append(frame.resize((scaled_w, scaled_h), Image.NEAREST))

    canvas_w = max(TILE, max(frame.width for frame in scaled_frames))
    frame_multiple = SOURCE_SCALE * 2
    if canvas_w % frame_multiple != 0:
        canvas_w += frame_multiple - (canvas_w % frame_multiple)

    frames = []
    for scaled in scaled_frames:
        framed = center_on_canvas(scaled, canvas_w, target_h)
        cleaned = keep_primary_component(framed)
        cleaned = fill_tiny_gaps(cleaned)
        cleaned = remove_lonely_pixels(cleaned)
        frames.append(solidify_alpha(cleaned))

    return frames


def normalize_widths(frames):
    max_w = max(f.width for f in frames)
    return [center_on_canvas(f, max_w, f.height) for f in frames]


# --- Main ---

if USE_LEGACY_SOURCES and not FORCE_SHEET_BUILD:
    print("Loading legacy source frames...")

    run_side_frames = normalize_widths([process_precut_frame(path) for path in LEGACY_RUN])
    frame_w = run_side_frames[0].width
    print(f"  Run side: {len(run_side_frames)} frames @ {frame_w}x{TARGET_H}")

    front_idle = process_precut_frame(LEGACY_IDLE)
    front_idle_frames = [front_idle]
    idle_w = front_idle.width
    print(f"  Front idle: {len(front_idle_frames)} frame @ {idle_w}x{TARGET_H}")

    side_idle = run_side_frames[1]
    side_idle_frames = [side_idle, side_idle, side_idle]
    side_idle_w = side_idle.width
    print(f"  Side idle: {len(side_idle_frames)} frames @ {side_idle_w}x{TARGET_H}")

    back_frames = normalize_widths([process_precut_frame(path) for path in LEGACY_BACK])
    back_climb_frames = back_frames
    rope_hang_frames = back_frames
    back_w = back_climb_frames[0].width
    rope_w = rope_hang_frames[0].width
    print(f"  Back climb: {len(back_climb_frames)} frames @ {back_w}x{TARGET_H}")
    print(f"  Rope hang: {len(rope_hang_frames)} frames @ {rope_w}x{TARGET_H}")

    front_walk_frames = [front_idle, front_idle, front_idle]
    front_w = front_idle.width
    print(f"  Front walk: {len(front_walk_frames)} frames @ {front_w}x{TARGET_H}")
elif USE_MANUAL_SOURCES and not FORCE_SHEET_BUILD:
    print("Loading manual source frames...")

    run_side_frames = normalize_widths([process_isolated_frame(path) for path in MANUAL_RUN_RIGHT])
    frame_w = run_side_frames[0].width
    print(f"  Run side: {len(run_side_frames)} frames @ {frame_w}x{TARGET_H}")

    front_idle = process_isolated_frame(MANUAL_FRONT_IDLE)
    front_idle_frames = [front_idle]
    idle_w = front_idle.width
    print(f"  Front idle: {len(front_idle_frames)} frame @ {idle_w}x{TARGET_H}")

    side_idle = process_isolated_frame(MANUAL_SIDE_IDLE)
    side_idle_frames = [side_idle, side_idle, side_idle]
    side_idle_w = side_idle.width
    print(f"  Side idle: {len(side_idle_frames)} frames @ {side_idle_w}x{TARGET_H}")

    back_frames = normalize_widths([process_isolated_frame(path) for path in MANUAL_BACK_HANG])
    back_climb_frames = back_frames
    rope_hang_frames = back_frames
    back_w = back_climb_frames[0].width
    rope_w = rope_hang_frames[0].width
    print(f"  Back climb: {len(back_climb_frames)} frames @ {back_w}x{TARGET_H}")
    print(f"  Rope hang: {len(rope_hang_frames)} frames @ {rope_w}x{TARGET_H}")

    # Front walk is not currently used in-game, so mirror the idle file count for metadata.
    front_walk_frames = [front_idle, front_idle, front_idle]
    front_w = front_idle.width
    print(f"  Front walk: {len(front_walk_frames)} frames @ {front_w}x{TARGET_H}")
else:
    print("Loading sheets...")
    run_sheet = Image.open(SHEET_RUN)
    idle_sheet = Image.open(SHEET_IDLE)
    rope_sheet = Image.open(SHEET_ROPE)
    print(f"Run sheet: {run_sheet.size}, Idle sheet: {idle_sheet.size}, Rope sheet: {rope_sheet.size}")

    run_cells = slice_grid(run_sheet)
    idle_cells = slice_grid(idle_sheet)
    rope_cells = slice_grid(rope_sheet)

    print("Processing fresh sheet selections...")

    # Marked run poses 2, 3, 4: side profile only, no turnaround frames.
    run_side_frames = process_cell_group(run_cells, RUN_SEQUENCE)
    frame_w = run_side_frames[0].width
    print(f"  Run side: {len(run_side_frames)} frames @ {frame_w}x{TARGET_H}")

    # Front walk is not used in-game; keep metadata stable with front-idle duplicates.
    front_walk_frames = [run_side_frames[1], run_side_frames[1], run_side_frames[1]]
    front_w = front_walk_frames[0].width
    print(f"  Front walk: {len(front_walk_frames)} frames @ {front_w}x{TARGET_H}")

    # Marked idle pose 1: front-facing stand.
    front_idle_frames = process_cell_group(idle_cells, FRONT_IDLE_SEQUENCE)
    idle_w = front_idle_frames[0].width
    print(f"  Front idle: {len(front_idle_frames)} frames @ {idle_w}x{TARGET_H}")

    side_idle_frames = [run_side_frames[1], run_side_frames[1], run_side_frames[1]]
    side_idle_w = side_idle_frames[0].width
    print(f"  Side idle: {len(side_idle_frames)} frames @ {side_idle_w}x{TARGET_H}")

    # Ladder stays back-facing, using the dedicated behind-the-bar sheet.
    back_climb_frames = process_cell_group(rope_cells, CLIMB_SEQUENCE)
    back_w = back_climb_frames[0].width
    print(f"  Back climb: {len(back_climb_frames)} frames @ {back_w}x{TARGET_H}")

    # Marked rope poses 1 and 2 from the hanging sheet.
    rope_hang_frames = process_cell_group(rope_cells, ROPE_SEQUENCE)
    rope_w = rope_hang_frames[0].width
    print(f"  Rope hang: {len(rope_hang_frames)} frames @ {rope_w}x{TARGET_H}")

# --- Save debug frames ---
debug_dir = os.path.join(OUT, "debug")
os.makedirs(debug_dir, exist_ok=True)
for i, f in enumerate(run_side_frames):
    f.save(os.path.join(debug_dir, f"run-side-{i}.png"))
for i, f in enumerate(front_idle_frames):
    f.save(os.path.join(debug_dir, f"idle-front-{i}.png"))
for i, f in enumerate(side_idle_frames):
    f.save(os.path.join(debug_dir, f"idle-side-{i}.png"))
for i, f in enumerate(back_climb_frames):
    f.save(os.path.join(debug_dir, f"back-climb-{i}.png"))
for i, f in enumerate(rope_hang_frames):
    f.save(os.path.join(debug_dir, f"rope-hang-{i}.png"))

# --- Build spritesheets ---
print("Building spritesheets...")

run_right_strip = make_strip(run_side_frames, frame_w, TARGET_H)
run_right_strip.save(os.path.join(OUT, "player-run-right.png"))
print(f"  player-run-right.png: {run_right_strip.size}")

run_left_frames = [frame.transpose(Image.FLIP_LEFT_RIGHT) for frame in run_side_frames]
run_left_strip = make_strip(run_left_frames, frame_w, TARGET_H)
run_left_strip.save(os.path.join(OUT, "player-run-left.png"))
print(f"  player-run-left.png: {run_left_strip.size}")

front_idle_frames[0].save(os.path.join(OUT, "player-idle.png"))
print(f"  player-idle.png: {front_idle_frames[0].size}")

idle_side_strip = make_strip(side_idle_frames, side_idle_w, TARGET_H)
idle_side_strip.save(os.path.join(OUT, "player-idle-side.png"))
print(f"  player-idle-side.png: {idle_side_strip.size}")

back_climb_strip = make_strip(back_climb_frames, back_w, TARGET_H)
back_climb_strip.save(os.path.join(OUT, "player-climb-back.png"))
print(f"  player-climb-back.png: {back_climb_strip.size}")

rope_hang_strip = make_strip(rope_hang_frames, rope_w, TARGET_H)
rope_hang_strip.save(os.path.join(OUT, "player-rope-hang.png"))
print(f"  player-rope-hang.png: {rope_hang_strip.size}")

front_walk_strip = make_strip(front_walk_frames, front_w, TARGET_H)
front_walk_strip.save(os.path.join(OUT, "player-walk-front.png"))
print(f"  player-walk-front.png: {front_walk_strip.size}")

# --- Metadata ---
import json
meta = {
    "player-run-right": { "file": "player-run-right.png", "frameWidth": frame_w, "frameHeight": TARGET_H, "frameCount": len(run_side_frames) },
    "player-run-left": { "file": "player-run-left.png", "frameWidth": frame_w, "frameHeight": TARGET_H, "frameCount": len(run_side_frames) },
    "player-idle": { "file": "player-idle.png", "frameWidth": idle_w, "frameHeight": TARGET_H, "frameCount": 1 },
    "player-idle-side": { "file": "player-idle-side.png", "frameWidth": side_idle_w, "frameHeight": TARGET_H, "frameCount": len(side_idle_frames) },
    "player-climb-back": { "file": "player-climb-back.png", "frameWidth": back_w, "frameHeight": TARGET_H, "frameCount": len(back_climb_frames) },
    "player-rope-hang": { "file": "player-rope-hang.png", "frameWidth": rope_w, "frameHeight": TARGET_H, "frameCount": len(rope_hang_frames) },
    "player-walk-front": { "file": "player-walk-front.png", "frameWidth": front_w, "frameHeight": TARGET_H, "frameCount": len(front_walk_frames) },
}
with open(os.path.join(OUT, "sprites.json"), "w") as f:
    json.dump(meta, f, indent=2)

print(f"\nDone! Sprites at {OUT}")
