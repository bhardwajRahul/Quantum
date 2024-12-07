#!/bin/bash
export DEBIAN_FRONTEND=noninteractive

print_message(){
    local message=$1
    echo -e "\n#########################"
    echo -e "# $message"
    echo -e "#########################\n"
    echo "Waiting 3 seconds..."
    sleep 3
}

print_message "Installing Docker & Docker Compose"

apt-get update
apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update

apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

print_message "Docker & Docker Compose installed successfully"
print_message "Building Quantum docker image..."

docker compose --build
docker compose up -d