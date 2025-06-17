FROM node:20-slim
WORKDIR /app
COPY package.json index.js setup-db.js chat.html ./
RUN npm install --production
CMD ["node", "index.js"]