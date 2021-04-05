FROM node:14
WORKDIR /src

COPY package.json yarn.lock ./
RUN yarn --pure-lockfile

COPY . .

CMD ["node", "index.js"]
