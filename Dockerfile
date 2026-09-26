FROM node:22-slim

# התקנת כלי בסיס להתקנת תלויות הדפדפן
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# העתקת קבצי הפרויקט
COPY . .

# התקנת תלויות ובילד
RUN npm ci --prefix client && npm run build --prefix client
RUN npm ci --prefix server

# התקנה אוטומטית של כל ספריות המערכת ש-Puppeteer דורש עבור Chrome
RUN npx --prefix server puppeteer browsers install chrome --install-deps

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start", "--prefix", "server"]