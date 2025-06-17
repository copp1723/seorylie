FROM node:20-slim
WORKDIR /app
COPY package.json index.js setup-db.js ./
RUN npm install --production
CMD ["node", "index.js"]