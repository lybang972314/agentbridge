FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ ./dist/
COPY tools/ ./tools/
COPY public/ ./public/
RUN mkdir -p /app/data
ENV PORT=3100
EXPOSE 3100
CMD ["node", "dist/index.js"]
