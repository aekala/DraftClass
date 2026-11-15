# DraftClass

Pick an NFL draft year (1980 to now) and see the best starting lineup that class could field: offense on the bottom, a 4-3 defense on top. Click any player for their stats. Tune the scoring model and the lineup recalculates instantly.

## Run it

```bash
# 1. Build the data (needs Python 3.10+)
python3 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -r pipeline/requirements.txt
pipeline/.venv/bin/python pipeline/build.py --fetch   # downloads ~55 MB from nflverse, writes web/public/data/

# 2. Run the app
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run build      # static site in web/dist/, deployable anywhere
```

### Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which tests and builds `web/` and publishes it to GitHub Pages. The data files in `web/public/data/` are committed, so the workflow doesn't run the Python pipeline. To update the data, rebuild it locally and commit the changed JSON.

During the season, run `pipeline/.venv/bin/python pipeline/fetch.py --refresh` and then `build.py` to pick up new stats.

## How it works

**Data** ([nflverse](https://github.com/nflverse/nflverse-data), free):
- `draft_picks`: every pick since 1980, with career Approximate Value (AV), Pro Bowls, All-Pros, and career stat totals.
- `rosters`: which team each player was on each season. Draftees are matched by ID, or by name for older seasons that lack IDs. About 99% of players match.
- `stats_player`: season-by-season stats, 1999 on.
- `snap_counts`: games each player was on the field, 2013 on (used for the Super Bowl games-played rule).
- `players`: headshots from nfl.com. Most players before about 2008 only have a generic helmet silhouette, served under a unique link per player. The build fingerprints a 16×16 copy of each headshot (`pipeline/portraits.py`, cached in `pipeline/raw/portrait_fingerprints.json`) and drops the silhouette, so those players show their position instead. The first run takes a few minutes.
- `pipeline/super_bowls.csv`: hand-entered, one row per season with the winner, the loser, and each team's starting QB.

**Pipeline** (`pipeline/`) writes one JSON file per class with the raw inputs only. Nothing is scored at build time.

**Scoring** (`web/src/lib/scoring.ts`), all tunable in the app:
- Base value: career AV.
- Bonuses: All-Pro (+4 each), Pro Bowl (+1.5 each), Super Bowl win/loss (+3/+1), with the starting QB's Super Bowl bonus doubled.
- To get Super Bowl credit, a player must be on that team's roster. From 2002 on, he must be on the Super Bowl-week roster. He must also have played at least half the regular season (8 games). Games played come from snap counts from 2013 on. For 1999–2012 they come from season stats, which only log games where a player recorded a stat; linemen rarely do, so the games check is skipped for them in those years.

**Lineup** (`web/src/lib/lineup.ts`, `assign.ts`): the Hungarian algorithm finds the highest-scoring assignment of players to the 22 slots. Players can fill nearby positions at a small penalty (for example, a guard at center counts at 90%). Turning off "Allow close-fit positions" allows exact positions only.

## Known limits
- AV for recent classes is still growing, so classes from the last few years naturally look thin.
- Pre-2002 Super Bowl credit counts everyone on the season roster (not cut or traded), so it is a little generous.
