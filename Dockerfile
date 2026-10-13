FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_URL=http://localhost:4000
ARG VITE_PENDO_API_KEY
ARG VITE_PENDO_CDN_HOST=cdn.pendo.io
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PENDO_API_KEY=$VITE_PENDO_API_KEY
ENV VITE_PENDO_CDN_HOST=$VITE_PENDO_CDN_HOST
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
