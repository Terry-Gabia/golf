FROM node:20-alpine AS builder

WORKDIR /app/frontend

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/frontend/dist ./dist
COPY server.mjs ./server.mjs

# 서버 의존성 설치 (네이버 OAuth용)
RUN npm init -y && npm install @supabase/supabase-js

EXPOSE 3000

CMD ["node", "server.mjs"]
