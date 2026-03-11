FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json

RUN npm install

COPY . .

WORKDIR /app/apps/backend
EXPOSE 3000

CMD ["npm", "run", "start:dev"]
