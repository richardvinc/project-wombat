FROM node:lts-alpine AS base

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10.27.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nx.json tsconfig.base.json ./
COPY apps ./apps

RUN pnpm install --frozen-lockfile

RUN pnpm exec nx build worker

CMD ["node", "dist/apps/worker/main.js"]
