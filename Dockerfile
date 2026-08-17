# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- build ----
FROM node:24-alpine AS build

WORKDIR /app

# better-sqlite3 ships prebuilds for common platforms but falls back to
# node-gyp; these let that fallback succeed rather than failing the image.
RUN apk add --no-cache python3 make g++

# Dependencies are their own layer so application edits do not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The committed dataset is what gets built. The ETL is deliberately NOT run
# here: it needs the source workbook and a populated geocode cache, and
# re-running it during a deploy would let a rebuild silently change the data.
RUN npm run build

# ----------------------------------------------------------------- serve ----
FROM nginx:1.29-alpine AS runtime

# Replace the stock config wholesale: ours keeps every writable path in /tmp so
# the container runs unprivileged on a read-only root filesystem.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/site.conf /etc/nginx/conf.d/dashboard.conf

COPY --from=build /app/dist /usr/share/nginx/html

# The stock entrypoint rewrites config as root before dropping privileges; this
# image is already in its final state, so nginx is invoked directly.
ENTRYPOINT []

# Numeric uid rather than a name, so orchestrators that enforce
# runAsNonRoot can verify it without resolving /etc/passwd.
USER 101
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
