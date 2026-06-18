# MCP Gateway — Production Docker Image
# Deploy on Railway, Render, Fly.io, or any Docker host

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src/ src/
COPY tools/ tools/
COPY public/ public/
RUN npx tsc --noEmit || true

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY src/ src/
COPY tools/ tools/
COPY public/ public/
COPY tsconfig.json ./

ENV PORT=3100
ENV NODE_ENV=production
EXPOSE 3100

# Create data dir for SQLite
RUN mkdir -p /app/data

CMD ["node", "--import", "tsx", "src/index.ts"]
