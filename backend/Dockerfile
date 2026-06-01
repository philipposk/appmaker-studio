# ── AppMaker backend ───────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install production deps only, using the lockfile for reproducibility.
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

# Container-level health check hits the API's /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||8000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
