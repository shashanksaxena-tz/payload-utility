FROM node:18-alpine

WORKDIR /app

# Copy root project (SDK source + build config)
COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/

# Install SDK dependencies and build
RUN npm ci --ignore-scripts && npm run build

# Copy dashboard
COPY dashboard/package.json ./dashboard/
RUN cd dashboard && npm install --production

COPY dashboard/ ./dashboard/

EXPOSE 3000

WORKDIR /app/dashboard
CMD ["node", "server.js"]
