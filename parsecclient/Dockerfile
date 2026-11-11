# --- deps ---
FROM node:22-alpine3.20 AS deps
WORKDIR /app
# Берём весь проект клиента (проще и надёжнее для кэша)
COPY parsecclient/package.json parsecclient/package-lock.json ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then npm -g i pnpm && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  else npm i; fi

# --- build ---
FROM node:22-alpine3.20 AS builder
WORKDIR /app
# Нужны node_modules и исходники клиента
COPY --from=deps /app/node_modules ./node_modules
COPY parsecclient/ ./

# Compose passes only public values from infra/.env; secrets never enter the image.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_MAIN_PAGE_URL
ARG NEXT_PUBLIC_COOKIE_NAME=psk.sid
ARG NEXT_PUBLIC_STUB_MODE=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_MAIN_PAGE_URL=$NEXT_PUBLIC_MAIN_PAGE_URL \
    NEXT_PUBLIC_COOKIE_NAME=$NEXT_PUBLIC_COOKIE_NAME \
    NEXT_PUBLIC_STUB_MODE=$NEXT_PUBLIC_STUB_MODE

# важное: включить standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# --- runner ---
FROM node:22-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# standalone + public/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
