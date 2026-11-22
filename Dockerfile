FROM node:22-alpine AS web-build
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
FROM node:22-alpine AS api-build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/ ./
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine
ENV NODE_ENV=production WEB_ROOT=/app/public PORT=8080
WORKDIR /app
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/dist ./dist
COPY --from=web-build /app/out ./public
USER node
EXPOSE 8080
CMD ["node","dist/main.js"]
