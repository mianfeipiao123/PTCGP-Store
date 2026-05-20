// Update local data snapshots from the public store API.
// Writes:
//   - prices.json: product list + multi-currency price matrix
//   - product_i18n.json: official localized product/group names

const fs = require('fs');
const https = require('https');
const path = require('path');

const API = 'https://store.pokemontcgpocket.com/api/v1/product/list';
const ROOT = __dirname;
const PRICES_FILE = path.join(ROOT, 'prices.json');
const PRODUCT_I18N_FILE = path.join(ROOT, 'product_i18n.json');

const LOCALES = ['ja-JP', 'en-US', 'fr-FR', 'it-IT', 'de-DE', 'es-ES', 'pt-BR', 'ko-KR', 'zh-TW'];
const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_RETRIES = 2;
const REQUEST_DELAY_MS = Number(process.env.SCRAPE_DELAY_MS || 250);

// One representative IP per currency. The store API is region-priced by IP;
// these values are sent through X-Forwarded-For and have been confirmed for
// the current Xsolla store setup.
const CURRENCY_IPS = {
  JPY: '133.32.0.1',
  USD: '8.8.8.8',
  TWD: '61.219.0.1',
  KRW: '211.108.0.1',
  EUR: '85.214.0.1',
  BRL: '200.160.0.1',
  TRY: '212.58.0.1',
  DKK: '212.27.0.1',
  AUD: '1.1.1.1',
  HKD: '203.198.0.1',
  INR: '203.122.0.1',
  CAD: '24.114.0.1',
  MXN: '200.57.0.1',
  CLP: '200.27.0.1',
  COP: '200.21.0.1',
  PEN: '200.48.0.1',
  GBP: '195.137.0.1',
  CHF: '195.65.0.1',
  SEK: '130.242.80.14',
  NOK: '158.36.0.1',
  PLN: '195.116.0.1',
  CZK: '195.113.0.1',
  HUF: '81.183.0.1',
  RON: '193.226.0.1',
  KZT: '95.59.0.1',
  NZD: '203.97.0.1',
  SGD: '165.21.0.1',
  MYR: '175.136.0.1',
  THB: '110.164.0.1',
  IDR: '36.67.0.1',
  PHP: '203.177.0.1',
  PKR: '203.135.0.1',
  ILS: '192.115.0.1',
  AED: '213.42.0.1',
  SAR: '212.118.128.1',
  QAR: '78.100.0.1',
  EGP: '41.32.0.1',
  ZAR: '196.4.0.1',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function requestJson({ ip, locale }) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (PTCGP-Store data updater)',
      'Accept': 'application/json',
    };
    if (ip) headers['X-Forwarded-For'] = ip;
    if (locale) {
      headers['WEB-STORE-LOCALE'] = locale;
      headers['Accept-Language'] = locale;
    }

    const req = https.request(API, {
      method: 'GET',
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function requestJsonWithRetry(params) {
  let lastError;
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt++) {
    try {
      return await requestJson(params);
    } catch (err) {
      lastError = err;
      if (attempt < REQUEST_RETRIES) {
        await sleep(750 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function flatten(groups) {
  const out = [];
  for (const group of groups || []) {
    for (const product of group.products || []) {
      out.push({
        sku: product.sku,
        id: product.id,
        group: group.group_name,
        name: product.name,
        img: product.img_url,
        bonus: product.bonus || 0,
        extras: (product.extra_items || []).map(extra => ({
          name: extra.name,
          amount: extra.amount,
        })),
        currency: product.price && product.price.currency,
        amount: product.price && product.price.amount,
        amount_without_discount: product.price && product.price.amount_without_discount,
      });
    }
  }
  return out;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = canonical(value[key]);
    return out;
  }, {});
}

function sameData(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function priceComparable(snapshot) {
  if (!snapshot) return null;
  return {
    source: snapshot.source,
    currencies: snapshot.currencies,
    products: snapshot.products,
    prices: snapshot.prices,
  };
}

function writeJsonIfChanged(file, value) {
  const next = JSON.stringify(value, null, 2) + '\n';
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (prev === next) {
    console.log(`unchanged ${path.basename(file)}`);
    return false;
  }
  fs.writeFileSync(file, next);
  console.log(`wrote ${path.basename(file)}`);
  return true;
}

function validateSnapshot(snapshot, previous) {
  if (!snapshot.products.length) {
    throw new Error('Refusing to write: no products returned');
  }
  if (!snapshot.currencies.length) {
    throw new Error('Refusing to write: no currencies returned');
  }
  if (snapshot.errors.length) {
    throw new Error(`Refusing to write: ${snapshot.errors.length} currency request(s) failed`);
  }

  if (previous && previous.products && previous.currencies) {
    const minProducts = Math.max(1, Math.floor(previous.products.length * 0.5));
    const minCurrencies = Math.max(1, Math.floor(previous.currencies.length * 0.75));
    if (snapshot.products.length < minProducts) {
      throw new Error(`Refusing to write: product count dropped from ${previous.products.length} to ${snapshot.products.length}`);
    }
    if (snapshot.currencies.length < minCurrencies) {
      throw new Error(`Refusing to write: currency count dropped from ${previous.currencies.length} to ${snapshot.currencies.length}`);
    }
  }
}

async function buildPriceSnapshot() {
  const products = {};
  const prices = {};
  const errors = [];
  const entries = Object.entries(CURRENCY_IPS);

  for (let i = 0; i < entries.length; i++) {
    const [expectedCurrency, ip] = entries[i];
    process.stdout.write(`[price ${i + 1}/${entries.length}] ${expectedCurrency} via ${ip} ... `);
    try {
      const json = await requestJsonWithRetry({ ip });
      const items = flatten(json);
      const actualCurrency = items[0] && items[0].currency;
      console.log(`got currency=${actualCurrency || 'unknown'} items=${items.length}`);

      if (!items.length) {
        throw new Error('empty product list');
      }
      if (actualCurrency !== expectedCurrency) {
        throw new Error(`expected ${expectedCurrency}, got ${actualCurrency || 'unknown'}`);
      }

      for (const item of items) {
        if (!item.sku || !item.currency || item.amount == null) continue;

        if (!products[item.sku]) {
          products[item.sku] = {
            sku: item.sku,
            id: item.id,
            group: item.group,
            name: item.name,
            img: item.img,
            bonus: item.bonus,
            extras: item.extras,
          };
        }

        if (!prices[item.sku]) prices[item.sku] = {};
        if (prices[item.sku][item.currency] == null) {
          prices[item.sku][item.currency] = Number(item.amount);
        }
      }
    } catch (err) {
      console.log(`FAIL ${err.message}`);
      errors.push({ currency: expectedCurrency, ip, error: err.message });
    }

    if (REQUEST_DELAY_MS > 0 && i < entries.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const allCurrencies = Array.from(
    new Set(Object.values(prices).flatMap(priceMap => Object.keys(priceMap)))
  ).sort();

  return {
    scraped_at: new Date().toISOString(),
    source: API,
    currencies: allCurrencies,
    products: Object.values(products),
    prices,
    errors,
  };
}

async function buildProductI18n(productSkus, previousI18n) {
  const fetched = {};
  const errors = [];
  const localeIp = CURRENCY_IPS.USD;

  for (let i = 0; i < LOCALES.length; i++) {
    const locale = LOCALES[i];
    process.stdout.write(`[i18n ${i + 1}/${LOCALES.length}] ${locale} ... `);
    try {
      const json = await requestJsonWithRetry({ ip: localeIp, locale });
      const items = flatten(json);
      console.log(`items=${items.length}`);

      if (!items.length) {
        throw new Error('empty product list');
      }

      for (const item of items) {
        if (!item.sku || !item.name) continue;
        if (!fetched[item.sku]) fetched[item.sku] = {};
        fetched[item.sku][locale] = {
          name: item.name,
          group_name: item.group || '',
        };
      }
    } catch (err) {
      console.log(`FAIL ${err.message}`);
      errors.push({ locale, error: err.message });
    }

    if (REQUEST_DELAY_MS > 0 && i < LOCALES.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const out = {};
  for (const sku of productSkus) {
    out[sku] = {};
    for (const locale of LOCALES) {
      const fresh = fetched[sku] && fetched[sku][locale];
      const fallback = previousI18n && previousI18n[sku] && previousI18n[sku][locale];
      if (fresh) out[sku][locale] = fresh;
      else if (fallback) out[sku][locale] = fallback;
    }
    if (!Object.keys(out[sku]).length) {
      delete out[sku];
    }
  }

  if (errors.length) {
    const missingLocales = errors.map(e => e.locale).join(', ');
    console.warn(`i18n warnings: kept previous names where possible for ${missingLocales}`);
  }

  return out;
}

(async () => {
  const previousPrices = readJson(PRICES_FILE, null);
  const previousI18n = readJson(PRODUCT_I18N_FILE, {});

  const nextPrices = await buildPriceSnapshot();
  validateSnapshot(nextPrices, previousPrices);

  const productSkus = nextPrices.products.map(product => product.sku);
  const nextI18n = await buildProductI18n(productSkus, previousI18n);

  const pricesChanged = !sameData(priceComparable(previousPrices), priceComparable(nextPrices));
  const i18nChanged = !sameData(previousI18n, nextI18n);
  if (!pricesChanged && !i18nChanged && previousPrices && previousPrices.scraped_at) {
    nextPrices.scraped_at = previousPrices.scraped_at;
    nextPrices.errors = previousPrices.errors || [];
  }

  const wrotePrices = writeJsonIfChanged(PRICES_FILE, nextPrices);
  const wroteI18n = writeJsonIfChanged(PRODUCT_I18N_FILE, nextI18n);

  console.log(`\nDone. products=${nextPrices.products.length} currencies=${nextPrices.currencies.length} priceErrors=${nextPrices.errors.length}`);
  console.log(wrotePrices || wroteI18n ? 'Data files changed.' : 'No data changes.');
})().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
