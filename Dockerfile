# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable pnpm

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry can be disabled during the build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application (Provide a dummy auth URL to suppress better-auth build warnings)
ENV BETTER_AUTH_URL=http://localhost:3000
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Disable telemetry during runtime
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
