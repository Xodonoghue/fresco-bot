# ---------- Builder ----------
  FROM node:20-bookworm-slim AS builder

  # System deps for pdf2pic (gm+gs) and node-canvas (Cairo toolchain)
  RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick ghostscript \
    build-essential python3 pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
  
  WORKDIR /app
  
  # Install ALL deps (including dev) so Next/Tailwind can build
  COPY package*.json ./
  RUN npm ci --legacy-peer-deps
  
  # Copy source and build
  COPY . .
  # (Ensure tsconfig.json is at repo root and copied above)
  RUN npm run build
  
  # Prune dev deps after building to prepare runtime node_modules
  RUN npm prune --omit=dev --legacy-peer-deps
  
  
  # ---------- Runner ----------
  FROM node:20-bookworm-slim AS runner
  
  # Runtime libs only (no compilers). Keep gm + gs for pdf2pic at runtime.
  RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick ghostscript \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
  
  ENV NODE_ENV=production
  ENV PORT=3000
  # Optional: disable Next telemetry in containers
  ENV NEXT_TELEMETRY_DISABLED=1
  
  WORKDIR /app
  
  # Copy minimal runtime artifacts
  COPY --from=builder /app/package*.json ./
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/.next ./.next
  COPY --from=builder /app/public ./public
  # If you have these, harmless to include:
  COPY --from=builder /app/next.config.* ./ 
  
  EXPOSE 3000
  CMD ["npm", "run", "start"]
  