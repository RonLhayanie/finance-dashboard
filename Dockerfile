FROM node:22-bookworm

# התקנת Chrome היציב ישירות מהמאגר של Google
RUN apt-get update && apt-get install -y wget gnupg ca-certificates --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# חסימת Puppeteer מלהוריד כרום שבור בעצמו
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci --prefix client && npm run build --prefix client
RUN npm ci --prefix server

ENV NODE_ENV=production
# כפייה על Puppeteer להשתמש בכרום המלא של מערכת ההפעלה
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 3000

CMD ["npm", "start", "--prefix", "server"]