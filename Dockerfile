# ── 构建阶段：打包前端 ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# 明确使用 package-lock.json 安装全部依赖（含 devDependencies，tsc/vite 都在这里）
RUN npm ci --include=dev
COPY . .
RUN npm run build

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
