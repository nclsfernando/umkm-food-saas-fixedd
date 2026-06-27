FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install
COPY . .
ARG CACHEBUST=1
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build