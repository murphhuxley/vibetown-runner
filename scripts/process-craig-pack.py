#!/usr/bin/env python3
"""
Build the current CRAIG sprite pack into game-ready strips.

This keeps the art aligned by baseline / hand position and lets us raise the
source resolution of the live sheets without changing gameplay logic.
"""

from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/Users/murphhuxley/Downloads/CRAIG")
DOWNLOADS = Path("/Users/murphhuxley/Downloads")
OUT = ROOT / "public" / "assets" / "sprites"

TARGET_H = 96
PICKUP_SIZE = 64
PAD_X = 4


def load_frames(path: Path) -> list[Image.Image]:
    img = Image.open(path)
    return [frame.convert("RGBA") for frame in ImageSequence.Iterator(img)]


def crop_bbox(images: list[Image.Image]) -> tuple[int, int, int, int]:
    boxes = [img.getbbox() for img in images]
    valid = [box for box in boxes if box is not None]
    if not valid:
        raise ValueError("No visible pixels found in source images")
    left = min(box[0] for box in valid)
    top = min(box[1] for box in valid)
    right = max(box[2] for box in valid)
    bottom = max(box[3] for box in valid)
    return left, top, right, bottom


def scale_frame(img: Image.Image, bbox: tuple[int, int, int, int], target_h: int) -> Image.Image:
    cropped = img.crop(bbox)
    w, h = cropped.size
    scale = target_h / h
    target_w = max(1, round(w * scale))
    return cropped.resize((target_w, target_h), Image.NEAREST)


def build_strip(images: list[Image.Image], target_h: int) -> tuple[Image.Image, int]:
    bbox = crop_bbox(images)
    scaled = [scale_frame(img, bbox, target_h) for img in images]
    slot_w = max(img.width for img in scaled) + PAD_X * 2
    strip = Image.new("RGBA", (slot_w * len(scaled), target_h), (0, 0, 0, 0))

    for index, frame in enumerate(scaled):
        x = index * slot_w + (slot_w - frame.width) // 2
        y = target_h - frame.height
        strip.paste(frame, (x, y), frame)

    return strip, slot_w


def build_square_strip(images: list[Image.Image], target_size: int, inner_pad: int = 4) -> tuple[Image.Image, int]:
    bbox = crop_bbox(images)
    usable = target_size - inner_pad * 2
    scaled: list[Image.Image] = []
    for img in images:
        cropped = img.crop(bbox)
        w, h = cropped.size
        scale = min(usable / w, usable / h)
        target_w = max(1, round(w * scale))
        target_h = max(1, round(h * scale))
        scaled.append(cropped.resize((target_w, target_h), Image.Resampling.LANCZOS))

    strip = Image.new("RGBA", (target_size * len(scaled), target_size), (0, 0, 0, 0))
    for index, frame in enumerate(scaled):
        x = index * target_size + (target_size - frame.width) // 2
        y = (target_size - frame.height) // 2
        strip.paste(frame, (x, y), frame)

    return strip, target_size


def build_single(image: Image.Image, target_h: int) -> Image.Image:
    bbox = crop_bbox([image])
    scaled = scale_frame(image, bbox, target_h)
    slot_w = scaled.width + PAD_X * 2
    out = Image.new("RGBA", (slot_w, target_h), (0, 0, 0, 0))
    out.paste(scaled, ((slot_w - scaled.width) // 2, target_h - scaled.height), scaled)
    return out


def extract_sheet_cell(image: Image.Image, col: int, row: int, cell_size: int = 124) -> Image.Image:
    left = col * cell_size
    top = row * cell_size
    return image.crop((left, top, left + cell_size, top + cell_size))


def mirror_strip(strip: Image.Image, frame_width: int) -> Image.Image:
    frame_count = strip.width // frame_width
    mirrored = Image.new("RGBA", strip.size, (0, 0, 0, 0))
    for index in range(frame_count):
        frame = strip.crop((index * frame_width, 0, (index + 1) * frame_width, strip.height))
        mirrored_frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
        mirrored.paste(mirrored_frame, (index * frame_width, 0), mirrored_frame)
    return mirrored


def save_strip(name: str, strip: Image.Image) -> None:
    strip.save(OUT / name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    run_frames = load_frames(SRC / "CRAIG RUNNING.gif")
    dig_frames = load_frames(SRC / "CRAIG DIG ANIMATION.gif")
    hang_frames = load_frames(SRC / "CRAIG HANGING.gif")
    power_sheet = Image.open(SRC / "CRAIG ROTATION-Sheet.png").convert("RGBA")
    power_run_frames = load_frames(SRC / "CRAIG RUNNING-exporPOWERUPt.gif")
    power_hang_frames = load_frames(SRC / "pink_skin_character_teal_leather_jacket_khaki_BROW_custCRAIGHANGINGPOWER.gif")
    power_pickup_frames = load_frames(DOWNLOADS / "HELMET2.gif")
    idle_frame = load_frames(SRC / "CRAIG ROTATION.gif")[0]
    power_idle_frame = extract_sheet_cell(power_sheet, 0, 0)

    run_strip, run_w = build_strip(run_frames, TARGET_H)
    dig_strip, dig_w = build_strip(dig_frames, TARGET_H)
    hang_strip, hang_w = build_strip(hang_frames, TARGET_H)
    power_run_strip, power_run_w = build_strip(power_run_frames, TARGET_H)
    power_hang_strip, power_hang_w = build_strip(power_hang_frames, TARGET_H)
    power_pickup_strip, _ = build_square_strip(power_pickup_frames, PICKUP_SIZE)
    idle_strip = build_single(idle_frame, TARGET_H)
    power_idle_strip = build_single(power_idle_frame, TARGET_H)

    save_strip("player-run-right.png", run_strip)
    save_strip("player-run-left.png", mirror_strip(run_strip, run_w))
    save_strip("player-dig-right.png", dig_strip)
    save_strip("player-dig-left.png", mirror_strip(dig_strip, dig_w))
    save_strip("player-climb-back.png", hang_strip)
    save_strip("player-rope-hang.png", hang_strip)
    save_strip("player-power-run-right.png", power_run_strip)
    save_strip("player-power-run-left.png", mirror_strip(power_run_strip, power_run_w))
    save_strip("player-idle.png", idle_strip)
    save_strip("player-power-front.png", power_idle_strip)
    save_strip("player-power-climb.png", power_hang_strip)
    save_strip("player-power-rope.png", power_hang_strip)
    save_strip("power-helmet.png", power_pickup_strip)

    print("CRAIG pack exported")
    print(f"run frame width={run_w}, height={TARGET_H}, frames={len(run_frames)}")
    print(f"dig frame width={dig_w}, height={TARGET_H}, frames={len(dig_frames)}")
    print(f"hang frame width={hang_w}, height={TARGET_H}, frames={len(hang_frames)}")
    print(f"power run frame width={power_run_w}, height={TARGET_H}, frames={len(power_run_frames)}")
    print(f"power hang frame width={power_hang_w}, height={TARGET_H}, frames={len(power_hang_frames)}")
    print(f"idle width={idle_strip.width}, height={idle_strip.height}")
    print(f"power idle width={power_idle_strip.width}, height={power_idle_strip.height}")
    print(f"power pickup frame size={PICKUP_SIZE}, frames={len(power_pickup_frames)}")


if __name__ == "__main__":
    main()
