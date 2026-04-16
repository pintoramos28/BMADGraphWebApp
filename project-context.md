---
project_name: 'BMADGraphWebApp'
user_name: 'Pinto'
date: '2026-04-16'
sections_completed: ['critical_implementation_rules']
existing_patterns_found: 1
---

# Project Context for AI Agents

_This file contains only the repo-local Node runtime rule needed to avoid WSL/Windows toolchain mismatches during agent execution._

---

## Critical Implementation Rules

### Node Runtime Policy

- This repo must use the Linux Node runtime from `nvm`, not Windows Node shims mounted into WSL.
- Before running Node-family commands, prefer [`scripts/with-node.sh`](/home/pin81845/repo/BMADGraphWebApp/scripts/with-node.sh) so the repo uses the version from [.nvmrc](/home/pin81845/repo/BMADGraphWebApp/.nvmrc).
- Treat the wrapper as the default entrypoint for `node`, `npm`, `npx`, `vite`, `vitest`, `eslint`, `tsc`, and `playwright`.
- If `node` or `npm` resolve to `/mnt/c/...`, stop using bare commands and switch to the wrapper immediately.
- Package lifecycle commands are guarded and should fail fast if they start under Windows Node against this WSL checkout.
- If native binding errors appear after install or build, reinstall dependencies through the wrapper so Linux optional packages are selected correctly.
