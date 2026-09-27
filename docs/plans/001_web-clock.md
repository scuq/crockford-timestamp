# Plan: web clock and converter on GitHub Pages

## Context

The repository has three implementations of the crockford timestamp: two macOS apps and a GNOME Shell extension.
All three are clocks. No converter exists.
The user wants a public web page with the clock and a converter, hosted at no cost.

GitHub Pages is free for a public repository on a free account.
`scuq/crockford-timestamp` is public, and Pages is not enabled at this time.
The URL will be `https://scuq.github.io/crockford-timestamp/`.

`implementations/gnome-shell-clock/codec.js` is pure ECMAScript with no imports.
A browser can load it as an ES module with no change, thus the page needs no server, no framework, and no build tool.

## Decisions of the user

| Subject | Decision |
|---|---|
| Codec | The web implementation has its own copy of `codec.js`. The workflow compares it with the GNOME copy and fails if they are different. |
| Layout | One page: the flap clock at the top, the converter below. |
| Converter | Date and time to code, code to date and time, a link `?code=`, and copy buttons. |
| Deploy | Each push to `main`, only after the tests pass. |

## New files

Directory: `implementations/web-clock/`

| File | Contents |
|---|---|
| `index.html` | The page. Loads `clock.js` and `converter.js` with `<script type="module">`. Relative paths only, because the site is a project site. |
| `style.css` | Sizes, two palettes, responsive scaling, flip animation. |
| `codec.js` | Made with `cp ../gnome-shell-clock/codec.js codec.js`. Nobody edits it. |
| `logic.js` | Pure functions with no DOM. Imports `./codec.js`. |
| `copy.js` | The copy function that `clock.js` and `converter.js` share. |
| `clock.js` | DOM code of the clock. |
| `converter.js` | DOM code of the converter. |
| `test.js` | GJS test of `logic.js`, in the style of `implementations/gnome-shell-clock/test.js`. |

## Reuse

- `encode`, `decode`, `valueOf`, `ALPHABET`, `EPOCH`, `CYCLE_YEARS`, `CodecError` from `codec.js`.
- The update logic of `_update()` in `implementations/gnome-shell-clock/extension.js`: code, interval start, progress, `next flip in M:SS`.
- The function `hint()` and the constants `CAPTIONS`, `INTERVAL`, `FLIP_TIME` from `extension.js` (lines 20-66), moved to `logic.js` with the same texts.
- The sizes from `implementations/gnome-shell-clock/layout.css` and the colors from `stylesheet-dark.css` and `stylesheet-light.css`.

## Page design

### Clock section

- Six flap tiles with the captions `year`, `month`, `day`, `hour`, `2 min`, `cycle`. The cycle tile is hidden when the code has no suffix.
- A progress bar for the 2-minute interval.
- The learning aid: the alphabet ruler with 32 characters and the hint line.
- A footer with `YYYY-MM-DD HH:MM UTC`, `HH:MM–HH:MM local`, and `next flip in M:SS`.
- A button `Copy <code>`.

### Theme

- CSS custom properties on `:root` hold the light palette. `@media (prefers-color-scheme: dark)` overrides them.
- No manual toggle.
- The GNOME dark theme takes three values from the shell. The page uses: background `#060518`, signal `#f0a508`, buttons `#131a54` with text `#f0a508`.

### Responsive scaling

- `.clock` has `container-type: inline-size`. `main` has `max-width: 530px`.
- One design pixel is a length: `--s: min(1px, calc(100cqi / var(--ref)))`, with `--ref: 420` for five tiles and `530` for six tiles.
- The flap, the glyph, the gap, the radius, and the hinge use `calc(N * var(--s))`. The page fits a screen of 320 px.
- The ruler is a grid of 32 columns, and of 16 columns in a narrow container.

### Access

- Each flap is a `<button type="button" aria-pressed>`. Hover, focus, and tap show the hint. `Escape` clears a pinned flap.
- The idle hint is `Hover or tap a flap to decode it.`
- `@media (prefers-reduced-motion: reduce)` stops the flip animation.
- The clock has no live region, so a screen reader does not speak each second.
- Live regions are the status line of the copy buttons and the two result containers of the converter. The status line is visible, a small message at the bottom of the page, not visually hidden.

## Clock logic (`clock.js`)

- A `setTimeout` aligned to the second: delay `1000 - Date.now() % 1000 + 10`, armed again after each update.
- On `visibilitychange`: stop the timer when the page is hidden, update and start again when it is visible.
- Flip: `@keyframes flip { from { transform: translateY(-50%); opacity: 0 } }`, 350 ms, ease-in-out. No animation on the first render.
- Month names: `Intl.DateTimeFormat('en', {month: 'long', timeZone: 'UTC'})`. The page is English, and the test is deterministic.
- The clock shows the time of the device of the visitor.

## Converter logic (`converter.js`, `logic.js`)

### Exports of `logic.js`

`INTERVAL`, `CYCLE`, `CAPTIONS`, `pad`, `describe`, `hintText`, `hintLabel`, `breakdown(code)`, `canonical(input)`, `interval(code)`, `clockState(now)`, `timeUtc`, `timeLocal`, `formatUtc`, `formatLocal`, `zoneName`, `formatIso`, `formatUtcInterval`, `formatLocalInterval`, `parseDateTimeInput(value, zone)`, `formatDateTimeInput(date, zone)`, `codeFromSearch(search)`, `linkFor(code, base)`.

### Date and time to code

- Inputs: `<input type="datetime-local">`, two radio buttons `UTC` and `local`, and a button `Now`.
- `parseDateTimeInput` reads the text with a regular expression, then uses `Date.UTC(...)` or `new Date(y, m-1, d, h, mi)`.
- `min` and `max` are hints only. `encode` decides, and the page shows its message.
- Output: the code, and the interval that the code represents, for example `2026-06-29 08:04–08:06 UTC`.

### Code to date and time

- Input: a text field, converted on each `input` event.
- Output:
  - the UTC interval
  - the local interval with the zone name
  - the ISO 8601 string
  - the canonical code
  - one hint line for each character
- An invalid code shows the message of `CodecError` with no change.

### Link

- The link has the form `?code=66X82#converter`.
- `URLSearchParams` changes a raw `+` to a space, and `decode` then gives `invalid length`.
- `codeFromSearch` thus parses the raw `location.search` and uses `decodeURIComponent`. `G3FCH%2B2` and a raw `G3FCH+2` give the same result.
- `linkFor` always writes `%2B`.

### Copy buttons

- `navigator.clipboard.writeText`. If it is not available, the page selects the text and shows `Press Ctrl+C to copy.`

## Tests

- `cmp implementations/gnome-shell-clock/codec.js implementations/web-clock/codec.js` makes the GNOME codec tests valid for the web copy.
- `implementations/web-clock/test.js` runs with `TZ=Europe/Vienna gjs -m test.js`. It tests `codeFromSearch`, `parseDateTimeInput` (README rows 3 and 4), `formatDateTimeInput`, `hintText`, and `interval`.
- No DOM tests.

## Workflow

Change `.github/workflows/build.yml`. A separate workflow file would need a second copy of the tests.

1. Add the job `web` on `ubuntu-latest`:
   - `actions/checkout@v7`
   - `cmp` of the two codec copies
   - Install `gjs`, then `TZ=Europe/Vienna gjs -m test.js` in `implementations/web-clock`
   - Copy `index.html style.css codec.js logic.js copy.js clock.js converter.js` to `$RUNNER_TEMP/site`
   - `actions/upload-pages-artifact@v5` with `path: ${{ runner.temp }}/site`, with the condition `github.event_name == 'push' && github.ref == 'refs/heads/main'`
2. Add the job `pages`:
   - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
   - `needs: [gnome-shell, web]`
   - `permissions: pages: write, id-token: write`
   - `environment: github-pages`, with `url: ${{ steps.deployment.outputs.page_url }}`
   - `concurrency: group: pages, cancel-in-progress: false`
   - Steps: `actions/configure-pages@v6`, then `actions/deploy-pages@v5` with `id: deployment`
3. Change the job `release` to `needs: [version, macos, gnome-shell, web]`, so that no release occurs when the codec copies are different.

The upload condition keeps the site artifact out of a tag build.
The job `release` downloads all artifacts with `merge-multiple: true`, and the site archive must not go into `dist`.

The action versions come from the GitHub API: `configure-pages` v6, `upload-pages-artifact` v5, `deploy-pages` v5.
Examine them again before the first run, because nobody ran this combination.

## Order of steps

Obey the procedure in `CLAUDE.md`: code first with no new comments, then the `scuq-scraibe` agent.
Make a commit only when the user asks. Do not make a tag.

1. The `scuq-scraibe` agent writes this plan to `docs/plans/001_web-clock.md`.
2. Make `implementations/web-clock/codec.js` with `cp`. Run `cmp` and `gjs -m test.js`.
3. Write `logic.js` and `test.js`. Run the test.
4. Write `index.html`, `style.css`, `clock.js`, `converter.js`.
5. Change `.github/workflows/build.yml`.
6. Start the `scuq-scraibe` agent for:
   - the comments in the new files, but not in `codec.js`
   - the comments and the header of `build.yml`
   - `README.md`: the Files section and the link to the page
   - `CLAUDE.md`: the Codec section with four files and the `cmp` rule, the Files section, the Build and test table
   - `CHANGELOG.md`
7. Ask the user for confirmation, then enable Pages. This step has an effect outside the repository.
   - Manual: Settings, Pages, Build and deployment, Source: GitHub Actions
   - CLI: `gh api -X POST repos/scuq/crockford-timestamp/pages -f build_type=workflow`
8. Optional, after confirmation: `gh repo edit scuq/crockford-timestamp --homepage https://scuq.github.io/crockford-timestamp/`

The working tree has changes that are not committed: the GNOME implementation, the rename to `macos-clock`, `.github/`, `CHANGELOG.md`, `CLAUDE.md`.
The web work also changes `README.md`, `CLAUDE.md`, `CHANGELOG.md`, and `build.yml`.
If the user asks for commits, commit the pending work first.
Code and documentation go into different commits.

## Verification

### Local

- `gjs -m test.js` in `implementations/gnome-shell-clock` and in `implementations/web-clock`.
- `cmp` of the two codec copies.
- `python3 -m http.server 8000 --bind 127.0.0.1 --directory implementations/web-clock`, then open `http://127.0.0.1:8000/`.
- All eight rows of the README examples, in the two directions of the converter.
- `?code=66X82`, `?code=G3FCH%2B2`, and a raw `?code=G3FCH+2`.
- `66U82` gives `invalid character: U`. `62Z00` gives `invalid value: the day does not exist`.
- The years 2019 and 3044 give `year out of range`.
- Light and dark theme, a width of 320 px with five and six tiles, reduced motion, keyboard only, copy buttons.

### Remote

- A pull request runs `web` and does not run `pages`.
- A push to `main` deploys the page.
- Open `https://scuq.github.io/crockford-timestamp/?code=G3FCH%2B2`.

The macOS apps do not change, thus no macOS build is necessary for this work.

## Limits

- Pages on a free account needs a public repository. The page is public.
- The soft limits are 1 GB for the site, 100 GB of traffic each month, and 10 builds each hour. This page is far below them.
- The `cmp` check guards the two JavaScript copies only. The two Swift copies stay a manual task.
- Container query units need a browser from 2023 or later.
