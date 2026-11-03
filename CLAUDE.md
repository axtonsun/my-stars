# my-stars

Static site that shows the owner's GitHub stars grouped by purpose. Deployed to GitHub Pages by `.github/workflows/sync-and-deploy.yml` (daily cron, on push to `main`, and manual dispatch).

- `data/stars.json`: written by `scripts/sync_stars.py` in CI. Never edit by hand. CI only commits it when stars are added or removed.
- `data/classification.json`: hand-maintained. `categories` (id → `glyph`/`name`/`desc`; `glyph` is the one character used in call numbers like 研·02), `groups` (drawer order, each lists category ids), and `repos` (full_name → `cat`, `tags`, `summary`).
- `site/`: vanilla HTML/CSS/JS with no build step and no external resources (the owner is in China, so no CDNs or Google Fonts; fonts are self-hosted in `site/fonts/`). It reads both JSON files at runtime. The UI is a card-catalogue cabinet: one drawer per category, one card per repo. `draw.js` draws the cabinet as hand-drawn SVG, `app.js` handles state (kept in the URL hash: `c` drawer, `t` tag, `s` sort, `q` search, `r` repo). A starred repo with no entry in `classification.json` goes into the built-in `inbox` (「待归档」).
- The design explorations (other directions, mockups) live on the `design-explorations` branch, not on `main`.

The owner writes in Chinese. Write summaries and tags in Simplified Chinese.

## When asked to 「更新分类」 / classify new stars

1. `git pull` first. CI may have committed a newer `data/stars.json`.
2. Run `python3 scripts/check_classification.py`. It lists `UNCLASSIFIED` repos (need entries) and `NOT STARRED` entries (the owner unstarred them, so delete them).
3. For each unclassified repo, read its description and topics in `data/stars.json`. If the description is empty or unclear, fetch the README from `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md`. The GitHub API for other repos is not reachable from cloud sessions, but raw.githubusercontent.com is.
4. Add an entry: pick an existing `cat`, write 1–4 short `tags` (reuse existing tag spellings, such as `Agent Skill`, `论文写作`, `HyperLogLog`, `面试`), and a one-line Chinese `summary` of what the repo is for.
5. Only add a new category when several repos clearly don't fit any existing one. Add it to `categories` and to a group in `groups`.
6. Re-run the check script. It must exit 0. Then commit and push to `main`, which redeploys the site.

To preview locally, copy `site/` and `data/*.json` into one folder (`data/` next to `index.html`) and serve it with `python3 -m http.server`.
