# CLAUDE.md - instructions for agents in this repository

## Description

This repository holds the specification of the crockford timestamp and its implementations.
`README.md` holds the specification of the format.
Each implementation has its own copy of the codec.

## Documentation and comments

Use the `scuq-scraibe` agent for all documentation and for all comments.
Do not write or change these texts yourself.
The rule applies to these texts:

- Each `.md` file, which includes `README.md`, this file, `CHANGELOG.md`, and the files in `docs/`
- Header comments and doc comments in source files and scripts
- Inline comments in source files, scripts, and workflow files

Obey this procedure:

1. Write the code first, with no new comments.
2. Start the `scuq-scraibe` agent.
3. Tell the agent which files changed and what the code does.
4. Let the agent write the comments and the documentation.

If a code change makes a text incorrect, start the agent before you complete the task.
If the user asks only for a text, start the agent immediately.
Do not put a documentation change and a code change in the same commit.

## Files

- `README.md`: the specification of the format and the release procedure
- `CHANGELOG.md`: the log of changes to this repository
- `implementations/macos-clock/`: two macOS apps in Swift
- `implementations/gnome-shell-clock/`: an extension for GNOME Shell 48
- `implementations/web-clock/`: a static web page with the flap clock and a converter, published on GitHub Pages
- `.github/workflows/build.yml`: the build, the release, and the deployment of the web page on GitHub
- `docs/decisions/`: the decisions for this repository
- `docs/plans/`: the plans for this repository

## Codec

The codec exists in four files:

- `implementations/macos-clock/CrockfordBar.swift`
- `implementations/macos-clock/CrockfordClockApp.swift`
- `implementations/gnome-shell-clock/codec.js`
- `implementations/web-clock/codec.js`

If you change the codec in one file, make the same change in the other three files.
If you change the format, change the specification and the examples in `README.md` also.
The test cases in `implementations/gnome-shell-clock/test.js` must agree with the examples in `README.md`.

`implementations/web-clock/codec.js` is a byte-identical copy of `implementations/gnome-shell-clock/codec.js`.
Make it with `cp implementations/gnome-shell-clock/codec.js implementations/web-clock/codec.js`.
Do not edit it directly, and do not add or change a comment in it.
The workflow fails the build when the two files are different.

## Build and test

Run each command in the directory of the implementation.

| Directory | Command | Result |
|---|---|---|
| `gnome-shell-clock` | `gjs -m test.js` | Tests the codec |
| `gnome-shell-clock` | `./install.sh` | Installs the extension for the current user |
| `gnome-shell-clock` | `./build.sh` | Builds the archive of the extension |
| `web-clock` | `TZ=Europe/Vienna gjs -m test.js` | Tests the page logic |
| repository root | `python3 -m http.server 8000 --bind 127.0.0.1 --directory implementations/web-clock` | Previews the page at `http://127.0.0.1:8000/` |
| `macos-clock` | `./build.sh` | Builds the two apps, on macOS only |

After each change to `codec.js`, run `gjs -m test.js` in `gnome-shell-clock`.
After each change to a file in `implementations/web-clock/`, run `TZ=Europe/Vienna gjs -m test.js` in that directory.
The Swift code does not compile on Linux.
If you cannot build the macOS apps, tell the user that you did not test them.

## Changelog

A `CHANGELOG.md` entry must exist for every change to this repository.
This includes an internal change with no visible effect on the format or the apps.
Each entry is short and precise.
Use the Keep a Changelog format, with `## [Unreleased]` at the top.
The `scuq-scraibe` agent writes the `CHANGELOG.md` entry.

## Plans and decisions

A new decision goes to `docs/decisions/`, as a `.md` file.
A new plan goes to `docs/plans/`, as a `.md` file.

Plan mode writes a temporary plan file outside this repository.
That plan must always go to `docs/plans/`.
The plan filename has a three-digit number, an underscore, and a short name: `001_release-pipeline.md`.
The number is the highest number in `docs/plans/` plus one.
The first plan has the number `001`.

The `scuq-scraibe` agent writes the plan file and the decision file.

## Releases

The version comes from the git tag and has the form `X.Y.Z` from Semantic Versioning 2.0.0.
Do not write a version into a source file.
The build scripts read the version from the environment variable `VERSION`.
Do not create a tag or push a tag unless the user tells you to.
