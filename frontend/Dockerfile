FROM node:24.22.3-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_BACKEND_BASE_URL=/api/v1
ENV VITE_BACKEND_BASE_URL=${VITE_BACKEND_BASE_URL}
RUN npm run build && npm run check:bundle

FROM nginx/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
