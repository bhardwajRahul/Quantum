#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Docker $(docker version --format '{{.Client.Version}}') and the Compose plugin are already installed."
    exit 0
fi

if [ "$(uname -s)" = "Darwin" ]; then
    echo "On macOS install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/"
    exit 1
fi

if [ "$(uname -s)" != "Linux" ]; then
    echo "Unsupported platform: $(uname -s). See https://docs.docker.com/engine/install/"
    exit 1
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    command -v sudo >/dev/null 2>&1 || { echo "Run this as root, or install sudo."; exit 1; }
    SUDO=sudo
fi

SCRIPT="$(mktemp)"
trap 'rm -f "$SCRIPT"' EXIT

echo "Downloading the official installer to $SCRIPT ..."
curl -fsSL https://get.docker.com -o "$SCRIPT"

echo "Running it (this installs docker-ce, the CLI, containerd and the compose plugin)..."
$SUDO sh "$SCRIPT"

$SUDO systemctl enable --now docker 2>/dev/null || true

echo
echo "Docker installed. To use it without sudo, add yourself to the docker group"
echo "and start a new login session:"
echo
echo "    $SUDO usermod -aG docker \$USER"
echo
echo "Then deploy Quantum with: bash scripts/deploy.sh"
