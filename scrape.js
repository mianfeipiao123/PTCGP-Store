// One-shot scraper: hit /api/v1/product/list once per currency
// (by sending X-Forwarded-For of a representative IP for each currency),
// merge into a {sku -> {currency -> amount}} matrix, and write prices.json.

const fs = require('fs');
const https = require('https');

const API = 'https://store.pokemontcgpocket.com/api/v1/product/list';

// One representative IP per currency we already confirmed exists.
// Pulled from the earlier geo-probe rounds; each IP reliably returns that currency.
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
  GBP: '212.58.0.1',          // overridden via Accept-Language? actually 212.58 returned TRY above
  CHF: '195.65.0.1',
  SEK: '192.36.0.5',
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
  IDR: '202.155.0.1',
  PHP: '203.177.0.1',
  PKR: '203.135.0.1',
  ILS: '192.115.0.1',
  AED: '213.42.0.1',
  SAR: '212.118.0.1',
  QAR: '78.100.0.1',
  EGP: '41.32.0.1',
  ZAR: '196.4.0.1',
};

// The GBP case is tricky: we earlier saw 212.58.0.1 (UK BBC) judged as TR.
// Override with a known UK ISP block that returned GBP in our final pass.
CURRENCY_IPS.GBP = '195.137.0.1'; // returned GBP in a probe (Kyrgyz alias, but Xsolla GeoIP maps it to GBP)

function fetchOnce(ip) {
  return new Promise((resolve, reject) => {
    const req = https.request(API, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (price-comparator)',
        'X-Forwarded-For': ip,
        'Accept': 'application/json',
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function flatten(groups) {
  // groups: [{ group_id, group_name, products: [...] }, ...]
  const out = [];
  for (const g of groups || []) {
    for (const p of g.products || []) {
      out.push({
        sku: p.sku,
        id: p.id,
        group: g.group_name,
        name: p.name,
        img: p.img_url,
        bonus: p.bonus || 0,
        extras: (p.extra_items || []).map(e => ({ name: e.name, amount: e.amount })),
        currency: p.price?.currency,
        amount: p.price?.amount,
        amount_without_discount: p.price?.amount_without_discount,
      });
    }
  }
  return out;
}

(async () => {
  const products = {};   // sku -> base info
  const prices = {};     // sku -> { currency -> amount }
  const errors = [];

  const entries = Object.entries(CURRENCY_IPS);
  for (let i = 0; i < entries.length; i++) {
    const [expectedCurrency, ip] = entries[i];
    process.stdout.write(`[${i + 1}/${entries.length}] ${expectedCurrency} via ${ip} ... `);
    try {
      const json = await fetchOnce(ip);
      const items = flatten(json);
      let actualCurrency = items[0]?.currency || null;
      console.log(`got currency=${actualCurrency} items=${items.length}`);

      for (const it of items) {
        if (!it.sku || !it.currency || it.amount == null) continue;
        if (!products[it.sku]) {
          products[it.sku] = {
            sku: it.sku,
            id: it.id,
            group: it.group,
            name: it.name,
            img: it.img,
            bonus: it.bonus,
            extras: it.extras,
          };
        }
        if (!prices[it.sku]) prices[it.sku] = {};
        // store one price per currency; if multiple IPs map to same currency, keep first
        if (prices[it.sku][it.currency] == null) {
          prices[it.sku][it.currency] = Number(it.amount);
        }
      }
    } catch (e) {
      console.log(`FAIL ${e.message}`);
      errors.push({ currency: expectedCurrency, ip, error: e.message });
    }
  }

  const allCurrencies = Array.from(
    new Set(Object.values(prices).flatMap(o => Object.keys(o)))
  ).sort();

  const out = {
    scraped_at: new Date().toISOString(),
    source: API,
    currencies: allCurrencies,
    products: Object.values(products),
    prices,        // { sku: { currency: amount } }
    errors,
  };
  fs.writeFileSync('prices.json', JSON.stringify(out, null, 2));
  console.log(`\nWrote prices.json: ${Object.keys(products).length} products × ${allCurrencies.length} currencies`);
  if (errors.length) console.log(`Errors: ${errors.length}`);
})();
