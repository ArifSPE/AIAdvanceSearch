#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.platform"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"

cd "$ROOT_DIR"

usage() {
  printf 'Usage: %s {start|stop|status}\n' "$(basename "$0")"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$1" >&2
    return 1
  fi
}

is_pid_running() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null
}

http_is_up() {
  curl --silent --show-error --fail --max-time 2 --output /dev/null "$1" 2>/dev/null
}

port_is_listening() {
  local port="$1"
  command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

start_process() {
  local name="$1"
  local port="$2"
  local health_url="$3"
  shift 3

  local pid_file="$PID_DIR/$name.pid"
  local pid=''
  if [[ -f "$pid_file" ]]; then
    pid="$(<"$pid_file")"
    if is_pid_running "$pid"; then
      printf '%s: already running (pid %s)\n' "$name" "$pid"
      return 0
    fi
    rm -f "$pid_file"
  fi

  if http_is_up "$health_url"; then
    printf '%s: already responding on port %s (not managed by this script)\n' "$name" "$port"
    return 0
  fi

  if port_is_listening "$port"; then
    printf '%s: port %s is occupied, but its health check failed; not starting a duplicate\n' \
      "$name" "$port" >&2
    return 1
  fi

  nohup "$@" >>"$LOG_DIR/$name.log" 2>&1 </dev/null &
  pid=$!
  printf '%s\n' "$pid" >"$pid_file"
  printf '%s: starting (pid %s, log %s)\n' "$name" "$pid" "$LOG_DIR/$name.log"
}

start_platform() {
  require_command docker
  require_command pnpm
  require_command curl
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    printf 'Missing %s/.env. Copy .env.example to .env and configure it first.\n' "$ROOT_DIR" >&2
    return 1
  fi

  mkdir -p "$PID_DIR" "$LOG_DIR"
  docker compose up -d --wait

  start_process api 4000 http://localhost:4000/api/v1/health pnpm dev:api
  start_process web 3000 http://localhost:3000/login pnpm dev:web
  printf '\nPlatform start requested. Run "%s status" to check readiness.\n' "$0"
}

stop_process() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  local pid=''

  if [[ ! -f "$pid_file" ]]; then
    printf '%s: not managed by this script\n' "$name"
    return 0
  fi

  pid="$(<"$pid_file")"
  if is_pid_running "$pid"; then
    kill -TERM "$pid"
    printf '%s: stop signal sent (pid %s)\n' "$name" "$pid"
  else
    printf '%s: stale PID file removed\n' "$name"
  fi
  rm -f "$pid_file"
}

stop_platform() {
  stop_process web
  stop_process api
  docker compose stop
}

check_service() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf '%-18s healthy\n' "$label"
    return 0
  fi
  printf '%-18s down\n' "$label"
  return 1
}

status_platform() {
  local failures=0
  require_command docker
  require_command curl

  check_service 'Application DB' docker compose exec -T postgres pg_isready -U ais -d ais_dev || failures=1
  check_service 'Metadata DB' docker compose exec -T metadata-postgres pg_isready -U ais -d ais_metadata || failures=1
  check_service 'API' http_is_up http://localhost:4000/api/v1/health || failures=1
  check_service 'API readiness' http_is_up http://localhost:4000/api/v1/ready || failures=1
  check_service 'Web' http_is_up http://localhost:3000/login || failures=1

  printf '\nLogs: %s/logs\n' "$STATE_DIR"
  return "$failures"
}

case "${1:-}" in
  start)
    start_platform
    ;;
  stop)
    stop_platform
    ;;
  status)
    status_platform
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac