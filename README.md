# crockford timestamp - a date and a time in five characters

A crockford timestamp is a short code for a date and a time in UTC.
The timestamp `2026-06-29 08:04` has 16 characters.
The same time as a crockford timestamp is `66X82`.

This repository holds the specification of the format and the reference material.

## Description

Use the code in descriptions, annotations, labels, and comments.
It fits where a field has a short length limit.
It also fits where a full date makes the text cluttered.

The code is easy to read and to type.
Codes sort in time order inside one 32-year cycle.

## Format

The code has five characters, one for each field.
The field order is always year, month, day, hour, minute.
Each character comes from the Crockford Base32 alphabet, `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.
The alphabet has no `I`, `L`, `O`, or `U`.

| Field | Range | Value | Characters |
|---|---|---|---|
| Year | 0 to 31 | `(year - 2020) mod 32` | `0` to `Z` |
| Month | 1 to 12 | direct | `1` to `C` |
| Day | 1 to 31 | direct | `1` to `Z` |
| Hour | 0 to 23 | direct | `0` to `Q` |
| Minute | 0 to 59 | `minute div 2` | `0` to `X` |

Encode obeys these rules:

- Encode converts the input to UTC first.
- Encode rounds an odd minute down, because the resolution is 2 minutes.
- Encode ignores seconds and fractions of a second.
- Encode rejects a year before 2020 or after 3043.

A cycle has 32 years.
Cycle 0 is 2020 to 2051 and has no suffix.
Cycle 1 and later add the suffix `+N` after the code.
`N` is one character from `1` to `Z`, and `+0` is not valid.

Decode obeys these rules:

- Decode removes hyphens and whitespace, and accepts lowercase.
- Decode reads `I` and `L` as `1`, and `O` as `0`.
- Decode rejects `U`.
- Decode rejects a day that does not exist in that month and year.
- Decode returns the UTC start of the 2-minute interval.

Decode is deterministic.
It does not need a reference time.

## Files

`implementations/` holds one subdirectory for each implementation of the format.

`implementations/macos-clock/` holds two macOS apps that show the current UTC time as a crockford timestamp.
`CrockfordBar.swift` is a menu bar app.
`CrockfordClockApp.swift` is a split-flap clock.
To build the two apps, run `./build.sh` in that directory.
The build uses the Command Line Tools and does not need Xcode.

`implementations/gnome-shell-clock/` holds an extension for GNOME Shell 48 that shows the same time in the top bar.
To install the extension from the source, run `./install.sh` in that directory.
To build the archive of the extension, run `./build.sh` in that directory.

`implementations/web-clock/` holds a static web page with the flap clock and a converter between a date and a code.
The page is at https://scuq.github.io/crockford-timestamp/.
A link to one code has the form `https://scuq.github.io/crockford-timestamp/?code=66X82`, with `%2B` for a `+` in the code.
The page needs no build step, but a browser cannot load an ES module from a `file://` URL.
To preview the page, run this command in the repository root, then open `http://127.0.0.1:8000/`:

```
python3 -m http.server 8000 --bind 127.0.0.1 --directory implementations/web-clock
```

`.github/workflows/build.yml` builds the three implementations on GitHub.
It publishes the web page to GitHub Pages on each push to the branch `main`, and it publishes the releases on a tag.

## Releases

A release has a version of the form `X.Y.Z` from Semantic Versioning 2.0.0.
The web page is not part of a release.
It publishes again on each push to the branch `main` and has no version of its own.

To publish a release, push a tag of the form `vX.Y.Z`:

```
git tag v1.2.3
git push origin v1.2.3
```

A tag with a suffix, for example `v1.2.3-rc.1`, publishes a prerelease.
The apps and the extension of a prerelease have the version without the suffix.

Each release has these files:

| File | Contents |
|---|---|
| `CrockfordBar-macos-X.Y.Z.zip` | The menu bar app for macOS 13 and later |
| `CrockfordClock-macos-X.Y.Z.zip` | The split-flap clock for macOS 13 and later |
| `crockford-clock-gnome-shell-X.Y.Z.zip` | The extension for GNOME Shell 48 |
| `SHA256SUMS` | The SHA-256 checksums of the three archives |

The macOS apps are universal binaries for arm64 and x86_64.
They have an ad-hoc signature and no notarization from Apple.
Thus macOS blocks an app from a downloaded archive.
To start the app, remove the quarantine attribute first:

```
xattr -dr com.apple.quarantine CrockfordBar.app
```

To install the extension from the archive, run these commands.
Log out and log in again between the two commands.

```
gnome-extensions install --force crockford-clock-gnome-shell-1.2.3.zip
gnome-extensions enable crockford-clock@scuq.github.io
```

## Examples

| Input | Code | Decode result (UTC) |
|---|---|---|
| 2020-01-01T00:00:00Z | `01100` | 2020-01-01 00:00 |
| 2026-06-29T08:05:00Z | `66X82` | 2026-06-29 08:04 |
| 2026-06-29T10:05:00+02:00 | `66X82` | 2026-06-29 08:04 |
| 2026-01-01T00:30:00+01:00 | `5CZQF` | 2025-12-31 23:30 |
| 2031-10-10T23:59:59Z | `BAAQX` | 2031-10-10 23:58 |
| 2052-01-01T00:00:00Z | `01100+1` | 2052-01-01 00:00 |
| 2100-03-15T12:34:56Z | `G3FCH+2` | 2100-03-15 12:34 |
| 3043-12-31T23:59:59Z | `ZCZQX+Z` | 3043-12-31 23:58 |

Rows 2 and 3 give the same code, because encode removes the offset.
Row 4 shows a date change: local 1 January 2026 is 31 December 2025 in UTC.
Rows 1 and 6 have the same five characters, and the suffix `+1` makes them different.
Row 8 is the last supported time.

## Caveats

Encode is lossy.
You cannot get the seconds or an odd minute back from a code.

Codes sort in time order only inside one cycle.
Across cycles, decode the codes before you compare them.

The character `+` is not safe in a URL query string.
Write it as `%2B` there.

## See also

- Crockford Base32: https://www.crockford.com/base32.html
- Semantic Versioning 2.0.0: https://semver.org/spec/v2.0.0.html
