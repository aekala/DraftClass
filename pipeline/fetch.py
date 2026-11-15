"""Download and cache nflverse CSVs into pipeline/raw/.

Files already present are skipped; pass --refresh to re-download everything
(useful during the season, when the current year's files change weekly).
"""
from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import requests

BASE = "https://github.com/nflverse/nflverse-data/releases/download"
RAW = Path(__file__).parent / "raw"
FIRST_DRAFT = 1980
FIRST_STATS = 1999
FIRST_SNAPS = 2012  # 2012 file is published but empty; harmless to fetch


def last_season() -> int:
    today = dt.date.today()
    # The NFL season starts in September; before then, last year is the latest.
    return today.year if today.month >= 9 else today.year - 1


def files() -> dict[str, str]:
    out = {
        "draft_picks.csv": f"{BASE}/draft_picks/draft_picks.csv",
        "players.csv": f"{BASE}/players/players.csv",
    }
    for y in range(FIRST_DRAFT, last_season() + 1):
        out[f"roster_{y}.csv"] = f"{BASE}/rosters/roster_{y}.csv"
    for y in range(FIRST_SNAPS, last_season() + 1):
        out[f"snap_counts_{y}.csv"] = f"{BASE}/snap_counts/snap_counts_{y}.csv"
    for y in range(FIRST_STATS, last_season() + 1):
        out[f"stats_player_reg_{y}.csv"] = f"{BASE}/stats_player/stats_player_reg_{y}.csv"
    return out


def download(refresh: bool = False) -> None:
    RAW.mkdir(exist_ok=True)
    for name, url in files().items():
        dest = RAW / name
        if dest.exists() and not refresh:
            continue
        print(f"downloading {name}")
        r = requests.get(url, timeout=120)
        if r.status_code == 404:
            print(f"  not published yet: {name}")
            continue
        r.raise_for_status()
        dest.write_bytes(r.content)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download files that already exist")
    download(ap.parse_args().refresh)
