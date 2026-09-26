FROM ghcr.io/puppeteer/puppeteer:22

# מעבר למשתמש root להתקנות והרשאות
USER root

WORKDIR /app

# העתקת קבצי הפרויקט
COPY . .

# התקנת תלויות ובילד לקליינט ולסרבר
RUN npm ci --prefix client && npm run build --prefix client
RUN npm ci --prefix server

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 3000

CMD ["npm", "start", "--prefix", "server"]