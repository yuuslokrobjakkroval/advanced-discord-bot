FROM oven/bun:1.3.14-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN bun install

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const r=await fetch('http://127.0.0.1:3000/health');process.exit(r.ok?0:1)"
CMD ["bun", "dist/index.js"]
