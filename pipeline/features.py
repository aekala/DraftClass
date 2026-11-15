"""Turn raw nflverse files into per-player scoring inputs.

Nothing here decides a lineup: the browser does the scoring and slot assignment,
so users can retune the model. This module only produces the inputs.
"""
from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).parent
RAW = HERE / "raw"
FIRST_STATS = 1999

# Team codes changed spelling in some nflverse seasons; map them back to one form.
TEAM_FIX = {"ARZ": "ARI", "BLT": "BAL", "CLV": "CLE", "HST": "HOU", "SL": "STL"}
# draft_picks uses Pro Football Reference codes; map them to the codes rosters use.
DRAFT_TEAM_FIX = {
    "GNB": "GB", "KAN": "KC", "NOR": "NO", "NWE": "NE", "SFO": "SF", "TAM": "TB",
    "SDG": "SD", "LVR": "LV", "LAR": "LA",
}

# Every raw position label -> one canonical code the web app's fit table understands.
POS_MAP = {
    "QB": "QB", "RB": "RB", "HB": "RB", "FB": "FB", "WR": "WR", "TE": "TE",
    "T": "OT", "OT": "OT", "G": "G", "OG": "G", "C": "C", "OL": "OL",
    "DE": "DE", "DT": "DT", "NT": "DT", "DL": "DL",
    "OLB": "OLB", "ILB": "ILB", "MLB": "ILB", "LB": "LB",
    "CB": "CB", "S": "S", "SAF": "S", "FS": "S", "SS": "S", "DB": "DB",
    "K": "ST", "P": "ST", "LS": "ST", "KR": "ST", "SPEC": "ST",
}
GENERIC = {"OL", "DL", "LB", "DB"}
GROUP_OF = {
    "QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE",
    "OT": "OL", "G": "OL", "C": "OL", "OL": "OL",
    "DE": "DL", "DT": "DL", "DL": "DL",
    "OLB": "LB", "ILB": "LB", "LB": "LB",
    "CB": "DB", "S": "DB", "DB": "DB",
}

SUFFIX = re.compile(r"\b(jr|sr|ii|iii|iv|v)\b\.?")


def name_key(name: object) -> str:
    s = SUFFIX.sub("", str(name).lower())
    return re.sub(r"[^a-z]", "", s)


def canon_pos(label: object) -> str | None:
    return POS_MAP.get(str(label).upper()) if isinstance(label, str) else None


# ---------------------------------------------------------------- loading

@lru_cache
def draft() -> pd.DataFrame:
    d = pd.read_csv(RAW / "draft_picks.csv", low_memory=False)
    d["nk"] = d.pfr_player_name.map(name_key)
    d["pid"] = np.arange(len(d))
    d["to"] = d["to"].fillna(d.season).astype(int)
    return d


@lru_cache
def rosters() -> pd.DataFrame:
    frames = []
    for f in sorted(RAW.glob("roster_*.csv")):
        r = pd.read_csv(f, low_memory=False)
        keep = ["season", "team", "position", "depth_chart_position", "status", "full_name", "gsis_id"]
        if "game_type" in r.columns:
            keep.append("game_type")
        frames.append(r[[c for c in keep if c in r.columns]])
    r = pd.concat(frames, ignore_index=True)
    r["team"] = r.team.replace(TEAM_FIX)
    r["nk"] = r.full_name.map(name_key)
    detail = r.depth_chart_position.where(r.depth_chart_position.notna(), r.position)
    r["pos"] = detail.map(canon_pos)
    return r


@lru_cache
def season_stats() -> pd.DataFrame:
    frames = [pd.read_csv(f, low_memory=False) for f in sorted(RAW.glob("stats_player_reg_*.csv"))]
    s = pd.concat(frames, ignore_index=True)
    s = s[s.player_id.notna()].copy()
    s["recent_team"] = s.recent_team.replace(TEAM_FIX)
    s["pos"] = s.position.map(canon_pos)
    return s.fillna({c: 0 for c in s.select_dtypes("number").columns})


@lru_cache
def headshots() -> dict[str, str]:
    p = pd.read_csv(RAW / "players.csv", low_memory=False, usecols=["gsis_id", "headshot"])
    p = p.dropna()
    return dict(zip(p.gsis_id, p.headshot))


# ---------------------------------------------------------------- joins

@lru_cache
def roster_links() -> pd.DataFrame:
    """Every roster row that belongs to a drafted player, tagged with that player's pid.

    Match on gsis_id when both sides have one; otherwise on normalized name, restricted
    to seasons the drafted player was active (draft year .. last season).
    """
    d = draft()[["pid", "gsis_id", "nk", "season", "to"]].rename(columns={"season": "dseason"})
    r = rosters()

    by_id = r[r.gsis_id.notna()].merge(d[d.gsis_id.notna()], on="gsis_id", suffixes=("", "_d"))
    by_id = by_id.drop(columns=["nk_d"])

    by_name = r.merge(d, on="nk", suffixes=("", "_d"))
    by_name = by_name[
        (by_name.gsis_id.isna() | by_name.gsis_id_d.isna())
        & by_name.season.between(by_name.dseason, by_name.to)
    ]
    by_name = by_name.assign(gsis_id=by_name.gsis_id.fillna(by_name.gsis_id_d)).drop(columns=["gsis_id_d"])

    links = pd.concat([by_id, by_name], ignore_index=True)
    return links.drop_duplicates(["pid", "season", "team"])


def career_position(links: pd.DataFrame) -> pd.Series:
    """Most common specific position across a player's seasons (one vote per season)."""
    per_season = links.dropna(subset=["pos"]).drop_duplicates(["pid", "season"])

    def pick(s: pd.Series) -> str:
        counts = s.value_counts()
        specific = counts[~counts.index.isin(GENERIC)]
        top = counts.index[0]
        # Prefer a specific label in the same group over a generic one (e.g. OT over OL).
        if top in GENERIC and len(specific) and GROUP_OF.get(specific.index[0]) == GROUP_OF.get(top):
            return specific.index[0]
        return top

    return per_season.groupby("pid").pos.agg(pick)


def gsis_for_pids(links: pd.DataFrame) -> pd.Series:
    d = draft().set_index("pid").gsis_id
    from_roster = links.dropna(subset=["gsis_id"]).groupby("pid").gsis_id.first()
    return d.fillna(from_roster)


# ---------------------------------------------------------------- Super Bowls

MIN_GAMES = 8  # at least half a regular season


@lru_cache
def snap_games() -> pd.Series:
    """(pfr_id, season) -> regular-season games with at least one snap (offense, defense or special teams)."""
    frames = [pd.read_csv(f, low_memory=False) for f in sorted(RAW.glob("snap_counts_*.csv"))]
    s = pd.concat(frames, ignore_index=True)
    s = s[(s.game_type == "REG") & ((s.offense_snaps + s.defense_snaps + s.st_snaps) > 0)]
    return s.groupby(["pfr_player_id", "season"]).game_id.nunique()


@lru_cache
def snap_seasons() -> frozenset[int]:
    """Seasons that actually have snap data (nflverse publishes an empty file for 2012)."""
    return frozenset(int(y) for y in snap_games().index.get_level_values("season").unique())


def games_played(pid: int, season: int, gsis: pd.Series, positions: pd.Series) -> int | None:
    """Regular-season games a drafted player appeared in, or None when the data can't say.

    Seasons with snap counts (2013+): snap counts, which log every game a player was on the field.
    Earlier (1999+): season stats, which only log games where the player recorded a stat. That
    undercounts linemen badly (they rarely record stats), so for them we return None.
    """
    if season in snap_seasons():
        pfr = draft().at[pid, "pfr_player_id"]
        if isinstance(pfr, str):
            return int(snap_games().get((pfr, season), 0))
        return None
    if season >= FIRST_STATS and GROUP_OF.get(positions.get(pid)) != "OL":
        g = gsis.get(pid)
        if isinstance(g, str):
            return stat_games().get((g, season))
    return None


@lru_cache
def stat_games() -> dict[tuple[str, int], int]:
    s = season_stats().groupby(["player_id", "season"]).games.sum()
    return {k: int(v) for k, v in s.items()}


def super_bowls(links: pd.DataFrame, gsis: pd.Series, positions: pd.Series) -> dict[int, list[dict]]:
    """pid -> list of {season, won, team, qb} for Super Bowl teams the player was part of."""
    sb = pd.read_csv(HERE / "super_bowls.csv")
    d = draft().set_index("pid")
    out: dict[int, list[dict]] = {}

    for row in sb.itertuples():
        for team, won, qb in ((row.winner, True, row.winner_qb), (row.loser, False, row.loser_qb)):
            on_team = links[(links.season == row.season) & (links.team == team)]
            if row.season >= 2002 and "game_type" in on_team:
                # Weekly rosters: the player's last row for this team must be Super Bowl week.
                on_team = on_team[on_team.game_type == "SB"]
            else:
                on_team = on_team[~on_team.status.isin(["CUT", "TRD", "TRC", "TRT"])]
            for pid in on_team.pid.unique():
                played = games_played(pid, row.season, gsis, positions)
                if played is not None and played < MIN_GAMES:
                    continue
                started_qb = name_key(d.at[pid, "pfr_player_name"]) == name_key(qb)
                out.setdefault(int(pid), []).append(
                    {"season": int(row.season), "won": won, "team": team, "qb": started_qb}
                )
    return out


# ---------------------------------------------------------------- season lines

SEASON_FIELDS = {
    "cmp": "completions", "att": "attempts", "passYds": "passing_yards", "passTd": "passing_tds",
    "int": "passing_interceptions", "passEpa": "passing_epa",
    "car": "carries", "rushYds": "rushing_yards", "rushTd": "rushing_tds",
    "rec": "receptions", "tgt": "targets", "recYds": "receiving_yards", "recTd": "receiving_tds",
    "soloTkl": "def_tackles_solo", "astTkl": "def_tackle_assists", "sacks": "def_sacks",
    "tfl": "def_tackles_for_loss", "qbHits": "def_qb_hits", "defInt": "def_interceptions",
    "pd": "def_pass_defended", "ff": "def_fumbles_forced", "defTd": "def_tds",
}


def season_line(row: pd.Series) -> dict:
    team = row.recent_team if isinstance(row.recent_team, str) else None
    line = {"season": int(row.season), "team": team, "g": int(row.games)}
    for key, col in SEASON_FIELDS.items():
        v = float(row[col])
        if v:
            line[key] = round(v, 1) if key in ("passEpa", "sacks") else int(v)
    return line
