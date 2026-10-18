"""Encode reviewed imagegen outputs as the site's JPG and WebP poster assets."""
import json
import sys
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
mapping = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
for entry in mapping:
    target = (root / "public" / entry["target"]).resolve()
    if target.parent not in (root / "public/visa-posters", root / "public/travel-posters"):
        raise ValueError(f"Unexpected poster destination: {target}")
    with Image.open(entry["source"]) as image:
        image = image.convert("RGB").resize((1080, 1080), Image.Resampling.LANCZOS)
        image.save(target, quality=95, optimize=True)
        image.save(target.with_suffix(".webp"), quality=88, method=6)
    print(entry["target"])
