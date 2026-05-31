#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/JiaoTangXQ/JiaoTangXQ.github.io.git}"
BRANCH="${BRANCH:-server}"
APP_DIR="${APP_DIR:-/opt/jiaotang-planet}"
WEB_ROOT="${WEB_ROOT:-/var/www/jiaotang-planet}"
SITE_URL="${SITE_URL:-http://121.40.108.230}"
NGINX_CONF="/etc/nginx/sites-available/jiaotang-planet.conf"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must run as root." >&2
  exit 1
fi

install_base_packages() {
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git nginx rsync
}

install_node_if_needed() {
  if command -v node >/dev/null 2>&1; then
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" -ge 20 ]; then
      return
    fi
  fi

  if DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs npm; then
    return
  fi

  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
}

checkout_repo() {
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin "$BRANCH"
  else
    rm -rf "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi

  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
}

build_site() {
  cd "$APP_DIR"
  npm ci
  SITE_URL="$SITE_URL" npm run build:server
}

publish_site() {
  install -d "$WEB_ROOT"
  rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"
}

configure_nginx() {
  escaped_root="$(printf '%s\n' "$WEB_ROOT" | sed 's/[&/\]/\\&/g')"
  sed "s#/var/www/jiaotang-planet#$escaped_root#g" \
    "$APP_DIR/deploy/nginx/jiaotang-planet.conf" > "$NGINX_CONF"
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/jiaotang-planet.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

install_base_packages
install_node_if_needed
checkout_repo
build_site
publish_site
configure_nginx

echo "Deployed $BRANCH to $WEB_ROOT with SITE_URL=$SITE_URL"
