# ---- Etapa 1: build ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Las variables VITE_* se inyectan en tiempo de build (Vite las incrusta en el
# bundle final). Se pasan como build args desde docker-compose.yml, que a su
# vez las toma del mismo .env central del backend (api-bridge/secrets/.env) o
# de las que agregues ahí — así se mantiene un solo lugar de configuración
# para todo el stack, igual que con api-bridge/api-worker.
ARG VITE_API_BASE_URL
ARG VITE_SIGNALR_HUB_URL
ARG VITE_GOOGLE_API_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_USE_MOCK_DATA=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SIGNALR_HUB_URL=$VITE_SIGNALR_HUB_URL \
    VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_USE_MOCK_DATA=$VITE_USE_MOCK_DATA

RUN npm run build

# ---- Etapa 2: servir con nginx ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
