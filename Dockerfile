FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
COPY tools/ tools/
COPY public/ public/
RUN mkdir -p /app/data
ENV PORT=3100
EXPOSE 3100
CMD ["npx", "tsx", "src/index.ts"]
