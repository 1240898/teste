FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node index.js ./index.js
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts/database.js ./scripts/database.js
COPY --chown=node:node assets ./assets

USER node
EXPOSE 3000
CMD ["node", "index.js"]
