FROM node:20-slim
WORKDIR /app
COPY package.json *.js *.html ./
RUN npm install --production
CMD ["npm", "start"]