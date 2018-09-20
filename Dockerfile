FROM node:carbon
WORKDIR /usr/service
RUN npm install -g serverless lerna --unsafe-perm
COPY service/ ./
RUN lerna bootstrap