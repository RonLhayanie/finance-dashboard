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
  // Native identifier (Asmachta) is stable and authoritative when the bank
  // supplies one - always prefer it over the fallback hash below.
  if (txn.identifier !== undefined && txn.identifier !== null && txn.identifier !== '') {
    return String(txn.identifier);
  }
  // Fallback hash, used when the scraper gives no native identifier. Every
  // field below is included because it can genuinely differ between two
  // distinct same-day, same-amount, same-merchant transactions:
  //   - processedDate: settlement date, separate from the transaction date
  //   - originalCurrency: disambiguates a foreign-currency charge from a
  //     same-amount ILS charge
  //   - memo: free-text note the bank/cardholder attaches, often the only
  //     thing distinguishing two otherwise-identical charges
  //   - type: 'normal' vs 'installments'
  //   - installments.number: which installment, for installment purchases
  // Every field here is STABLE across re-syncs (unchanged between scrapes of
  // the same transaction). Do not add anything volatile (e.g. a running
  // index or a value that can shift on re-fetch) - that would change the
  // hash on the next sync and create a duplicate row instead of matching
  // the existing one, which is the opposite failure from what this fixes.
  return crypto
    .createHash('sha256')
    .update(
      `${txn.date}|${txn.processedDate ?? ''}|${txn.chargedAmount}|` +
        `${txn.originalCurrency ?? ''}|${txn.description}|${txn.memo ?? ''}|` +
        `${txn.type ?? ''}|${txn.installments?.number ?? ''}`
    )
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
