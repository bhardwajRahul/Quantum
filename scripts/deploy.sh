#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
EXAMPLE_FILE="$ROOT/.env.example"

usage(){
    cat <<'USAGE'
Quantum — one-command deploy.

  bash scripts/deploy.sh              local install on localhost
  bash scripts/deploy.sh --public     URLs on this machine's public IP
  bash scripts/deploy.sh --host quantum.example.com
  bash scripts/deploy.sh --no-build   start without rebuilding the images

Creates .env from .env.example on first run and fills in every secret with a
freshly generated random value. Existing values are never overwritten, so
re-running is safe and is also how you apply an update.
USAGE
}

MODE=local
HOST_OVERRIDE=""
SKIP_BUILD=false

while [ $# -gt 0 ]; do
    case "$1" in
        --local)  MODE=local ;;
        --public) MODE=public ;;
        --host)   MODE=host; HOST_OVERRIDE="${2:-}"; shift ;;
        --no-build) SKIP_BUILD=true ;;
        -h|--help) usage; exit 0 ;;
        *) echo "deploy.sh: unknown option '$1' (try --help)" >&2; exit 64 ;;
    esac
    shift
done

say(){ printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn(){ printf '\033[33m    ! %s\033[0m\n' "$1"; }
die(){ printf '\033[31m    x %s\033[0m\n' "$1" >&2; exit 1; }

say 'Checking prerequisites'

command -v docker >/dev/null 2>&1 \
    || die "Docker is not installed. Run: bash scripts/install_docker.sh"

docker compose version >/dev/null 2>&1 \
    || die "The Docker Compose plugin is missing. Run: bash scripts/install_docker.sh"

docker info >/dev/null 2>&1 \
    || die "Cannot talk to the Docker daemon. Start it, or re-run with sudo."

echo "    docker $(docker version --format '{{.Server.Version}}'), compose $(docker compose version --short)"

rand_hex(){
    local bytes="$1"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$bytes"
    else
        od -An -tx1 -N "$bytes" /dev/urandom | tr -d ' \n'
    fi
}

env_value(){
    [ -f "$ENV_FILE" ] || return 0
    sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" | tail -n 1
}

set_env(){
    local key="$1" value="$2"
    if grep -qE "^[[:space:]]*$key[[:space:]]*=" "$ENV_FILE"; then
        local escaped="${value//\\/\\\\}"
        escaped="${escaped//&/\\&}"
        escaped="${escaped//\//\\/}"
        sed -i "s/^[[:space:]]*$key[[:space:]]*=.*/$key=$escaped/" "$ENV_FILE"
    else
        printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
    fi
}

set_env_if_empty(){
    local key="$1" value="$2"
    [ -n "$(env_value "$key")" ] && return 0
    set_env "$key" "$value"
    echo "    generated $key"
}

say 'Preparing .env'

if [ ! -f "$ENV_FILE" ]; then
    [ -f "$EXAMPLE_FILE" ] || die ".env.example is missing; cannot bootstrap .env"
    cp "$EXAMPLE_FILE" "$ENV_FILE"
    echo "    created .env from .env.example"
else
    echo "    reusing the existing .env (values already set are kept)"
fi

set_env_if_empty SECRET_KEY        "$(rand_hex 32)"
set_env_if_empty ENCRYPTION_KEY    "$(rand_hex 32)"
set_env_if_empty POSTGRES_PASSWORD "$(rand_hex 16)"
set_env_if_empty POSTGRES_USER     quantum

case "$MODE" in
    local)  PUBLIC_HOST=localhost ;;
    public)
        PUBLIC_HOST="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
        [ -n "$PUBLIC_HOST" ] || die "Could not detect the public IP. Use --host <ip-or-domain>."
        echo "    detected public IP $PUBLIC_HOST"
        ;;
    host)
        [ -n "$HOST_OVERRIDE" ] || die "--host needs a value, e.g. --host quantum.example.com"
        PUBLIC_HOST="$HOST_OVERRIDE"
        ;;
esac

SERVER_PORT="$(env_value SERVER_PORT)";           SERVER_PORT="${SERVER_PORT:-7080}"
CLIENT_PORT="$(env_value CLIENT_WEB_APP_PORT)";   CLIENT_PORT="${CLIENT_PORT:-5050}"

set_env_if_empty SERVER_PORT         "$SERVER_PORT"
set_env_if_empty CLIENT_WEB_APP_PORT "$CLIENT_PORT"

set_env_if_empty SERVER_IP 0.0.0.0

if [ "$MODE" = local ]; then
    set_env_if_empty DOMAIN      "http://$PUBLIC_HOST:$SERVER_PORT"
    set_env_if_empty CLIENT_HOST "http://$PUBLIC_HOST:$CLIENT_PORT"
else
    set_env DOMAIN      "http://$PUBLIC_HOST:$SERVER_PORT"
    set_env CLIENT_HOST "http://$PUBLIC_HOST:$CLIENT_PORT"
    echo "    set DOMAIN=http://$PUBLIC_HOST:$SERVER_PORT and CLIENT_HOST=http://$PUBLIC_HOST:$CLIENT_PORT"
    warn "DOMAIN is compiled into the frontend bundle — the web image is rebuilt below."
fi

if [ -z "$(env_value GITHUB_CLIENT_ID)" ]; then
    warn "GITHUB_CLIENT_ID/SECRET are empty — repository deploys stay disabled."
    warn "Add them to .env later and re-run this script. See the README."
fi

say 'Starting the stack'

if [ "$SKIP_BUILD" = true ]; then
    docker compose up -d --remove-orphans
else
    docker compose up -d --build --remove-orphans
fi

say 'Waiting for the server to become healthy'

API_URL="http://127.0.0.1:$SERVER_PORT/server/health"
for _ in $(seq 1 60); do
    if curl -sS -o /dev/null --max-time 3 "$API_URL" 2>/dev/null; then
        READY=true; break
    fi
    sleep 3
done

if [ "${READY:-false}" != true ]; then
    warn "The server did not answer on $API_URL within ~3 minutes."
    warn "Inspect the logs with: docker compose logs -f api"
    exit 1
fi

CLIENT_URL="http://$PUBLIC_HOST:$CLIENT_PORT"

cat <<EOF

$(printf '\033[32m')Quantum is up.$(printf '\033[0m')

  Web app   $CLIENT_URL
  API       http://$PUBLIC_HOST:$SERVER_PORT

Self-signup is open by default, so create your account through the web app,
then lock signups down by setting REGISTRATION_DISABLED=true in .env and
running: docker compose up -d --build api

Useful commands:

  docker compose logs -f api        follow the API logs
  docker compose ps                 service status
  docker compose down               stop the stack (data is preserved)
  bash scripts/deploy.sh            re-run to apply an update

EOF
