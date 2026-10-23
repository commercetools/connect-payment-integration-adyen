FROM node:24.22.1-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY jwt-mock.js .
EXPOSE 9002
CMD ["node", "jwt-mock.js"]
