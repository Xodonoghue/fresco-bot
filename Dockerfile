# Use a Debian-based Node image so sharp prebuilt binaries work cleanly
FROM node:20-bookworm-slim

# Install native deps required by pdf2pic and friends
# - graphicsmagick: image processing backend used by pdf2pic
# - ghostscript: to read PDFs for conversion
# - curl: useful for health/debug
RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick ghostscript ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# App directory
WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy source
COPY . .

# Build (for Next.js etc.)
RUN npm run build --legacy-peer-deps


# Railway provides PORT; Next listens on it in production
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start Next.js
CMD ["npm", "run", "start"]
