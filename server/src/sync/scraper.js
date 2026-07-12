const crypto = require('crypto');
const { createScraper, CompanyTypes, SCRAPERS } = require('israeli-bank-scrapers');

const PROVIDER_TO_COMPANY = {
  leumi: CompanyTypes.leumi,
  hapoalim: CompanyTypes.hapoalim,
  discount: CompanyTypes.discount,
  max: CompanyTypes.max,
  isracard: CompanyTypes.isracard,
  visaCal: CompanyTypes.visaCal,
};

function twelveMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d;
}

function externalIdFor(txn) {
  if (txn.identifier !== undefined && txn.identifier !== null && txn.identifier !== '') {
    return String(txn.identifier);
  }
  return crypto
    .createHash('sha256')
    .update(`${txn.date}|${txn.chargedAmount}|${txn.description}`)
    .digest('hex');
}

async function runScrape({ provider, credentials, startDate, otpRetriever }) {
  const companyId = PROVIDER_TO_COMPANY[provider];
  if (!companyId) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const scraperCredentials = { ...credentials };
  // Generic OTP wiring: only providers whose declared login fields include
  // 'otpCodeRetriever' (per SCRAPERS metadata) get the hook attached. Leumi's
  // fields are just ['username', 'password'], so this stays dormant for it.
  if (otpRetriever && SCRAPERS[companyId].loginFields.includes('otpCodeRetriever')) {
    scraperCredentials.otpCodeRetriever = otpRetriever;
  }

  const scraper = createScraper({
    companyId,
    startDate: startDate || twelveMonthsAgo(),
    showBrowser: false,
    verbose: false,
    timeout: 60000,
    defaultTimeout: 60000,
  });

  const result = await scraper.scrape(scraperCredentials);

  if (!result.success) {
    throw new Error(`Scrape failed [${result.errorType}]: ${result.errorMessage}`);
  }

  const accounts = (result.accounts || []).map((account) => ({
    accountNumber: account.accountNumber,
    txns: account.txns
      .filter((txn) => txn.status === 'completed')
      .map((txn) => ({
        externalId: externalIdFor(txn),
        date: new Date(txn.date).toISOString(),
        amount: txn.chargedAmount,
        currency: txn.originalCurrency || 'ILS',
        description: txn.description,
        status: txn.status,
      })),
  }));

  return { accounts };
}

module.exports = { runScrape, PROVIDER_TO_COMPANY };
