"""Build web/public/data/{year}.json and years.json from the cached nflverse files.

Run `python pipeline/fetch.py` first (or pass --fetch here).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

import features as F
import portraits

OUT = Path(__file__).parent.parent / "web" / "public" / "data"

CAREER_FIELDS = {
    "passYds": "pass_yards", "passTd": "pass_tds", "int": "pass_ints",
    "rushYds": "rush_yards", "rushTd": "rush_tds",
    "rec": "receptions", "recYds": "rec_yards", "recTd": "rec_tds",
    "soloTkl": "def_solo_tackles", "defInt": "def_ints", "sacks": "def_sacks",
}


def num(v) -> float:
    return 0.0 if pd.isna(v) else float(v)


def career_totals(row) -> dict:
    out = {}
    for key, col in CAREER_FIELDS.items():
        v = num(row[col])
        if v:
            out[key] = v if key == "sacks" else int(v)
    return out


def real_photo(url: str | None, placeholders: set[str]) -> str | None:
    return None if url is None or url in placeholders else url


def build(years: list[int] | None = None) -> None:
    d = F.draft()
    links = F.roster_links()
    pos = F.career_position(links)
    gsis = F.gsis_for_pids(links)
    sbs = F.super_bowls(links, gsis, pos)
    shots = F.headshots()
    # Drop nfl.com's generic silhouette so the app shows the position instead.
    candidate_urls = {shots[g] for g in gsis.dropna() if g in shots}
    placeholders = portraits.placeholder_urls(candidate_urls)
    print(f"headshots: {len(candidate_urls) - len(placeholders)} real, {len(placeholders)} placeholders dropped")

    stats = F.season_stats()
    stats_by_id = {k: g for k, g in stats.groupby("player_id")}

    OUT.mkdir(parents=True, exist_ok=True)
    all_years = sorted(d.season.unique())
    years = years or all_years
    report = []

    for year in years:
        cls = d[d.season == year]
        players = {}
        unmatched = 0
        for row in cls.itertuples():
            games = num(row.games)
            if games <= 0:
                continue  # never played an NFL game: can't be a starter
            p = pos.get(row.pid) or F.canon_pos(row.position)
            if p is None or p == "ST":
                continue
            if row.pid not in pos.index:
                unmatched += 1
            g = gsis.get(row.pid)
            g = g if isinstance(g, str) else None
            pid = row.pfr_player_id if isinstance(row.pfr_player_id, str) else f"pick{row.pick}"

            seasons = []
            if g and g in stats_by_id:
                seasons = [F.season_line(s) for _, s in stats_by_id[g].sort_values("season").iterrows()]

            players[pid] = {
                "id": pid,
                "name": row.pfr_player_name,
                "pos": p,
                "draftPos": row.position,
                "round": int(row.round),
                "pick": int(row.pick),
                "team": F.DRAFT_TEAM_FIX.get(row.team, row.team),
                "college": row.college if isinstance(row.college, str) else None,
                "hof": bool(row.hof),
                "lastSeason": int(row.to),
                "av": num(row.w_av),
                "allPro": int(num(row.allpro)),
                "proBowls": int(num(row.probowls)),
                "seasonsStarted": int(num(row.seasons_started)),
                "games": int(games),
                "headshot": real_photo(shots.get(g) if g else None, placeholders),
                "career": career_totals(cls.loc[row.Index]),
                "sb": sbs.get(int(row.pid), []),
                "seasons": seasons,
            }

        (OUT / f"{year}.json").write_text(
            json.dumps({"year": int(year), "players": players}, separators=(",", ":"), allow_nan=False)
        )
        report.append((year, len(players), unmatched))

    (OUT / "years.json").write_text(json.dumps([int(y) for y in all_years]))
    for year, n, unmatched in report:
        flag = "  <-- check" if n and unmatched / n > 0.05 else ""
        print(f"{year}: {n} players, {unmatched} without roster match{flag}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("years", nargs="*", type=int, help="only build these years (default: all)")
    ap.add_argument("--fetch", action="store_true", help="download missing raw files first")
    args = ap.parse_args()
    if args.fetch:
        import fetch
        fetch.download()
    build(args.years or None)


if __name__ == "__main__":
    main()
