#!/usr/bin/env python3
"""
Build the CRAIG sprite pack into the live game strips.

Source of truth is the labeled art in /Users/murphhuxley/Downloads/CRAIG.
"""

from pathlib import Path
from PIL import Image, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/Users/murphhuxley/Downloads/CRAIG")
OUT = ROOT / "public" / "assets" / "sprites"

TARGET_H = 96
PICKUP_SIZE = 64
PAD_X = 4


def load_frames(path: Path) -> list[Image.Image]:
    img = Image.open(path)
    return [frame.convert("RGBA") for frame in ImageSequence.Iterator(img)]


def load_image(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


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
    return cropped.resize((target_w, target_h), Image.Resampling.NEAREST)


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


def build_single(image: Image.Image, target_h: int) -> Image.Image:
    bbox = crop_bbox([image])
    scaled = scale_frame(image, bbox, target_h)
    slot_w = scaled.width + PAD_X * 2
    out = Image.new("RGBA", (slot_w, target_h), (0, 0, 0, 0))
    out.paste(scaled, ((slot_w - scaled.width) // 2, target_h - scaled.height), scaled)
    return out


def build_pickup_from_idle(image: Image.Image, target_size: int) -> tuple[Image.Image, int]:
    bbox = crop_bbox([image])
    cropped = image.crop(bbox)
    helmet_bottom = max(1, round(cropped.height * 0.58))
    helmet = cropped.crop((0, 0, cropped.width, helmet_bottom))

    usable = target_size - 8
    scale = min(usable / helmet.width, usable / helmet.height)
    scaled = helmet.resize(
        (max(1, round(helmet.width * scale)), max(1, round(helmet.height * scale))),
        Image.Resampling.NEAREST,
    )

    strip = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    x = (target_size - scaled.width) // 2
    y = (target_size - scaled.height) // 2
    strip.paste(scaled, (x, y), scaled)
    return strip, target_size


def build_raw_strip(images: list[Image.Image]) -> tuple[Image.Image, int, int]:
    frame_w, frame_h = images[0].size
    strip = Image.new("RGBA", (frame_w * len(images), frame_h), (0, 0, 0, 0))
    for index, frame in enumerate(images):
        strip.paste(frame, (index * frame_w, 0), frame)
    return strip, frame_w, frame_h


def mirror_strip(strip: Image.Image, frame_width: int) -> Image.Image:
    frame_count = strip.width // frame_width
    mirrored = Image.new("RGBA", strip.size, (0, 0, 0, 0))
    for index in range(frame_count):
        frame = strip.crop((index * frame_width, 0, (index + 1) * frame_width, strip.height))
        mirrored_frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        mirrored.paste(mirrored_frame, (index * frame_width, 0), mirrored_frame)
    return mirrored


def save_strip(name: str, strip: Image.Image) -> None:
    strip.save(OUT / name)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    base_rotation_frames = load_frames(SRC / "pink_skin_character_teal_leather_jacket_khaki_BROW_rotations_8dir (1).gif")
    run_frames = load_frames(SRC / "CRAIG RUNNING.gif")
    dig_frames = load_frames(SRC / "CRAIG DIG ANIMATION.gif")
    hang_frames = load_frames(SRC / "CRAIG HANGING.gif")
    lfv_frames = load_frames(SRC / "LFV ANIMATION.gif")
    power_activation_frames = load_frames(SRC / "SHADOW FUNK ANIMATION.gif")
    power_idle_frame = load_image(SRC / "Shadow Funk Idle.png")
    power_run_frames = load_frames(SRC / "Shadow funk running.gif")
    power_hang_frames = load_frames(SRC / "Shadow funk hanging.gif")
    power_shoot_frames = load_frames(SRC / "pink_skin_character_teal_leather_jacket_khaki_BROW_custom-ShooSSHSHADOWFUNK SHOOT ANIMATION.gif")

    idle_frame = base_rotation_frames[0]

    run_strip, run_w = build_strip(run_frames, TARGET_H)
    dig_strip, dig_w = build_strip(dig_frames, TARGET_H)
    hang_strip, _ = build_strip(hang_frames, TARGET_H)
    idle_strip = build_single(idle_frame, TARGET_H)

    power_run_strip, power_run_w = build_strip(power_run_frames, TARGET_H)
    power_idle_strip = build_single(power_idle_frame, TARGET_H)
    power_hang_strip, _ = build_strip(power_hang_frames, TARGET_H)
    power_shoot_strip, power_shoot_w = build_strip(power_shoot_frames, TARGET_H)
    power_activation_strip, power_activation_w = build_strip(power_activation_frames, TARGET_H)
    power_pickup_strip, power_pickup_w = build_pickup_from_idle(power_idle_frame, PICKUP_SIZE)
    lfv_activation_strip, lfv_frame_w, lfv_frame_h = build_raw_strip(lfv_frames)

    save_strip("player-idle.png", idle_strip)
    save_strip("player-run-right.png", run_strip)
    save_strip("player-run-left.png", mirror_strip(run_strip, run_w))
    save_strip("player-dig-right.png", dig_strip)
    save_strip("player-dig-left.png", mirror_strip(dig_strip, dig_w))
    save_strip("player-climb-back.png", hang_strip)
    save_strip("player-rope-hang.png", hang_strip)

    save_strip("player-power-front.png", power_idle_strip)
    save_strip("player-power-run-right.png", power_run_strip)
    save_strip("player-power-run-left.png", mirror_strip(power_run_strip, power_run_w))
    save_strip("player-power-shoot-right.png", power_shoot_strip)
    save_strip("player-power-shoot-left.png", mirror_strip(power_shoot_strip, power_shoot_w))
    save_strip("player-power-climb.png", power_hang_strip)
    save_strip("player-power-rope.png", power_hang_strip)
    save_strip("player-power-activation.png", power_activation_strip)
    save_strip("power-helmet.png", power_pickup_strip)
    save_strip("lfv-activation.png", lfv_activation_strip)

    print("CRAIG pack exported from labeled CRAIG sources")
    print(f"idle source frame=rotation[0], strip={idle_strip.size}")
    print(f"run frame width={run_w}, height={TARGET_H}, frames={len(run_frames)}")
    print(f"dig frame width={dig_w}, height={TARGET_H}, frames={len(dig_frames)}")
    print(f"hang frame count={len(hang_frames)}")
    print(f"power idle strip={power_idle_strip.size}")
    print(f"power run frame width={power_run_w}, height={TARGET_H}, frames={len(power_run_frames)}")
    print(f"power shoot frame width={power_shoot_w}, height={TARGET_H}, frames={len(power_shoot_frames)}")
    print(f"power hang frames={len(power_hang_frames)}")
    print(f"power activation frame width={power_activation_w}, height={TARGET_H}, frames={len(power_activation_frames)}")
    print(f"power pickup frame width={power_pickup_w}, size={PICKUP_SIZE}, frames=1")
    print(f"lfv activation raw frame={lfv_frame_w}x{lfv_frame_h}, frames={len(lfv_frames)}")


if __name__ == "__main__":
    main()
