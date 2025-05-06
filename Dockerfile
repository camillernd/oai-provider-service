FROM node:18-slim

WORKDIR /home/node/app

COPY package*.json /home/node/app/
COPY . /home/node/app/

RUN npm install -g npm@10.8.1

RUN npm ci
RUN npm run compile

CMD ["npm", "start"]

# Étape 1 : builder
# FROM node:18-slim AS builder

# WORKDIR /home/node/app

# COPY package*.json ./
# RUN npm ci

# COPY . .
# RUN npm run compile

# # Étape 2 : runner
# FROM node:18-slim

# WORKDIR /home/node/app

# COPY --from=builder /home/node/app/dist ./dist
# COPY --from=builder /home/node/app/package*.json ./
# COPY --from=builder /home/node/app/production ./production
# COPY --from=builder /home/node/app/public ./public

# RUN npm ci --omit=dev

# ENV NODE_ENV=production
# CMD ["node", "dist/index.js"]
