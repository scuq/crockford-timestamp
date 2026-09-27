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

`implementations/crockford-clock/` holds two macOS apps that show the current UTC time as a crockford timestamp.
`CrockfordBar.swift` is a menu bar app.
`CrockfordClockApp.swift` is a split-flap clock.
To build the menu bar app, run `./build.sh` in that directory.
The build uses the Command Line Tools and does not need Xcode.

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
