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

WORKDIR /app

# Install runtime dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets and server
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server/server.js ./server.js

# Ensure archives directory exists
RUN mkdir -p /archives

EXPOSE 3000

# Start server
CMD ["node", "server.js"]
