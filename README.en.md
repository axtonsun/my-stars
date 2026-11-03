# my-stars

[中文](README.md) · English

My GitHub stars, sorted by what they're for, as a searchable website in Chinese and English.

**Site:** https://axtonsun.github.io/my-stars/

## What it does

The whole site is an old library card catalogue:

- **One drawer per category**: the drawers are arranged in groups. Click one to pull it out, and its cards appear on the right; click it again to close it
- **One card per repo**: each card has a call number (研·02 is the second most-starred card in the AI for Research drawer), a one-line summary and the star count. Hover over it to see its tags, author and language
- **Guide cards**: in an open drawer, filter by tag (only "Paper Writing", say). Every tag that at least two of the drawer's cards share gets a guide card. The links at the top right sort by stars, date starred or last update
- **Search**: repo names, Chinese and English summaries, tags and programming languages are all searchable; press `/` to start. Drawers with matches get a small red flag showing how many
- **Card details**: click a card to see the full record, a stamp with the date it was starred, whether the repo is still maintained, and other stars on similar subjects. Press `Esc` to put it back
- **Unfiled**: newly starred repos land in a wire basket first, and a note pinned to the top of the cabinet says how many are waiting
- **Chinese and English**: switch with 中文 / EN at the top right. On your first visit the site follows your browser's language, and after that it remembers the one you picked. Category names, summaries and tags come in both languages, and search finds either language whichever one is showing
- On phones the drawers sit in two columns and open full screen. The URL keeps the open drawer, filter, search and language, so any view can be bookmarked or shared

## Keeping it up to date

GitHub Actions fetches the star list every day at 04:17 Beijing time (20:17 UTC) and redeploys the site; pushing to `main` redeploys it too. To run it by hand, open the repo's **Actions** tab and click **Run workflow**.

New stars go into the Unfiled basket first, with GitHub's own description and topics, and they can be searched straight away. Once a few have piled up, ask Claude to 「更新分类」 (classify the new stars): it writes Chinese and English summaries and tags and files the cards into drawers. The steps are in `CLAUDE.md`.

## Files

| Path | What it is |
| --- | --- |
| `site/` | The website: plain HTML / CSS / JS with no build step and no external resources, so it loads fast in China too |
| `site/draw.js` | Draws the hand-drawn cabinet as SVG |
| `site/app.js` | Interaction and state (kept in the URL) |
| `site/i18n.js` | Interface text in Chinese and English |
| `site/fonts/` | Self-hosted fonts: LXGW WenKai (OFL) and Kevin Serif (MIT) |
| `data/stars.json` | The synced star list; don't edit it by hand |
| `data/classification.json` | Categories, tags and summaries in both languages; edited by hand |
| `scripts/sync_stars.py` | Fetches the star list |
| `scripts/check_classification.py` | Checks the classification: unfiled repos, unstarred ones, missing English, unused tags |
| `.github/workflows/sync-and-deploy.yml` | Daily sync and deploy to GitHub Pages |

## Changing the classification by hand

Edit `data/classification.json`:

- Move a repo to another drawer: change its `"cat"`
- Change a summary: Chinese goes in `summary`, English in `summary_en`
- Change tags: edit `tags`. Each tag is written once, and a Chinese tag needs an English name in `tags_en`, which is what the English site shows. Tags say what a repo is about, not the language it's written in: the card already shows the language GitHub reports, and search finds it
- Add a category (a new drawer): add an entry to `categories` with `name` / `desc` and the English `name_en` / `desc_en` (`glyph` is the single character used in call numbers, in both languages), then put its id in one of the `groups`. Keep `name_en` short: the drawer label fits two lines of about 15 letters

Then run the check script, and commit once it passes:

```bash
python3 scripts/check_classification.py
```

The site redeploys once the commit is on `main`.

## Preview locally

Copy `site/` and `data/*.json` into one folder, with `data/` next to `index.html`:

```bash
mkdir -p /tmp/my-stars-preview/data && cp -r site/. /tmp/my-stars-preview/ && cp data/*.json /tmp/my-stars-preview/data/
```

Then serve that folder and open http://localhost:8000:

```bash
cd /tmp/my-stars-preview && python3 -m http.server
```

The design mockups and other directions are on the [`design-explorations`](https://github.com/axtonsun/my-stars/tree/design-explorations) branch.
