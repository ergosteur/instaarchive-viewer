# Stage 1: Build
FROM node:20-slim AS build

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build (frontend and server)
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim AS runtime

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV ARCHIVES_DIR=/archives
# Where the archive index is persisted; mount a volume here so a restart does
# not have to re-walk the whole archive root.
ENV CACHE_DIR=/cache

WORKDIR /app

# Install runtime dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets and server. The whole dist-server tree is needed: the
# server imports shared archive-grouping logic emitted alongside it.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server/ ./

# Ensure archives and cache directories exist, writable by the runtime user.
RUN mkdir -p /archives /cache && chown node:node /cache

# Drop root: the server reads the archives volume and writes only its index.
USER node

EXPOSE 3000

# Start server
CMD ["node", "server.js"]
