"""Spot nfl.com's generic placeholder headshot.

Players without a real photo (most players from the 1980s and 90s) still get a unique
headshot URL, but it serves the same black-helmet silhouette. The URL can't tell them
apart, so fingerprint a tiny copy of each image: every placeholder produces the same
fingerprint, shared by thousands of players, while real photos almost never match.

Fingerprints are cached in raw/portrait_fingerprints.json so later builds only fetch
images they haven't seen.
"""
from __future__ import annotations

import io
import json
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from PIL import Image

CACHE = Path(__file__).parent / "raw" / "portrait_fingerprints.json"
# The silhouette is shared by thousands of players (7,568 of 11,284 in 2026). Real studio
# headshots can also collide at 8x8 (plain background, centred face), but only in groups
# of ~25 at most, so require a fingerprint to cover a sizeable share of all headshots.
PLACEHOLDER_MIN_SHARE = 0.05
NFL_IMAGE = re.compile(r"/(private|upload)/f_auto,q_auto/")


def _tiny_url(url: str) -> str:
    # Same face crop the app shows, shrunk to 16x16 PNG: enough to fingerprint, a few hundred bytes.
    return NFL_IMAGE.sub(r"/\1/c_thumb,g_face,w_16,h_16,f_png/", url)


def _fingerprint(url: str) -> str | None:
    """8x8 average hash: one bit per pixel, set when brighter than the image's mean."""
    try:
        r = requests.get(_tiny_url(url), timeout=20)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert("L").resize((8, 8))
    except (requests.RequestException, OSError):
        return None  # unreachable or not an image: let the app's own fallback handle it
    px = [im.getpixel((x, y)) for y in range(8) for x in range(8)]
    avg = sum(px) / len(px)
    return "".join("1" if v > avg else "0" for v in px)


def placeholder_urls(urls: set[str]) -> set[str]:
    """Return the subset of `urls` that serve the generic placeholder image."""
    cache: dict[str, str | None] = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    todo = sorted(u for u in urls if u not in cache)
    if todo:
        print(f"fingerprinting {len(todo)} headshots")
        with ThreadPoolExecutor(16) as ex:
            for url, fp in zip(todo, ex.map(_fingerprint, todo)):
                cache[url] = fp
        CACHE.write_text(json.dumps(cache))

    shared = Counter(cache[u] for u in urls if cache.get(u))
    min_shared = PLACEHOLDER_MIN_SHARE * sum(shared.values())
    placeholders = {fp for fp, n in shared.items() if n >= min_shared}
    return {u for u in urls if cache.get(u) in placeholders}
