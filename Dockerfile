# ---- Base (with Poppler + fonts) ----
    FROM node:20-bookworm-slim AS base
    ENV DEBIAN_FRONTEND=noninteractive
    RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils pdf2svg fonts-dejavu fonts-liberation ca-certificates \
      && rm -rf /var/lib/apt/lists/*
    
    # ---- Dependencies (install dev deps for build) ----
    FROM base AS deps
    WORKDIR /app
    COPY package.json package-lock.json* ./
    RUN npm ci --legacy-peer-deps
    
    # ---- Build (Next.js) ----
    FROM base AS builder
    WORKDIR /app
    ENV NEXT_TELEMETRY_DISABLED=1
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN npm run build --legacy-peer-deps
    
    # ---- Runner (production-only deps) ----
    FROM base AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    # Copy app artifacts
    COPY --from=builder /app/.next ./.next
    COPY --from=builder /app/public ./public
    COPY --from=builder /app/package.json ./package.json
    COPY --from=builder /app/next.config.mjs ./next.config.mjs
    # If your config file is .mjs, copy it instead:
    # COPY --from=builder /app/next.config.mjs ./next.config.mjs
    
    # Install only production dependencies
    COPY package-lock.json* ./
    RUN npm ci --omit=dev --no-audit --prefer-offline --legacy-peer-deps
    
    # (Optional) run as non-root for security
    USER node
    
    # App port (Railway uses PORT env automatically)
    ENV PORT=3000
    EXPOSE 3000
    
    CMD ["npm", "start"]
    