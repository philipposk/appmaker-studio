# ── AppMaker frontend ──────────────────────────────────────────
# Stage 1: build the static React bundle
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# CRA bakes REACT_APP_* vars in at build time. Pass the API URL as a
# build arg so the same image can target different backends.
ARG REACT_APP_API_URL=http://localhost:8000/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Don't let ESLint warnings fail the production build (react-scripts treats
# warnings as errors when CI=true, which many build environments set).
ENV CI=false
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
