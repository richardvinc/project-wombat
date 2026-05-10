#!/usr/bin/env bash

set -euo pipefail

ENV_FILE="${1:-.env.loadtest}"
KEEP_STACK="${KEEP_STACK:-true}"

ARTIFACTS_DIR="loadtest/artifacts"
NGINX_LOG_DIR="loadtest/logs/nginx"
MODSEC_LOG_DIR="loadtest/logs/modsecurity"
RUN_NAME="${LOADTEST_RUN_NAME:-$(date '+%Y-%m-%d %H-%M-%S')}"
RUN_ARTIFACTS_DIR="$ARTIFACTS_DIR/$RUN_NAME"

export LOADTEST_RUN_NAME="$RUN_NAME"

mkdir -p "$ARTIFACTS_DIR" "$RUN_ARTIFACTS_DIR" "$NGINX_LOG_DIR" "$MODSEC_LOG_DIR/audit/data"
find "$NGINX_LOG_DIR" -maxdepth 1 -type f -delete 2>/dev/null || true
find "$MODSEC_LOG_DIR" -type f -delete 2>/dev/null || true

if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$RUN_ARTIFACTS_DIR/.env.loadtest"
fi

docker compose --env-file "$ENV_FILE" -f docker-compose.loadtest.yml down -v --remove-orphans

cleanup() {
  if [[ "$KEEP_STACK" != "true" ]]; then
    docker compose --env-file "$ENV_FILE" -f docker-compose.loadtest.yml down -v --remove-orphans
  fi
}

trap cleanup EXIT

docker compose --env-file "$ENV_FILE" -f docker-compose.loadtest.yml up -d --build postgres redis api nginx waf

k6_exit_code=0
collector_exit_code=0

set +e
docker compose --env-file "$ENV_FILE" -f docker-compose.loadtest.yml up --build --no-deps --exit-code-from k6 k6
k6_exit_code=$?
set -e

set +e
docker compose --env-file "$ENV_FILE" -f docker-compose.loadtest.yml run --rm collector
collector_exit_code=$?
set -e

if [[ $collector_exit_code -ne 0 ]]; then
  exit $collector_exit_code
fi

exit $k6_exit_code
