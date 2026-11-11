# --- deps ---
FROM node:22-alpine3.20 AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f package-lock.json ]; then npm ci --omit=dev; \
  elif [ -f pnpm-lock.yaml ]; then npm -g i pnpm && pnpm i --frozen-lockfile --prod; \
  elif [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \
  else npm i --omit=dev; fi

# --- build ---
FROM node:22-alpine3.20 AS builder
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:22-alpine3.20 AS runner
ENV NODE_ENV=production
WORKDIR /app
# prod deps (из deps) + сборка (из builder)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=builder /app/dist ./dist
EXPOSE 7001
CMD ["node", "dist/main.js"]
