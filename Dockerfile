FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs store.mjs ./
COPY public ./public
RUN mkdir data && chown node:node data
USER node
ENV HOST=0.0.0.0 PORT=3080
EXPOSE 3080
CMD ["node", "server.mjs"]
