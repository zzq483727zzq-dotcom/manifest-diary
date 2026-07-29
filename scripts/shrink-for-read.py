#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Make a vision-safe copy of a PNG/JPG for Claude Code Read.

Why: full-res Impeccable mocks (~1536x1024, 1MB+) each inject large vision
token counts into the main session prompt. Reading several in one turn
blows the 500k limit. This writes a smaller sibling next to the source:

  foo.png  ->  foo.read.jpg   (default max width 960, JPEG q=72)

Usage:
  python scripts/shrink-for-read.py path/to/comp.png
  python scripts/shrink-for-read.py path/to/comp.png --width 720 --quality 65
  python scripts/shrink-for-read.py .impeccable/mocks/*.png

Then Read only the *.read.jpg files -- never the full mocks -- in the main session.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("Pillow required: pip install pillow\n")
    sys.exit(1)


def shrink(src, max_width, quality):
    out = src.with_name(src.stem + ".read.jpg")
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        if w > max_width:
            nh = int(h * (max_width / float(w)))
            im = im.resize((max_width, nh), Image.Resampling.LANCZOS)
        im.save(out, "JPEG", quality=quality, optimize=True)
    return out


def main():
    p = argparse.ArgumentParser(description="Shrink images for safe Claude Read")
    p.add_argument("paths", nargs="+", help="Source image paths")
    p.add_argument("--width", type=int, default=960, help="Max width (default 960)")
    p.add_argument("--quality", type=int, default=72, help="JPEG quality (default 72)")
    args = p.parse_args()

    for raw in args.paths:
        src = Path(raw)
        if not src.is_file():
            sys.stderr.write("skip missing: %s\n" % src)
            continue
        out = shrink(src, args.width, args.quality)
        size_kb = out.stat().st_size / 1024.0
        with Image.open(out) as im:
            print("%s -> %s  %dx%d  %.0fKB" % (src.name, out.name, im.size[0], im.size[1], size_kb))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
