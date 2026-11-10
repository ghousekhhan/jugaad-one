# Jugaad Grid V2

A warm, editorial interface for a consumer transaction workspace. Energy 2, Rhythm 3, Motion 2. The homepage pairs a large typographic lead with a task walkthrough, then alternates between numbered process rows, a checkout specimen and a provider directory. The workspace gives the same grid a quieter role under white information panels.

## Color tokens

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#F8F5EE` | Main canvas |
| `--paper-elevated` | `#FFFFFF` | Transaction panels and fields |
| `--ink` | `#161616` | Primary text and dark brand surface |
| `--ink-muted` | `#6F6B65` | Metadata on paper and white |
| `--accent-primary` | `#FF633A` | Principal action and brand detail |
| `--accent-hover` | `#E4552E` | Primary action hover |
| `--accent-marigold` | `#F2B544` | Supporting accent, selection and dark-surface focus |
| `--success` | `#16866E` | Reserved for confirmed positive transaction states |
| `--grid-line` | `#E5DDD0` | Graph-paper ruling |
| `--border` | `#DDD4C7` | Panels and divider rules |
| `--surface-soft` | `#F0EBE2` | Insets and secondary surfaces |
| `--danger` | `#BB3D38` | Field errors |
| `--navy` | `#1E293B` | Keyboard focus on light surfaces |
| `--ink-secondary` | `#5D5953` | Secondary text over grid and soft fills |
| `--accent-text` | `#CD4827` | Accessible headline accent and selected step underline |
| `--control-border` | `#847E75` | Form and secondary button boundaries |

The orange button uses ink text. The headline uses `--accent-text` to preserve large-text contrast over both paper and the grid lines. Light dividers organize content. A stronger control border identifies interactive boundaries. Success stays reserved until the backend can confirm a real sandbox state.

## Typography

Bricolage Grotesque at 700–800 gives the campaign and section headings their wide, compact rhythm. Instrument Sans at 400–700 keeps copy, forms, navigation and status text readable in dense panels. Noto Sans Devanagari and Noto Sans Telugu take priority on `lang="hi"` and `lang="te"` content and are also available as glyph fallbacks. The Noto script fonts include a variable 100–900 range. Locally bundled fonts use `next/font/local` with `font-display: swap`. The Latin fonts preload and the Indic subsets load as needed. Each font ships with its SIL Open Font License.

| Style | Mobile | Tablet | Desktop | Weight / line height |
| --- | --- | --- | --- | --- |
| Hero H1 | 44–52 px | 56–72 px | 76–92 px, 84 px at 1440 | 800 / 1.045 to 0.995 |
| Section H2 | 32–40 px | 44–52 px | 48–60 px, 52 px at 1440 | 700 / 1.08 |
| Major H3 | 22–24 px | 28 px | 28 px | 700 / 1.15 |
| Hero support | 17 px | 19 px | 21 px | 400 / 1.5 |
| Body | 16 px | 16–17 px | 16–17 px | 400 / 1.6 |
| Nav / controls | 14 / 15–16 px | 14 / 15–16 px | 14 / 15–16 px | 600–700 |
| Input values | 16 px | 16 px | 16 px | 500 |
| Metadata / indexes | 12–13 px | 12–13 px | 12–13 px | 500–700 |

Hero tracking moves from `-0.04em` on mobile to `-0.055em` on desktop. Section headings use `-0.045em`. Index labels use `0.10em` tracking. Future quoted totals use Instrument Sans, 32–40 px, weight 700 and tabular figures. The checkout preview has no live quote amount.

## Layout and motion

- Content caps at 1280 px. Gutters are 20 px on mobile, 32 px at 720 px and up, and 64 px at 1100 px and up.
- The marketing grid uses four mobile columns with 16 px gaps and 12 wider columns with 24 px gaps. The workspace stacks on mobile, uses two columns on tablet, and gives conversation, comparison and constraints separate columns on desktop.
- The spacing scale is 4, 8, 12, 16, 24, 32, 48, 64, 96 and 128 px. Section padding is 72, 96 and 128 px by breakpoint. Graph-paper cells are 24 px on mobile and 32 px on wider screens, with 55% grid-line opacity.
- The header is 68 px on mobile and 80 px on wider screens. Principal buttons are at least 56 px, secondary controls at least 44 px and inputs at least 50 px. Panels use 20 px corners and a 1 px border. Main actions use 14 px corners.
- A 200 ms transition marks walkthrough step changes and feedback on controls. Reduced-motion preferences remove movement. The walkthrough shows example content and the workspace shows actual connection state. A recording or playback waveform belongs to the real voice implementation.

## Components

- The 32 px navbar mark and 48 px standalone mark use a J with a speech tail and a forward arrow. Both light and dark variants share the same paths. The App Router serves a matching SVG favicon.
- Original category SVGs depict voice, food, rides, location, wallet and receipts. Soft shading separates the silhouette from its tile. Lucide icons identify actions and fields.
- `ActionLink`, `Button`, `Panel` and `IndexLabel` share the same tokens across both routes. The walkthrough uses native buttons with a pressed state and announces step changes. The workspace uses labeled fields, inline validation, session history and a keyboard-operable integration disclosure.

## Verification

| Check | Result and evidence |
| --- | --- |
| Build and types | Pass. `npm run build`, `npm run typecheck` and `npm run lint` completed. |
| Responsive layouts | Pass. Chrome checked the homepage, workspace and example handoff at 375, 768, 1024 and 1440 px. Both pages stayed within the viewport width. Visual review confirmed the three-line desktop headline. |
| Font rendering | Pass. Chrome confirmed Bricolage Grotesque on the H1, Instrument Sans on body copy and both Noto families on saved Indic-script requests. |
| Navigation | Pass. The header and footer wordmarks open the homepage. Section links scroll to their destinations. Both Try Jugaad links and the header action open the workspace. The skip link focuses visibly and jumps to main content. |
| Walkthrough | Pass. Watch it work jumps to the walkthrough. Request, Compare, Approve and Receipt each open the matching content by keyboard. Use this example opens a prefilled draft. |
| Workspace | Pass. Load example populates the fields. Saving an empty request or invalid budget shows inline feedback. Saving valid food and ride requests adds them to history and filters the directory. Refresh clears history. The integration disclosure opens and closes by keyboard. |
| Accessible presentation | Pass. Axe reported zero violations in its WCAG A/AA scan on both routes at 375 and 1440 px. Key measured contrast ratios include 6.12:1 for ink on orange, 4.86:1 on the hover fill, 3.58:1 for the large headline accent over grid intersections and 4.02:1 for field boundaries on white. |
| Motion and console | Pass. The walkthrough was exercised with normal and reduced motion. The final Chrome run recorded no page errors, console errors or failed resource loads. |
| Prototype status | Pass. The walkthrough is labeled as sample content. The workspace shows the empty, pending and disconnected states. No AI, provider, payment or booking result is generated. |
