# Design

How the site looks and why, for anyone (people or Claude) changing it. `CLAUDE.md` says what the site does; this file says how a change should look and behave so it stays the same site.

## The world

An old library card catalogue, drawn by hand: a wooden cabinet with brass label holders and ring pulls, cream index cards with a red rule and blue lines, rubber stamps, a wire basket for unfiled cards, all on warm paper. Everything new should be something that could be in that room. Pick from its materials (wood, brass, card, ink, stamps, pencil) before reaching for a generic web pattern.

These are on purpose, even though generic design checklists (impeccable, for one) flag them as tells of AI-made pages. Keep them:

- the cream paper background and its noise texture
- the pencil textures (SVG `feTurbulence` filters) and the hand-drawn, slightly bowed lines in `draw.js`
- the ruled lines on the card taken out, and the wire basket's grid
- the cabinet bouncing when it drops, and the drawers rattling
- the loading cabinet shown for at least 3 seconds (the owner asked for it)
- one light theme: paper is light. There is no dark mode.

## Colour

All page colours are tokens at the top of `site/style.css`. Use them; add a token rather than a new literal when a colour comes back.

| Token | Value | For |
| --- | --- | --- |
| `--paper` | `#f7f2e6` | the page |
| `--ink` | `#2a2522` | headings, lines, borders |
| `--body` | `#4a4038` | running text |
| `--sub` | `#6f665c` | secondary text (5.0:1 on paper) |
| `--faint` | `#766c60` | quiet controls: language switch, sort links, footer, placeholder (4.6:1 on paper) |
| `--meta` | `#776856` | call numbers and the author · language · date line on cards (5.0:1 on a card) |
| `--red` | `#b8443a` | the one accent: what is picked, links, stamps, the focus ring (4.8:1 on paper) |
| `--red-deep` | `#a83d33` | red text on the lit guide tab, where `--red` is too light (4.9:1) |
| `--card` | `#fbf7ec` | catalogue cards |
| `--tray` | `#e4cfa8` | the inside of an open drawer |
| `--wood-deep` | `#a97b4c` | the tray's front edge, scrollbars |
| `--guide` | `#efe2c4` | guide-card tabs |

Each drawer has its own coloured pencil (`COLOR` in `app.js`); `draw.js` has its own constants for the cabinet's wood and brass, since SVG markup can't read CSS variables.

Text has to reach WCAG AA against what is actually behind it: 4.5:1 for normal text, 3:1 for text 24px and up (or 18.7px bold). Measure it; don't judge by eye. A grey that fails gets darker in the same hue, not a different colour.

## Type

- **Newsreader** for every Latin letter and figure, in both languages. It is variable in weight and optical size, so small text gets sturdier shapes on its own. Self-hosted in `site/fonts/newsreader/`, upright only.
- **Noto Serif SC** (思源宋体), regular and bold, for Chinese. Self-hosted in `site/fonts/noto-serif-sc/`, split into pieces by `unicode-range` so a page only downloads the characters it shows.
- Every stack puts Newsreader first and Noto Serif SC after it, so Latin words inside Chinese text are Newsreader too. `--latin` is for words that are Latin whatever the page's language (repo names, counts, GitHub's descriptions); `--text` is for the rest. When the page is in Chinese, `--text` first takes the quotes, dash and ellipsis (“” ‘’ — …) from Noto Serif SC (the face `Noto Serif SC Punct`), a full character wide, so the Chinese ellipsis …… sits in the middle of the line, not on the baseline as Newsreader's does.
- Words drawn in the cabinet's SVG take the page's fonts; `draw.js` names no font.
- No other faces, and nothing from a CDN or Google Fonts (the owner is in China).
- Body text is 16px and nothing new goes below 12px. The few smaller ones are labels on things in the picture: the 11px "call no." on a card, the 11px "new" stamp in English, and each drawer's card count in the corner of its label.
- Headings use `text-wrap: balance` and paragraphs `text-wrap: pretty`.

## Layout

- Desktop: the cabinet on the left, the open drawer's tray on the right, both the cabinet's height. Every drawer's tray has the same size and place (`fitLid()` in `app.js`).
- At 820px and narrower: the drawers sit in two columns and a drawer opens onto a page of its own, with "← 柜子" to go back.
- No small label above a heading. The one exception is the search page's "检索「…」", which says what was searched for.

## Motion

- Movement is physical: drawers slide out easing off and go back in gathering speed; the cabinet falls under gravity. No generic fades or slide-ins on content.
- Move things with CSS transforms and Web Animations, never by drawing the cabinet again each frame. Keep new filtered (pencil) drawing out of the cabinet, or put it through `art()` in `draw.js` so it is drawn once into a picture.
- Every animation has a `prefers-reduced-motion` path that keeps the end state and drops the movement.

## Keyboard and screen readers

- Opening and closing drawers, picking guide cards and taking cards out all work with Tab, Enter and Esc. Dragging a handle and lifting the cabinet are extras for a pointer. The first Tab stop is "跳到卡片列表", which skips the drawers.
- After a key press opens or closes something, `refocus()` in `app.js` puts the focus on the new heading, or back on the drawer or card it came from. Mouse and touch users are left alone.
- The panel is not a live region. A change is read out as one line in `#status` (`said` in `i18n.js`); a new kind of view needs a line there in both languages.
- Focus is shown with the red outline (`:focus-visible`), never removed.

## Words

Every string the interface shows lives in `site/i18n.js`, in Chinese and English. Errors say what happened in plain words first, then the technical detail, then what to do (a button, not "try refreshing").
