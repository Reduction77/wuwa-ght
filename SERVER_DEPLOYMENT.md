# 鸣潮托管站服务器详细部署指南

本文档对应当前仓库的服务器版实现：Docker 负责构建和运行 React 页面与 Node API，数据持久化在 Docker 卷的 `/data` 目录。主流程按“服务器上已经有 Docker 版 Nginx Proxy Manager（NPM）”编写，文末也保留宿主机 Caddy 的替代方案。

推荐架构：

```text
老板/管理员浏览器
        │ HTTPS 443
        ▼
 Nginx Proxy Manager 容器
        │ Docker 共享网络，HTTP wuwa-ght:130
        ▼
  wuwa-ght 容器
        │
        ▼
 Docker 持久化卷 /data
  ├─ data.json
  ├─ uploads/
  └─ backups/
```

这种方式不会把应用的 130 端口直接暴露到公网。NPM 和网站容器通过同一个 Docker 网络通信，NPM 对外提供域名和 HTTPS，并转发 `X-Forwarded-Proto`，服务器据此给老板会话 Cookie 添加 `Secure` 属性。

本文特别包含以下实际故障的修复：

- 服务器没有 `.env.example`，无法复制环境变量模板。
- 容器报 `EACCES: permission denied, mkdir '/data/backups'`。
- 应用健康检查为 200，但网页仍然 502。
- 后台持续提示“服务器数据已被其他页面更新”。
- 代码已经更新，但浏览器仍显示旧界面。

## 1. 部署前需要准备

- 一台能安装 Docker 的 64 位 Linux 云服务器，本文以 Ubuntu 22.04/24.04 为例。
- 一个域名，例如 `wuwa.example.com`。
- 域名的 A 记录指向服务器公网 IPv4；只有确实配置了 IPv6 时才添加 AAAA 记录。
- 云厂商安全组放行 TCP 端口：`22`、`80`、`443`。
- 一份当前代码，以及旧网站导出的 JSON 备份（如果需要迁移数据）。

正式使用强烈建议配置域名和 HTTPS。不要在公网 HTTP 页面输入后台管理密码。

## 2. 登录并初始化服务器

在本地终端连接服务器：

```bash
ssh 你的用户名@服务器公网IP
```

更新系统并安装基础工具：

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git openssl ufw
```

配置系统时区，便于查看日志时间：

```bash
sudo timedatectl set-timezone Asia/Shanghai
timedatectl
```

启用系统防火墙前，务必先放行 SSH，避免把自己锁在服务器外：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

云厂商控制台的安全组也要放行 `22/80/443`。不需要对公网放行 `130`。

## 3. 安装 Docker Engine 和 Compose

以下命令使用 Docker 官方 Ubuntu 软件源：

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

添加 Docker 软件源：

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

安装并验证：

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

为了减少权限配置错误，本文后续统一使用 `sudo docker`。如果以后要让普通用户直接运行 Docker，请先了解 Docker 用户组等同于较高系统权限，不要随意把不可信用户加入该组。

Docker 官方说明：

- <https://docs.docker.com/engine/install/ubuntu/>
- <https://docs.docker.com/compose/install/linux/>

## 4. 上传或拉取项目代码

推荐把项目放在 `/opt/wuwa-ght`。

### 方式 A：从 Git 仓库拉取

```bash
sudo mkdir -p /opt/wuwa-ght
sudo chown -R "$USER":"$USER" /opt/wuwa-ght
git clone 你的仓库地址 /opt/wuwa-ght
cd /opt/wuwa-ght
```

如果仓库是私有仓库，建议在服务器配置只读 Deploy Key，不要把个人 GitHub Token 写进命令或代码文件。

### 方式 B：从本地上传

先在本地将项目压缩，排除 `node_modules`、`dist`、`.git`、`data` 和 `.env`，再上传到服务器并解压到 `/opt/wuwa-ght`。服务器不需要预装 Node.js，Docker 构建阶段会使用仓库中指定的 Node 20 镜像。

上传完成后确认关键文件存在：

```bash
cd /opt/wuwa-ght
ls Dockerfile docker-compose.yml server.js package.json package-lock.json
```

## 5. 创建后台管理密码

后台密码完全由你自己设置，不是固定密码，也不要求使用自动生成的密码。它只用于进入托管管理后台，不会改变老板各自的查看口令。

### 方式 A：手动设置自己的密码（推荐）

进入项目目录。如果你的项目实际放在 `~/data/wuwa-ght`，就把本文中的 `/opt/wuwa-ght` 换成该路径：

```bash
cd /opt/wuwa-ght
```

直接编辑 `.env`；即使服务器上没有 `.env.example` 也不影响：

```bash
nano .env
```

文件中只需要写一行，把等号后面的示例换成你自己的后台密码：

```env
ADMIN_PASSWORD=WuwaAdmin2026Safe88
PROXY_NETWORK=npm_default
```

上面的密码只是格式示例，不能原样照抄。建议使用至少 12～16 位的字母和数字组合，可以包含 `_` 或 `-`。为避免 Compose 解析问题，尽量不要使用中文、空格、`#`、`$`、单引号或双引号。`PROXY_NETWORK` 填 NPM 容器实际所在的 Docker 网络，通常是 `npm_default`。

在 nano 中保存：

1. 按 `Ctrl + O`。
2. 按回车确认文件名。
3. 按 `Ctrl + X` 退出。

然后限制文件权限：

```bash
chmod 600 .env
```

可以用下面的命令确认文件存在且权限正确；该命令不会显示密码内容：

```bash
ls -l .env
```

### 方式 B：自动生成随机密码（可选）

如果不想自己想密码，可以运行：

```bash
ADMIN_PASSWORD_VALUE="$(openssl rand -hex 24)"
printf 'ADMIN_PASSWORD=%s\nPROXY_NETWORK=npm_default\n' "$ADMIN_PASSWORD_VALUE" > .env
chmod 600 .env
printf '后台管理密码：%s\n' "$ADMIN_PASSWORD_VALUE"
unset ADMIN_PASSWORD_VALUE
```

立即把设置或生成的密码保存到密码管理器。服务器生产模式未设置密码、密码为空或仍为默认值 `admin888` 时会拒绝启动。

不要执行以下操作：

- 不要把 `.env` 上传到公开仓库。
- 不要把游戏密码、完整手机号等敏感信息写进本站。
- 不要让多个管理员共用容易猜测的短密码。

## 6. 首次构建并启动

### 6.1 确认 Nginx Proxy Manager 的 Docker 网络

先查看网络：

```bash
sudo docker network ls
```

常见的 NPM 网络名是 `npm_default`。可以进一步确认里面有哪些容器：

```bash
sudo docker network inspect npm_default --format '{{range .Containers}}{{println .Name}}{{end}}'
```

如果实际网络名不是 `npm_default`，把它写入 `.env`：

```env
ADMIN_PASSWORD=你的后台管理密码
PROXY_NETWORK=实际的NPM网络名
```

仓库中的 `docker-compose.npm.yml` 会读取 `PROXY_NETWORK`，默认值为 `npm_default`。不要把网站和 NPM 分别留在 `wuwa-ght_default`、`npm_default` 两个隔离网络中，否则 NPM 无法访问网站容器。

### 6.2 使用 NPM 覆盖配置启动

```bash
cd /opt/wuwa-ght
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml config
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml build --pull
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml ps
```

首次构建需要下载 Node 镜像和 npm 依赖，耗时取决于服务器网络。`docker compose config` 会在密码缺失时提前报错，但它也可能把环境变量展开到输出中，因此不要把完整输出发送到公开聊天或日志平台。

查看应用日志：

```bash
sudo docker compose logs --tail=100 wuwa-ght
```

日志中应出现：

```text
[ready] 鸣潮托管站：http://0.0.0.0:130
[ready] 数据目录：/data
```

检查本机健康接口：

```bash
curl -fsS http://127.0.0.1:130/api/health
sudo docker inspect --format='{{.State.Health.Status}}' wuwa-ght
```

正常情况下，健康接口会返回类似内容：

```json
{"ok":true,"updatedAt":"2026-08-19T00:00:00.000Z","backups":0}
```

Compose 已经把端口绑定为 `127.0.0.1:130:130`，因此外网不能直接访问 130 端口。这是预期行为。

确认网站容器已经自动加入 NPM 网络：

```bash
PROXY_NETWORK_NAME="$(sed -n 's/^PROXY_NETWORK=//p' .env)"
PROXY_NETWORK_NAME="${PROXY_NETWORK_NAME:-npm_default}"
sudo docker network inspect "$PROXY_NETWORK_NAME" --format '{{range .Containers}}{{println .Name}}{{end}}'
```

如果 `.env` 没写 `PROXY_NETWORK`，直接检查默认网络：

```bash
sudo docker network inspect npm_default --format '{{range .Containers}}{{println .Name}}{{end}}'
```

输出中应同时存在 NPM 容器和 `wuwa-ght`。

## 7. 配置 Nginx Proxy Manager 和 HTTPS

进入 Nginx Proxy Manager 管理界面，新增或编辑 Proxy Host：

- Domain Names：填写真实域名，例如 `wuwa.example.com`。
- Scheme：`http`。
- Forward Hostname / IP：`wuwa-ght`。
- Forward Port：`130`。
- Websockets Support：可以开启。
- Block Common Exploits：可以开启。

不能填写 `127.0.0.1`。NPM 在容器里运行时，`127.0.0.1` 指向 NPM 容器自己，并不指向网站容器。

在 SSL 页面：

1. 选择 Request a new SSL Certificate。
2. 开启 Force SSL。
3. 同意证书服务条款并保存。

NPM 官方也建议把同一主机上的上游容器加入自定义 Docker 网络，并在 Proxy Host 中直接使用服务名和容器端口：<https://develop.nginxproxymanager.com/advanced-config/#best-practice-use-a-docker-network>。

域名 A 记录必须指向服务器公网 IPv4，云安全组和 UFW 都必须放行 80、443。

保存后验证：

```bash
curl -I https://wuwa.example.com
curl -fsS https://wuwa.example.com/api/health
```

浏览器入口：

- 首页：`https://wuwa.example.com/`
- 老板入口：`https://wuwa.example.com/#boss`
- 管理后台：`https://wuwa.example.com/#admin`

### 7.1 立即修复已经存在的 502

如果旧部署没有使用 `docker-compose.npm.yml`，可以先临时连接网络恢复网站：

```bash
sudo docker network connect npm_default wuwa-ght
```

然后在 NPM 中把上游改成 `http://wuwa-ght:130`。临时连接会在容器重建后丢失，所以最终仍要使用仓库中的覆盖文件重新创建容器：

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
```

### 7.2 不使用 NPM：宿主机 Caddy 替代方案

Caddy 的 Ubuntu 官方包会自动作为 systemd 服务运行：

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

编辑 `/etc/caddy/Caddyfile`：

```bash
sudo nano /etc/caddy/Caddyfile
```

把内容改为下面这样，并将域名替换成自己的真实域名：

```caddyfile
wuwa.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:130

    header {
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }
}
```

检查配置并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

当域名解析已指向服务器，且公网端口 80、443 可以访问时，Caddy 会自动申请证书、续期并将 HTTP 重定向到 HTTPS。官方说明：

- <https://caddyserver.com/docs/install>
- <https://caddyserver.com/docs/quick-starts/reverse-proxy>
- <https://caddyserver.com/docs/automatic-https>

验证公网访问：

```bash
curl -I https://wuwa.example.com
curl -fsS https://wuwa.example.com/api/health
```

然后用浏览器打开：

- 首页：`https://wuwa.example.com/`
- 老板入口：`https://wuwa.example.com/#boss`
- 管理后台：`https://wuwa.example.com/#admin`

## 8. 首次上线验收

按以下顺序检查，不要只确认首页能打开：

1. 首页能正常显示，二维码和图标没有 404。
2. 打开后台，使用 `.env` 中的管理密码登录。
3. 新建一位临时测试老板，保存后等待底部显示“已保存到服务器”。
4. 用测试老板口令登录老板端，只能看到这一位老板的数据。
5. 后台勾选今日完成，老板端刷新后能看到变化。
6. 上传一张活动图片，确认老板端可以显示。
7. 退出后台并删除或归档测试老板。
8. 执行健康检查，确认容器状态为 `healthy`。

如果浏览器访问的是 HTTPS，但老板登录 Cookie 没有 `Secure`，检查反向代理是否向网站传递 `X-Forwarded-Proto: https`。NPM 的标准 Proxy Host 和 Caddy 的 `reverse_proxy` 都会正常处理该请求头。

## 9. 从原网站迁移数据

### 9.1 原网站是静态版或只有 JSON 备份

1. 在原网站后台点击“下载备份”，取得 `托管数据备份-日期.json`。
2. 登录新服务器网站后台。
3. 点击“从本地恢复”，选择 JSON 文件。
4. 核对提示中的老板数量并确认覆盖。
5. 等待底部显示“已保存到服务器”。
6. 抽查日常、周常、活动、高难、备注和历史周期。

CSV 只能用于统计查看，不能用于恢复。

旧版 JSON 会自动补齐新字段，并把旧的数字周序号迁移成真实日历周。导入时会拒绝重复老板 ID、重复查看口令、无效日期以及 1～365 天之外的托管周期。

### 9.2 原网站也是本项目服务器版

最完整的方式是迁移整个 `/data`，因为后台 JSON 备份不会包含服务器 `uploads/` 目录里的图片文件。

在旧服务器执行：

```bash
mkdir -p "$HOME/wuwa-server-backup"
sudo docker cp wuwa-ght:/data/. "$HOME/wuwa-server-backup/"
tar -czf "$HOME/wuwa-server-backup.tar.gz" -C "$HOME/wuwa-server-backup" .
```

把 `wuwa-server-backup.tar.gz` 下载到安全位置，再上传到新服务器。新服务器首次启动容器后执行：

```bash
cd /opt/wuwa-ght
sudo docker compose stop
mkdir -p "$HOME/wuwa-server-restore"
tar -xzf "$HOME/wuwa-server-backup.tar.gz" -C "$HOME/wuwa-server-restore"
sudo docker cp "$HOME/wuwa-server-restore/." wuwa-ght:/data/
sudo docker compose start
curl -fsS http://127.0.0.1:130/api/health
```

恢复前请确认压缩包确实来自旧服务器的 `/data`，并保留新服务器当前备份。不要在容器运行并写入数据时覆盖 `/data/data.json`。

迁移后重点检查活动图片。JSON 中形如 `/api/uploads/xxx.jpg` 的值只是路径，必须同时存在对应的 `/data/uploads/xxx.jpg` 文件。

## 10. 数据与备份机制

容器内的数据目录由 `DATA_DIR=/data` 指定：

- `/data/data.json`：全部业务数据。
- `/data/uploads/`：后台上传的活动图片。
- `/data/backups/`：每次写入前保存的 JSON 滚动备份，最多 30 份。

自动滚动备份只备份 `data.json`，不包含图片；因此还需要定期做完整 `/data` 备份。

### 手动完整备份

```bash
BACKUP_DIR="$HOME/wuwa-backups/$(date +%F-%H%M%S)"
mkdir -p "$BACKUP_DIR"
sudo docker cp wuwa-ght:/data/. "$BACKUP_DIR/"
tar -czf "$BACKUP_DIR.tar.gz" -C "$BACKUP_DIR" .
printf '完整备份：%s.tar.gz\n' "$BACKUP_DIR"
```

检查备份内容：

```bash
tar -tzf "$BACKUP_DIR.tar.gz" | head -50
```

建议至少保留：

- 服务器本地最近 7 份完整备份。
- 另一台设备或对象存储中的每周备份。
- 每次升级前的一份完整备份。

备份文件包含老板资料和查看口令，必须按敏感文件管理，不要上传到公开网盘或公开仓库。

## 11. 更新网站版本

更新前先做完整备份，然后检查工作目录：

```bash
cd /opt/wuwa-ght
git status --short
```

如果服务器目录存在未提交修改，不要直接覆盖；先确认这些修改是否需要保留。Git 部署方式可使用：

### 推荐：一键更新脚本

项目根目录已经提供 `update-server.sh`。它会依次完成：检查环境、检查 `.env`、备份完整 `/data`、拉取 GitHub、识别 NPM 网络、构建镜像、修复数据卷权限、重建容器和健康检查。

日常更新只需：

```bash
cd ~/data/wuwa-ght
bash -n update-server.sh
bash update-server.sh
```

其中 `bash -n` 只做脚本语法检查，不会更新或修改数据；首次运行或手动改过脚本后建议先执行一次。语法检查通过后，以后日常更新可以直接运行 `bash update-server.sh`。

如果怀疑 Docker 构建缓存导致页面没有更新，可以全量重建：

```bash
bash update-server.sh --no-cache
```

脚本发现服务器仓库存在未提交修改时会停止，不会擅自覆盖；更新失败时会输出容器日志和更新前备份位置。首次把脚本上传到 GitHub 后，需要先手动执行一次 `git pull --ff-only` 取得脚本，以后的更新再直接运行它。

### 更新停止：服务器存在未提交修改

上传新代码到 GitHub 只会改变远程仓库，不会自动清除服务器目录中以前手动修改过的文件。脚本显示类似下面的内容时，`M` 表示该文件在服务器本地被修改过：

```text
 M docker-compose.yml
```

先查看具体差异：

```bash
git diff -- docker-compose.yml
```

如果命令进入翻页界面，查看完成后按 `q` 退出。不要还没看差异就执行恢复命令，也不要使用 `git reset --hard`。

旧部署为了修复 Nginx Proxy Manager 的 502，可能曾经把下面的网络配置直接写进 `docker-compose.yml`：

```yaml
networks:
  - npm_default
```

当前版本已经通过独立的 `docker-compose.npm.yml` 连接 NPM 网络。确认本地差异只有这项旧网络配置，并且项目中存在 `docker-compose.npm.yml` 后，可以先备份再恢复仓库版本：

```bash
cp docker-compose.yml "$HOME/docker-compose.yml.npm-old-backup"
git restore docker-compose.yml
git status --short
bash update-server.sh
```

上述操作只恢复代码仓库中的 Compose 配置，不会删除 Docker 数据卷、`.env` 或老板资料。更新脚本检测到 `.env` 中的 `PROXY_NETWORK`（默认 `npm_default`）确实存在后，会自动加载 `docker-compose.npm.yml`。

如果差异中还有端口、卷路径或其他必须保留的服务器配置，不要执行 `git restore`。应先把通用改动同步到 GitHub，或者把服务器专用配置迁移到 `.env` 或单独的 Compose 覆盖文件，再运行更新脚本。

### 手动更新（脚本不可用时）

```bash
git pull --ff-only
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml build --pull
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml ps
sudo docker compose logs --tail=100 wuwa-ght
curl -fsS http://127.0.0.1:130/api/health
```

`docker compose up -d` 会重新创建应用容器，但不会删除命名卷，因此 `/data` 会保留。NPM 覆盖文件会在每次重建时重新加入共享网络。不要执行 `docker compose down -v`，其中 `-v` 会删除数据卷。

更新会使保存在内存中的老板登录会话失效，老板重新输入口令即可；业务数据不会因此丢失。

## 12. 修改后台管理密码

后台密码以后可以随时自定义修改。进入实际项目目录并编辑 `.env`：

```bash
cd /opt/wuwa-ght
nano .env
```

把这一行等号后面的内容改成新密码：

```env
ADMIN_PASSWORD=你的新后台密码
```

保存退出后，重新创建容器让新密码生效：

```bash
chmod 600 .env
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml ps
```

修改密码不会删除老板资料、完成记录、图片或备份，也不会改变老板查看口令。容器重新创建后旧后台密码立即失效；确认新密码可以登录后，再从密码管理器中删除旧密码。

## 13. 常用维护命令

```bash
# 查看容器状态
sudo docker compose ps

# 查看最近日志
sudo docker compose logs --tail=100 wuwa-ght

# 持续查看日志，Ctrl+C 退出
sudo docker compose logs -f wuwa-ght

# 重启应用
sudo docker compose restart wuwa-ght

# 查看健康状态
curl -fsS http://127.0.0.1:130/api/health

# 查看 Caddy 日志
sudo journalctl -u caddy -n 100 --no-pager

# 验证 Caddy 配置
sudo caddy validate --config /etc/caddy/Caddyfile

# 查看数据卷挂载信息
sudo docker inspect wuwa-ght --format='{{json .Mounts}}'
```

## 14. 常见故障排查

### `cp: cannot stat '.env.example': No such file or directory`

服务器上的代码版本较旧或当前目录不对。先确认目录：

```bash
pwd
ls Dockerfile docker-compose.yml server.js
```

`.env.example` 不是运行必需文件，可以直接创建自己的配置：

```bash
nano .env
```

写入：

```env
ADMIN_PASSWORD=你自定义的后台密码
PROXY_NETWORK=npm_default
```

然后执行：

```bash
chmod 600 .env
```

创建 `.env` 不需要 `sudo`，否则文件可能变为 root 所有。后台密码可以完全自定义，建议使用至少 12～16 位字母和数字组合。

### Compose 提示没有设置 ADMIN_PASSWORD

检查当前目录和 `.env`：

```bash
cd /opt/wuwa-ght
ls -la .env
grep '^ADMIN_PASSWORD=' .env
```

不要把真实密码对应的命令输出发给别人。

### `network ... declared as external, but could not be found`

说明 `.env` 中填写的 NPM 网络名与服务器实际名称不同：

```bash
sudo docker network ls
```

找到 Nginx Proxy Manager 所在网络，例如 `npm_default`，然后修改：

```env
PROXY_NETWORK=npm_default
```

重新启动：

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d
```

### `EACCES: permission denied, mkdir '/data/backups'`

原因是旧数据卷的 `/data` 归 root 所有，而当前镜像使用普通 `node` 用户运行。只修复权限，不要删除数据卷：

```bash
cd /opt/wuwa-ght
sudo docker compose down
sudo docker compose run --rm \
  --user root \
  --entrypoint sh \
  wuwa-ght \
  -c 'mkdir -p /data/backups /data/uploads && chown -R node:node /data'
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
```

验证：

```bash
sudo docker compose logs --tail=100 wuwa-ght
curl -i http://127.0.0.1:130/api/health
```

不要执行 `docker compose down -v`；`-v` 会删除包含老板数据和图片的数据卷。

### 容器反复重启

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 wuwa-ght
```

常见原因包括：后台密码为空、`/data` 权限异常、数据 JSON 损坏或端口被占用。

### `127.0.0.1:130` 无法访问

```bash
sudo ss -lntp | grep ':130'
sudo docker compose ps
sudo docker compose logs --tail=100 wuwa-ght
```

确认 Compose 中是 `127.0.0.1:130:130`，容器内部端口是 130。

### 本地健康检查 200，但域名访问仍然 502

如果下面命令返回 `HTTP/1.1 200 OK`：

```bash
curl -i http://127.0.0.1:130/api/health
```

说明应用、数据和端口都正常，不要继续重建网站。502 位于反向代理层。

Docker 版 Nginx Proxy Manager 不能通过 `127.0.0.1:130` 访问宿主机网站端口，因为容器内的 `127.0.0.1` 指向 NPM 自己。检查网络：

```bash
sudo docker network ls
sudo docker network inspect npm_default --format '{{range .Containers}}{{println .Name}}{{end}}'
```

输出中必须同时包含 NPM 容器和 `wuwa-ght`。立即修复：

```bash
sudo docker network connect npm_default wuwa-ght
```

NPM Proxy Host 必须填写：

- Scheme：`http`
- Forward Hostname：`wuwa-ght`
- Forward Port：`130`

永久修复则使用仓库中的 `docker-compose.npm.yml`：

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
```

如果 NPM 网络不是 `npm_default`，把实际名称填入 `.env` 的 `PROXY_NETWORK`。

### 域名可以解析，但 HTTPS 申请失败

检查：

1. 域名 A 记录是否指向当前服务器公网 IP。
2. 云安全组和 UFW 是否同时放行 80、443。
3. 是否有 Nginx、Apache 等其他程序占用端口。
4. NPM 申请证书时是否出现错误。

```bash
sudo ss -lntp | grep -E ':(80|443) '
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

### 首页正常，后台保存失败

检查浏览器是否访问 HTTPS 域名而不是旧地址，再查看：

```bash
sudo docker compose logs --tail=200 wuwa-ght
curl -fsS https://你的域名/api/health
```

如果出现“服务器数据已被其他页面更新”：

1. 先确认服务器已经部署包含修订号修复的新版本。
2. 关闭其他仍打开的后台页面。
3. 强制刷新浏览器，再点“重新读取”。
4. 检查刚才失败的登记是否需要重新填写。

当前版本会在读取服务器数据时保留 `revision`，从旧备份恢复时也会使用服务器当前修订号。旧版本会丢失该值，从而陷入反复冲突。

更新并重建：

```bash
git pull --ff-only
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml build --pull
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
```

### 已经更新代码，但浏览器仍显示旧界面

先确认新镜像确实构建并启动：

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml build --no-cache
sudo docker compose -f docker-compose.yml -f docker-compose.npm.yml up -d --force-recreate
curl -fsS http://127.0.0.1:130/api/health
```

然后在浏览器按 `Ctrl + F5` 强制刷新。手机端可以关闭该网页的所有标签后重新打开；如果仍未更新，清除该站点的缓存和 Service Worker 后再访问。当前仓库已经提升离线缓存版本，部署后会清理旧的应用外壳缓存。

### 恢复 JSON 后图片不显示

JSON 可能只保存了 `/api/uploads/...` 路径。检查对应文件是否已经复制到容器：

```bash
sudo docker exec wuwa-ght find /data/uploads -maxdepth 1 -type f | head
```

需要从旧服务器恢复完整 `/data/uploads`，单独导入 JSON 无法还原这些图片文件。

### 数据损坏时如何回退

先停止写入并完整复制当前 `/data` 留作调查：

```bash
sudo docker compose stop
mkdir -p "$HOME/wuwa-damaged-copy"
sudo docker cp wuwa-ght:/data/. "$HOME/wuwa-damaged-copy/"
```

然后从后台下载的 JSON 或 `/data/backups/` 中选择确认正常的版本进行恢复。恢复完成后再启动容器。不要在没有保存损坏现场副本的情况下直接覆盖文件。

## 15. 上线安全检查表

- [ ] 域名通过 HTTPS 正常访问，HTTP 会跳转到 HTTPS。
- [ ] 云安全组和 UFW 只开放必要端口。
- [ ] 130 端口仅绑定 `127.0.0.1`，公网无法直接访问。
- [ ] `.env` 权限为 600，且未提交到 Git。
- [ ] 后台管理密码使用随机长密码并保存在密码管理器。
- [ ] 网站中没有游戏密码、完整手机号等敏感信息。
- [ ] 老板口令互不重复，且不使用过于简单的公共口令。
- [ ] 已验证完整 `/data` 备份可以读取。
- [ ] 已抽查老板端只能读取当前老板的数据。
- [ ] 更新前会先备份，且不会执行 `docker compose down -v`。

完成以上检查后，服务器版即可长期运行。日常维护重点只有三件事：定期完整备份 `/data`、及时安装服务器安全更新、每次更新应用后检查健康接口和老板端登录。
