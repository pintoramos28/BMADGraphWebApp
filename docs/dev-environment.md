# Development Environment

This document defines the recommended local tool setup for BMADGraphWebApp and compares it to the workstation state observed on April 20, 2026.

## Goal

The environment should support:

- day-to-day React and Vite development
- unit, integration, and E2E testing
- agent-driven repo work inside WSL/Linux
- reproducible Node and browser automation behavior
- lightweight Python-based helper tooling when needed

## Target Workstation Spec

### Core runtime

- Linux or WSL2 Linux userland as the primary execution environment
- `nvm` or `fnm` installed and shell-initialized
- Node `24.11.0` active by default for this repo, matching [.nvmrc](/home/pin81845/repo/BMADGraphWebApp/.nvmrc)
- `npm` as the default package manager for this repo
- repo wrapper available for guarded execution: [`scripts/with-node.sh`](/home/pin81845/repo/BMADGraphWebApp/scripts/with-node.sh)
- repo-local direnv activation available through [.envrc](/home/pin81845/repo/BMADGraphWebApp/.envrc)

### Web development and testing

- Playwright installed with browser binaries available
- TypeScript toolchain available through the active Linux Node runtime
- `eslint`, `vite`, `vitest`, `tsc`, and `playwright` runnable either directly or through the wrapper
- modern Chromium available for Playwright-driven browser testing

### Python and agent utility layer

- Python `3.11` or `3.12`
- `uv` installed
- `pip` available for compatibility
- `pytest` installed globally or inside a standard local virtual environment
- local venv workflow for one-off agent and automation scripts

### CLI productivity tools

- `git`
- `gh`
- `jq`
- `rg`
- `fd`
- `sqlite3`
- `direnv`
- `tmux`
- `make` or `just`

### Optional but high-value tools

- Docker and `docker compose`
- `shellcheck`
- `tree`

## Repo Expectations

The repo is currently built around:

- Vite dev/build via [`package.json`](/home/pin81845/repo/BMADGraphWebApp/package.json)
- Vitest for unit and integration tests via [`vitest.config.ts`](/home/pin81845/repo/BMADGraphWebApp/vitest.config.ts)
- Playwright for browser E2E via [`playwright.config.ts`](/home/pin81845/repo/BMADGraphWebApp/playwright.config.ts)
- Linux Node from `nvm`, enforced by [`project-context.md`](/home/pin81845/repo/BMADGraphWebApp/project-context.md)

The repo explicitly does not want Windows-backed Node/npm shims against the WSL checkout.

## Current Workstation Snapshot

Observed on April 20, 2026 from `/home/pin81845/repo/BMADGraphWebApp`.

### Present and usable

- `python3` `3.12.3`
- `uv` `0.11.6`
- `git` `2.43.0`
- `jq` `1.7`
- `rg` `15.1.0`
- `tmux` present
- `~/.nvm/nvm.sh` present
- `node_modules` present

### Present, but not configured as the default path

- Linux Node works through the wrapper:
  - `bash ./scripts/with-node.sh node -v` -> `v24.11.0`
  - `bash ./scripts/with-node.sh npm -v` -> `11.6.1`
  - `bash ./scripts/with-node.sh npx playwright --version` -> `1.59.1`

### Missing or not currently available on PATH

- bare `node`
- `pnpm`
- `yarn`
- bare `python`
- `pip`
- `pytest`
- `playwright` as a bare global command
- `docker`
- `gh`
- `fd`
- `sqlite3`
- `make`
- `just`
- `direnv`

### Incorrect default resolution

- `npm` resolves to `/mnt/c/Program Files/nodejs/npm`
- `npx` resolves to `/mnt/c/Program Files/nodejs/npx`

This is the main ergonomics risk in the current setup.

### Repo-specific validation results

Through the Linux Node wrapper, the current repo is healthy:

- `bash ./scripts/with-node.sh npm run typecheck` passed
- `bash ./scripts/with-node.sh npm run test` passed
  - `24` files
  - `168` tests
- `bash ./scripts/with-node.sh npm run test:e2e` passed
  - `9` Playwright tests

## Gap Summary

### Green

- The repo itself is install-complete and testable.
- The pinned Linux Node version is available.
- Playwright browser execution works.
- Python is present for future agent-side tooling.

### Yellow

- The shell defaults are unsafe for Node-family commands because Windows npm/npx win path precedence.
- The repo wrapper is not executable, so it currently requires `bash ./scripts/with-node.sh ...`.
- Python utility tooling is only partially provisioned.

### Red

- The default shell is not yet a clean “use the repo normally without thinking about it” environment.
- Several common CLI tools for agentic workflows are absent.

## Applied Remediation

Applied on April 20, 2026 without Docker changes.

- updated `~/.profile` so login shells load `nvm` and activate the default Linux Node alias
- updated `~/.bashrc` to load the `direnv` hook when available
- added [.envrc](/home/pin81845/repo/BMADGraphWebApp/.envrc) so the repo auto-selects the pinned Node runtime through `direnv`
- made [`scripts/with-node.sh`](/home/pin81845/repo/BMADGraphWebApp/scripts/with-node.sh) executable
- installed user-space CLI tools in `~/.local/bin`:
  - `pip`
  - `pytest`
  - `gh`
  - `fd`
  - `sqlite3`
  - `direnv`
  - `just`

## Post-Remediation Verification

Verified after the fixes:

- `bash -lc 'command -v node npm npx'` resolves to Linux `nvm` paths
- `node -v` -> `v24.11.0`
- `npm -v` -> `11.6.1`
- `npx playwright --version` -> `1.59.1`
- `pip --version` -> `26.0.1`
- `pytest --version` -> `9.0.3`
- `gh --version` -> `2.90.0`
- `fd --version` -> `10.4.2`
- `sqlite3 --version` -> `3.53.0`
- `direnv --version` -> `2.37.1`
- `just --version` -> `1.50.0`
- `direnv exec . ...` loads [.envrc](/home/pin81845/repo/BMADGraphWebApp/.envrc) and resolves the pinned Linux Node runtime
- `./scripts/with-node.sh npm run test` passes

## Priority Remediation Checklist

### Priority 1: Fix runtime defaults

1. Initialize `nvm` in shell startup so Linux Node is on PATH by default.
2. Ensure `node`, `npm`, and `npx` resolve to Linux paths, not `/mnt/c/...`.
3. Make [`scripts/with-node.sh`](/home/pin81845/repo/BMADGraphWebApp/scripts/with-node.sh) executable.
4. Keep using the wrapper for automation and agent runs even after shell init, because it enforces the pinned repo runtime.

### Priority 2: Complete the Python utility layer

1. Ensure `pip` is available for `python3`.
2. Install `pytest`.
3. Standardize on `uv venv` for disposable local helper environments.

### Priority 3: Add missing CLI tooling

1. Install `gh`.
2. Install `fd`.
3. Install `sqlite3`.
4. Install `direnv`.
5. Install either `make` or `just`.

### Priority 4: Add optional container support

1. Install Docker.
2. Install `docker compose`.

## Recommended Command Baseline

After remediation, these should work from the shell without ambiguity:

```bash
node -v
npm -v
npx playwright --version
python3 --version
uv --version
pytest --version
gh --version
fd --version
sqlite3 --version
```

These repo commands should remain green:

```bash
bash ./scripts/with-node.sh npm run typecheck
bash ./scripts/with-node.sh npm run test
bash ./scripts/with-node.sh npm run test:e2e
```

## Short Recommendation

For BMADGraphWebApp, the ideal environment is not larger than the current one. It is mostly the current environment with three fixes:

- make Linux Node the default instead of Windows shims
- finish the lightweight Python tool layer
- add a small set of missing CLI tools for agent productivity

That gets the workstation from "works when handled carefully" to "safe and efficient by default."
