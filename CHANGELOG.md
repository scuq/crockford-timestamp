# Changelog

All notable changes to this repository are in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions in this file follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `implementations/gnome-shell-clock/`, an extension for GNOME Shell 48 that shows the current UTC time as a crockford timestamp in the top bar.
- Added `.github/workflows/build.yml`, a workflow that builds and tests the two implementations on a push to `main` and on a pull request.
- A tag of the form `vX.Y.Z` publishes a GitHub release with three archives and a `SHA256SUMS` file.
- A tag with a suffix, for example `v1.2.3-rc.1`, publishes a prerelease.
- Added a Releases section to `README.md` that gives the release procedure and the installation from the archives.
- Added `CLAUDE.md`, instructions for agents in this repository.
- Added `implementations/web-clock/`, a static web page with the flap clock and a converter between a date and a code, published at https://scuq.github.io/crockford-timestamp/.
- A link to one code on the page has the form `?code=CODE`, with `%2B` for a `+` in the code.
- Added the job `web` to `.github/workflows/build.yml` that compares the two codec copies and tests the page logic.
- The job `web` uploads the web page as a GitHub Pages artifact on a push to the branch `main`.
- Added the job `pages` to `.github/workflows/build.yml` that deploys the web page to GitHub Pages on a push to the branch `main`.

### Changed

- Renamed the directory `implementations/crockford-clock/` to `implementations/macos-clock/`.
- The macOS build script now builds `CrockfordClock.app` in addition to `CrockfordBar.app`.
- The macOS build script builds universal binaries for arm64 and x86_64, with the deployment target macOS 13.0.
- The macOS build script reads the version from the environment variable `VERSION`, with the default `0.0.0`.
- `.gitignore` ignores the build output in `implementations/macos-clock/` and the archive of the GNOME Shell extension.
- The job `release` in `.github/workflows/build.yml` now needs the job `web` too, so a release does not happen if the two codec copies differ.
