# Use Node 18 base image
FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache dumb-init openssl libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Create directories
RUN mkdir -p tmp/uploads tmp/extracted logs

# Expose ports
EXPOSE 3000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start application with database setup
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && node dist/src/server.js"]