FROM node:22-bookworm-slim AS build

ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run deploy:build
RUN npx playwright install chromium

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8000 \
    PLAYWRIGHT_BROWSERS_PATH=/app/.playwright
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/.playwright ./.playwright

RUN npx playwright install-deps chromium \
    && chown -R node:node /app

USER node
EXPOSE 8000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:production"]
