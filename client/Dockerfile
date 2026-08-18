
FROM node:20-alpine AS build

ARG VITE_SERVER
ARG VITE_API_SUFFIX=/api/v1
ENV VITE_SERVER=$VITE_SERVER
ENV VITE_API_SUFFIX=$VITE_API_SUFFIX

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
        npm ci --no-audit --no-fund; \
    else \
        npm install --no-audit --no-fund; \
    fi

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
