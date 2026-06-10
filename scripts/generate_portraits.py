#!/usr/bin/env python3
"""Generate circular white-halftone dot portraits for the quote wallpaper.

Usage:  python3 scripts/generate_portraits.py [slug ...]
Reads   portrait-src/<slug>.jpg|png   (source photos, not committed if you prefer)
Writes  public/portraits/<slug>.png   (transparent 760px circular halftone)

Each person gets custom tuning (crop box, contrast, gamma) in PEOPLE below,
because every photo is different. Add a new speaker = add photo + one line here.
"""
import sys, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "portrait-src")
OUT_DIR = os.path.join(ROOT, "public", "portraits")

OUT_PX    = 760    # output canvas (rendered at 2x of ~380px display size)
COLS      = 68     # dot grid resolution (finer = smaller dots)
DOT_SCALE = 0.60   # max dot radius as fraction of cell
FADE_FROM = 0.80   # radial fade start (fraction of radius)
MIN_V     = 0.05   # luminance cutoff

# slug -> {src crop (l,t,r,b) or None, contrast, gamma}
# Crops were face-detected (OpenCV) then hand-checked; lincoln/omar set manually.
PEOPLE = {
    "abraham-lincoln":     {"crop": (45, 22, 125, 102),      "contrast": 1.6,  "gamma": 0.85},
    "blondie":             {"crop": (76, 86, 741, 751),      "contrast": 1.65, "gamma": 0.9,  "fade": 0.55, "min_v": 0.12},
    "bobby-axelrod":       {"crop": (156, 22, 350, 216),     "contrast": 1.6,  "gamma": 0.85},
    "cersei-lannister":    {"crop": (83, 0, 331, 248),       "contrast": 1.6,  "gamma": 0.85},
    "don-corleone":        {"crop": (181, 0, 508, 327),      "contrast": 1.5,  "gamma": 0.7},
    "don-draper":          {"crop": (102, 0, 177, 75),       "contrast": 1.6,  "gamma": 0.85},
    "frank-underwood":     {"crop": (35, 15, 245, 225),      "contrast": 1.65, "gamma": 0.82},
    "friedrich-nietzsche": {"crop": (99, 0, 223, 124),       "contrast": 1.6,  "gamma": 0.85},
    "harvey-dent":         {"crop": (41, 1, 364, 324),       "contrast": 1.6,  "gamma": 0.85},
    "harvey-specter":      {"crop": (355, 0, 755, 400),      "contrast": 1.6,  "gamma": 0.85},
    "logan-roy":           {"crop": (57, 8, 263, 214),       "contrast": 1.6,  "gamma": 0.85},
    "mark-cuban":          {"crop": (339, 0, 673, 334),      "contrast": 1.6,  "gamma": 0.85},
    "michael-corleone":    {"crop": (296, 598, 597, 899),    "contrast": 1.5,  "gamma": 0.62},
    "mike-ehrmantraut":    {"crop": (145, 0, 971, 826),      "contrast": 1.7,  "gamma": 0.9, "fade": 0.5},
    "omar-little":         {"crop": (55, 0, 265, 210),       "contrast": 1.6,  "gamma": 0.85},
    "oscar-wilde":         {"crop": (88, 0, 408, 320),       "contrast": 1.6,  "gamma": 0.85},
    "thomas-jefferson":    {"crop": (290, 82, 1039, 831),    "contrast": 1.6,  "gamma": 0.85},
    "thomas-szasz":        {"crop": (256, 0, 1169, 913),     "contrast": 1.7,  "gamma": 0.9, "fade": 0.55},
    "tommy-shelby":        {"crop": (185, 0, 550, 365),      "contrast": 1.6,  "gamma": 0.85},
    "tucker-max":          {"crop": (1993, 165, 3328, 1500), "contrast": 1.6,  "gamma": 0.85},
    "tyrion-lannister":    {"crop": (325, 0, 731, 406),      "contrast": 1.6,  "gamma": 0.85},
    "walter-white":        {"crop": (107, 0, 441, 334),      "contrast": 1.7,  "gamma": 0.9, "fade": 0.58},
}


def find_src(slug):
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        p = os.path.join(SRC_DIR, slug + ext)
        if os.path.exists(p):
            return p
    return None


def load_face(path, crop):
    im = Image.open(path).convert("L")
    im = ImageOps.autocontrast(im, cutoff=1)
    w, h = im.size
    if crop:
        im = im.crop(crop)
    else:
        side = min(w, int(h * 0.78))
        cx, cy = w // 2, int(h * 0.32)
        l = min(max(0, cx - side // 2), w - side)
        t = min(max(0, cy - side // 2), h - side)
        im = im.crop((l, t, l + side, t + side))
    return im


def generate(slug, cfg):
    src = find_src(slug)
    if not src:
        return False
    im = load_face(src, cfg.get("crop"))
    small = im.resize((COLS, COLS), Image.LANCZOS)
    g = np.asarray(small, dtype=np.float64) / 255.0
    g = np.clip((g - 0.5) * cfg.get("contrast", 1.6) + 0.5, 0, 1)
    g = np.power(g, cfg.get("gamma", 0.85))

    cell = OUT_PX / COLS
    R = OUT_PX / 2
    img = Image.new("RGBA", (OUT_PX, OUT_PX), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(COLS):
        for x in range(COLS):
            px, py = x * cell + cell / 2, y * cell + cell / 2
            dist = math.hypot(px - R, py - R) / R
            if dist > 1.0:
                continue
            v = g[y, x]
            fade = cfg.get("fade", FADE_FROM)
            if dist > fade:
                v *= max(0.0, 1 - (dist - fade) / (1 - fade)) ** 1.4
            if v < cfg.get("min_v", MIN_V):
                continue
            r = v * cell * DOT_SCALE
            if r < 0.5:
                continue
            a = int(60 + 195 * v)
            d.ellipse([px - r, py - r, px + r, py + r], fill=(255, 255, 255, a))
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, slug + ".png"), optimize=True)
    return True


if __name__ == "__main__":
    targets = sys.argv[1:] or list(PEOPLE)
    missing, done = [], []
    for slug in targets:
        if generate(slug, PEOPLE.get(slug, {})):
            done.append(slug)
        else:
            missing.append(slug)
    print("generated:", ", ".join(done) or "none")
    if missing:
        print("missing source photo in portrait-src/:", ", ".join(missing))
