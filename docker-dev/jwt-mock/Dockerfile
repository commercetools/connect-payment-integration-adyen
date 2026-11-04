FROM node:24-alpine
WORKDIR /app
COPY package.json .
RUN --mount=type=secret,id=corp_ca \
    NODE_EXTRA_CA_CERTS=/run/secrets/corp_ca npm install --omit=dev
COPY jwt-mock.js .
EXPOSE 9002
CMD ["node", "jwt-mock.js"]
