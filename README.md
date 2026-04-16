# BMADGraphWebApp

## Node Runtime Policy

This repo is expected to run under the Linux Node runtime managed by `nvm`.

- Use the version in [.nvmrc](/home/pin81845/repo/BMADGraphWebApp/.nvmrc).
- Prefer [`scripts/with-node.sh`](/home/pin81845/repo/BMADGraphWebApp/scripts/with-node.sh) for all Node-family commands when the shell environment is uncertain.
- Do not rely on Windows-backed `node`, `npm`, or `npx` paths from `/mnt/c/...` while working inside WSL.
- If native-binding errors appear after install, reinstall dependencies through the wrapper so Linux optional packages are selected correctly.
- Package lifecycle commands now fail fast when they start under Windows Node against the WSL checkout.

Examples:

```bash
./scripts/with-node.sh node -v
./scripts/with-node.sh npm install
./scripts/with-node.sh npm run build
./scripts/with-node.sh npm run test
```

For Codex or other agent-driven workflows, treat the wrapper as the default entrypoint for `node`, `npm`, `npx`, `vite`, `vitest`, `eslint`, `tsc`, and `playwright`.

If you see a runtime-guard failure, recover with:

```bash
./scripts/with-node.sh npm install
./scripts/with-node.sh npm run build
./scripts/with-node.sh npm run test
```
