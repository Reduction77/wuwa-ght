# ── 构建阶段：打包前端 ──
FROM node:20-alpine AS build
WORKDIR /app

# 只先拷依赖清单，利用缓存；不随包带 node_modules（避免 glibc/musl 与缓存污染）
COPY package.json package-lock.json ./

# 全新安装全部依赖（含 devDependencies：typescript / vite 都在这里）
# --include=dev 确保即使 NODE_ENV=production 也装 devDeps
RUN npm ci --include=dev --no-audit --no-fund

# 装完先验证构建工具确实就位，缺了立刻在这里报清楚的错
RUN test -f node_modules/typescript/lib/tsc.js || (echo 'ERROR: typescript 未安装' && exit 1)
RUN test -f node_modules/vite/bin/vite.js || (echo 'ERROR: vite 未安装' && exit 1)

# 再拷源码并构建（用 node 直连，避开 .bin 符号链接问题）
COPY . .
RUN node node_modules/typescript/lib/tsc.js -b && node node_modules/vite/bin/vite.js build

# ── 运行阶段：Node 一体服务（页面 + API + 数据存储）──
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=80 \
    DATA_DIR=/data
# ADMIN_PASSWORD 请在 docker run 时用 -e 覆盖，不要用默认值上线

COPY server.js ./
COPY --from=build /app/dist ./dist

# 数据（data.json + 上传的图片）放这里，挂载卷即可持久化
VOLUME /data

EXPOSE 80
CMD ["node", "server.js"]
