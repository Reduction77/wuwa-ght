#!/usr/bin/env bash

# 鸣潮托管站服务器一键更新脚本
# 使用：bash update-server.sh
# 强制全量重建：bash update-server.sh --no-cache

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

NO_CACHE=0
if [[ "${1:-}" == "--no-cache" ]]; then
  NO_CACHE=1
elif [[ -n "${1:-}" ]]; then
  printf '不支持的参数：%s\n用法：bash update-server.sh [--no-cache]\n' "$1" >&2
  exit 2
fi

if [[ "$EUID" -eq 0 ]]; then
  DOCKER=(docker)
else
  command -v sudo >/dev/null 2>&1 || { echo '缺少 sudo，请使用 root 运行或先安装 sudo。' >&2; exit 1; }
  DOCKER=(sudo docker)
fi

COMPOSE=("${DOCKER[@]}" compose -f docker-compose.yml)
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/wuwa-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"
BACKUP_ARCHIVE=""
HEALTH_FILE="$(mktemp)"
PREVIOUS_COMMIT="$(git rev-parse HEAD 2>/dev/null || true)"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m更新失败：%s\033[0m\n' "$*" >&2; exit 1; }

on_error() {
  local code=$?
  printf '\n\033[1;31m更新在第 %s 行失败，退出码 %s。\033[0m\n' "${BASH_LINENO[0]:-未知}" "$code" >&2
  if "${DOCKER[@]}" inspect wuwa-ght >/dev/null 2>&1; then
    printf '\n最近容器日志：\n' >&2
    "${DOCKER[@]}" logs --tail=80 wuwa-ght >&2 || true
  fi
  if [[ -n "$PREVIOUS_COMMIT" ]]; then
    printf '\n更新前提交：%s\n' "$PREVIOUS_COMMIT" >&2
  fi
  if [[ -d "$BACKUP_DIR" ]]; then
    printf '更新前备份：%s\n' "$BACKUP_DIR" >&2
  fi
  printf '脚本不会自动删除数据卷，也不会自动覆盖回滚。\n' >&2
  exit "$code"
}
trap on_error ERR
trap 'rm -f "$HEALTH_FILE"' EXIT

say '检查运行环境'
for command_name in git curl tar; do
  command -v "$command_name" >/dev/null 2>&1 || fail "缺少命令：$command_name"
done
command -v "${DOCKER[0]}" >/dev/null 2>&1 || fail '没有找到 Docker'
"${DOCKER[@]}" compose version >/dev/null

[[ -f docker-compose.yml ]] || fail '当前目录不是项目根目录：缺少 docker-compose.yml'
[[ -f Dockerfile && -f server.js ]] || fail '项目文件不完整：缺少 Dockerfile 或 server.js'
[[ -f .env ]] || fail '缺少 .env，请先按照 SERVER_DEPLOYMENT.md 设置 ADMIN_PASSWORD'

ADMIN_PASSWORD_LINE="$(sed -n 's/^ADMIN_PASSWORD=//p' .env | tail -n 1)"
if [[ -z "$ADMIN_PASSWORD_LINE" || "$ADMIN_PASSWORD_LINE" == 'admin888' ]]; then
  fail '.env 中的 ADMIN_PASSWORD 为空或仍为默认密码'
fi

DIRTY_STATUS="$(git status --porcelain --untracked-files=no)"
if [[ -n "$DIRTY_STATUS" ]]; then
  printf '\n检测到服务器本地修改：\n%s\n' "$DIRTY_STATUS"
  printf '\n上传到 GitHub 不会自动清除服务器上的本地修改。脚本已停止，以免覆盖有效配置。\n'
  printf '先查看具体差异，例如：\n  git diff -- docker-compose.yml\n'

  if [[ "$DIRTY_STATUS" == *"docker-compose.yml"* ]]; then
    COMPOSE_DIFF="$(git diff HEAD -- docker-compose.yml)"
    if [[ "$COMPOSE_DIFF" == *"npm_default"* ]]; then
      printf '\n检测到 docker-compose.yml 中可能存在旧版 NPM 网络配置。\n'
      printf '新版已改用 docker-compose.npm.yml；确认差异只有该配置后，可执行：\n'
      printf '  cp docker-compose.yml "$HOME/docker-compose.yml.npm-old-backup"\n'
      printf '  git restore docker-compose.yml\n'
      printf '  bash update-server.sh\n'
    fi
  fi

  printf '\n完整说明：SERVER_DEPLOYMENT.md 的“服务器存在未提交修改”小节。\n'
  fail '请先确认并处理服务器本地修改；不要使用 git reset --hard'
fi

PROXY_NETWORK="$(sed -n 's/^PROXY_NETWORK=//p' .env | tail -n 1)"
PROXY_NETWORK="${PROXY_NETWORK:-npm_default}"
if [[ -f docker-compose.npm.yml ]] && "${DOCKER[@]}" network inspect "$PROXY_NETWORK" >/dev/null 2>&1; then
  COMPOSE+=( -f docker-compose.npm.yml )
  printf '反向代理网络：%s（使用 NPM 覆盖配置）\n' "$PROXY_NETWORK"
elif [[ -f docker-compose.npm.yml ]]; then
  printf '警告：未找到 Docker 网络 %s，将按宿主机反向代理方式更新。\n' "$PROXY_NETWORK"
  printf '如果 Nginx Proxy Manager 在容器中，请先修正 .env 的 PROXY_NETWORK。\n'
fi

say '备份当前服务器数据'
mkdir -p "$BACKUP_DIR"
if "${DOCKER[@]}" inspect wuwa-ght >/dev/null 2>&1; then
  "${DOCKER[@]}" cp wuwa-ght:/data/. "$BACKUP_DIR/"
  BACKUP_ARCHIVE="$BACKUP_DIR.tar.gz"
  tar -czf "$BACKUP_ARCHIVE" -C "$BACKUP_DIR" .
  printf '完整备份已保存：%s\n' "$BACKUP_ARCHIVE"
else
  printf '尚未发现 wuwa-ght 容器，跳过旧数据备份（首次部署属于正常情况）。\n'
fi

say '从 GitHub 拉取最新代码'
git fetch --prune
git pull --ff-only
printf '当前提交：%s\n' "$(git rev-parse --short HEAD)"

# 拉取代码后重新判断覆盖文件，允许脚本本身首次随更新加入项目。
COMPOSE=("${DOCKER[@]}" compose -f docker-compose.yml)
PROXY_NETWORK="$(sed -n 's/^PROXY_NETWORK=//p' .env | tail -n 1)"
PROXY_NETWORK="${PROXY_NETWORK:-npm_default}"
if [[ -f docker-compose.npm.yml ]] && "${DOCKER[@]}" network inspect "$PROXY_NETWORK" >/dev/null 2>&1; then
  COMPOSE+=( -f docker-compose.npm.yml )
fi

say '检查 Compose 配置'
"${COMPOSE[@]}" config >/dev/null

say '构建最新镜像'
if [[ "$NO_CACHE" -eq 1 ]]; then
  "${COMPOSE[@]}" build --pull --no-cache
else
  "${COMPOSE[@]}" build --pull
fi

say '修复并确认数据卷权限'
"${COMPOSE[@]}" run --rm --user root --entrypoint sh wuwa-ght \
  -c 'mkdir -p /data/backups /data/uploads && chown -R node:node /data'

say '重建并启动网站容器'
"${COMPOSE[@]}" up -d --force-recreate
"${COMPOSE[@]}" ps

say '等待健康检查'
HEALTH_OK=0
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:130/api/health >"$HEALTH_FILE" 2>/dev/null; then
    HEALTH_OK=1
    break
  fi
  printf '等待服务启动（%s/30）...\r' "$attempt"
  sleep 2
done
printf '\n'

if [[ "$HEALTH_OK" -ne 1 ]]; then
  "${DOCKER[@]}" logs --tail=120 wuwa-ght || true
  fail '60 秒内健康检查未通过'
fi

cat "$HEALTH_FILE"

if "${DOCKER[@]}" network inspect "$PROXY_NETWORK" >/dev/null 2>&1; then
  if ! "${DOCKER[@]}" network inspect "$PROXY_NETWORK" --format '{{range .Containers}}{{println .Name}}{{end}}' | grep -qx 'wuwa-ght'; then
    fail "网站容器未加入反向代理网络：$PROXY_NETWORK"
  fi
  printf 'NPM 网络连接正常：%s\n' "$PROXY_NETWORK"
fi

say '更新完成'
printf '提交：%s\n' "$(git rev-parse --short HEAD)"
if [[ -n "$BACKUP_ARCHIVE" ]]; then
  printf '备份：%s\n' "$BACKUP_ARCHIVE"
fi
printf '请在浏览器按 Ctrl + F5 强制刷新；手机端关闭全部页面后重新打开。\n'
