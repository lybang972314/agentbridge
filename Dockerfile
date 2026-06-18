FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ src/
COPY tools/ tools/
COPY public/ public/

RUN mkdir -p /app/data

ENV PORT=3100
EXPOSE 3100

CMD ["node", "--import", "tsx", "src/index.ts"]
