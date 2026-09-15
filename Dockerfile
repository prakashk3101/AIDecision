FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/vite.config.ts ./vite.config.ts
COPY --chown=node:node --from=build /app/tsconfig.json ./tsconfig.json
COPY --chown=node:node --from=build /app/tsconfig.node.json ./tsconfig.node.json
COPY --chown=node:node --from=build /app/server ./server
COPY --chown=node:node --from=build /app/src ./src

EXPOSE 8080

USER node

CMD ["npm", "start"]