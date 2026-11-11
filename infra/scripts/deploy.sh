#!/usr/bin/env bash
set -euo pipefail

deploy() {
  local REPO_DIR="${REPO_DIR:-/opt/parsec}"
  cd "$REPO_DIR"
  git pull --ff-only
  cd infra
  bash scripts/db-allowlist.sh
  docker compose config --quiet
  docker compose build parsecback parsecclient
  # DB/Redis upgrades require their own backup procedure.
  docker compose up -d --no-deps parsecback parsecclient
  docker compose ps

}

# Parse the complete function before git pull can replace this script on disk.
deploy "$@"
