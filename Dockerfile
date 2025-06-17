FROM node:20-slim

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install only production dependencies
RUN npm install express --save

# Copy the render server
COPY render-server.js ./

# Expose port (Render will override this)
EXPOSE 10000

# Start the server directly
CMD ["node", "render-server.js"]