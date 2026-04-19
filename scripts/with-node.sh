#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "Expected nvm at $NVM_DIR/nvm.sh, but it was not found." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

if [[ -f "$repo_root/.nvmrc" ]]; then
  requested_node_version="$(tr -d '[:space:]' < "$repo_root/.nvmrc")"
else
  requested_node_version="24"
fi

if ! nvm use --silent "$requested_node_version" >/dev/null 2>&1; then
  if ! nvm install "$requested_node_version" >/dev/null; then
    echo "Unable to provision Linux Node $requested_node_version through nvm." >&2
    exit 1
  fi
fi

resolved_node="$(command -v node || true)"
resolved_npm="$(command -v npm || true)"

if [[ -z "$resolved_node" || -z "$resolved_npm" ]]; then
  echo "Expected node and npm after loading nvm, but one or both were unavailable." >&2
  exit 1
fi

case "$resolved_node:$resolved_npm" in
  /mnt/c/*:*|*:/mnt/c/*)
    echo "Refusing to use Windows-backed Node/npm from WSL: node=$resolved_node npm=$resolved_npm" >&2
    exit 1
    ;;
esac

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 1
fi

exec "$@"
