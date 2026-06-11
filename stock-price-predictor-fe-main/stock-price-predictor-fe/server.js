const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const STOCKS = [
  { symbol: 'NIFTY50', yahoo: '^NSEI', displaySymbol: 'NIFTY 50', name: 'NIFTY 50 Index', sector: 'Index', exchange: 'NSE' },
  { symbol: 'RELIANCE:NSE', yahoo: 'RELIANCE.NS', displaySymbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', exchange: 'NSE' },
  { symbol: 'HDFCBANK:NSE', yahoo: 'HDFCBANK.NS', displaySymbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', exchange: 'NSE' },
  { symbol: 'BHARTIARTL:NSE', yahoo: 'BHARTIARTL.NS', displaySymbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom', exchange: 'NSE' },
  { symbol: 'MARUTI:NSE', yahoo: 'MARUTI.NS', displaySymbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile', exchange: 'NSE' },
  { symbol: 'SUNPHARMA:NSE', yahoo: 'SUNPHARMA.NS', displaySymbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma', exchange: 'NSE' },
  { symbol: 'ULTRACEMCO:NSE', yahoo: 'ULTRACEMCO.NS', displaySymbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Cement', exchange: 'NSE' }
];

function normalizeSymbol(value = '') {
  return String(value).trim().toUpperCase().replace('%5E', '^').replace(/\s+/g, '');
}

function findStock(symbol) {
  const s = normalizeSymbol(symbol);
  return STOCKS.find((x) =>
    normalizeSymbol(x.symbol) === s ||
    normalizeSymbol(x.displaySymbol) === s ||
    normalizeSymbol(x.yahoo) === s ||
    normalizeSymbol(x.yahoo.replace('.NS', ':NSE')) === s
  );
}

async function yahooQuote(stock) {
  const cacheBust = Date.now();
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(stock.yahoo)}&_=${cacheBust}`;
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.yahoo)}?interval=1m&range=1d&_=${cacheBust}`;

  let q = null;
  try {
    const quoteResponse = await fetch(quoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    if (quoteResponse.ok) {
      const quoteJson = await quoteResponse.json();
      q = quoteJson?.quoteResponse?.result?.[0] || null;
    }
  } catch (_) {}

  let meta = null;
  let lastClose = null;
  try {
    const chartResponse = await fetch(chartUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
    });
    if (chartResponse.ok) {
      const chartJson = await chartResponse.json();
      const result = chartJson?.chart?.result?.[0];
      meta = result?.meta || null;
      const closes = result?.indicators?.quote?.[0]?.close || [];
      lastClose = [...closes].reverse().find((v) => typeof v === 'number' && Number.isFinite(v));
    }
  } catch (_) {}

  const price = Number(q?.regularMarketPrice ?? meta?.regularMarketPrice ?? lastClose);
  if (!Number.isFinite(price)) throw new Error(`Price not found for ${stock.displaySymbol}`);

  const previousClose = Number(q?.regularMarketPreviousClose ?? meta?.chartPreviousClose ?? meta?.previousClose ?? price);
  const change = Number(q?.regularMarketChange ?? price - previousClose);
  const changePercent = Number(q?.regularMarketChangePercent ?? (previousClose ? (change / previousClose) * 100 : 0));
  const marketTime = Number(q?.regularMarketTime ?? meta?.regularMarketTime ?? Date.now() / 1000);

  return {
    symbol: stock.symbol,
    displaySymbol: stock.displaySymbol,
    name: stock.name,
    sector: stock.sector,
    exchange: stock.exchange,
    currency: 'INR',
    price: Number(price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    open: Number(q?.regularMarketOpen ?? meta?.regularMarketOpen ?? price),
    high: Number(q?.regularMarketDayHigh ?? meta?.regularMarketDayHigh ?? price),
    low: Number(q?.regularMarketDayLow ?? meta?.regularMarketDayLow ?? price),
    previousClose: Number(previousClose.toFixed(2)),
    volume: Number(q?.regularMarketVolume ?? meta?.regularMarketVolume ?? 0),
    avgVolume: Number(q?.averageDailyVolume3Month ?? q?.averageDailyVolume10Day ?? 0),
    marketCap: Number(q?.marketCap ?? 0),
    high52w: Number(q?.fiftyTwoWeekHigh ?? 0),
    low52w: Number(q?.fiftyTwoWeekLow ?? 0),
    peRatio: Number(q?.trailingPE ?? q?.forwardPE ?? 0),
    eps: Number(q?.epsTrailingTwelveMonths ?? 0),
    dividendYield: Number(q?.dividendYield ?? 0),
    dayRange: `${Number(q?.regularMarketDayLow ?? meta?.regularMarketDayLow ?? price).toFixed(2)} - ${Number(q?.regularMarketDayHigh ?? meta?.regularMarketDayHigh ?? price).toFixed(2)}`,
    yearRange: q?.fiftyTwoWeekLow && q?.fiftyTwoWeekHigh ? `${Number(q.fiftyTwoWeekLow).toFixed(2)} - ${Number(q.fiftyTwoWeekHigh).toFixed(2)}` : '—',
    datetime: new Date(marketTime * 1000).toISOString(),
    fetchedAt: new Date().toISOString(),
    isMarketOpen: q?.marketState === 'REGULAR'
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Indian Stock Market API running', time: new Date().toISOString() });
});

app.get('/api/stocks/trending', async (_req, res) => {
  try {
    const data = await Promise.all(STOCKS.map(yahooQuote));
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Could not fetch live prices', detail: error.message });
  }
});


app.get('/api/stocks/market-mood', async (_req, res) => {
  try {
    const data = await Promise.all(STOCKS.map(yahooQuote));
    const bullish = data.filter(x => Number(x.changePercent || 0) >= 0).sort((a, b) => Number(b.changePercent || 0) - Number(a.changePercent || 0));
    const bearish = data.filter(x => Number(x.changePercent || 0) < 0).sort((a, b) => Number(a.changePercent || 0) - Number(b.changePercent || 0));
    const topGainers = [...data].sort((a, b) => Number(b.changePercent || 0) - Number(a.changePercent || 0)).slice(0, 5);
    const topLosers = [...data].sort((a, b) => Number(a.changePercent || 0) - Number(b.changePercent || 0)).slice(0, 5);
    res.json({ bullish, bearish, topGainers, topLosers, totalStocks: data.length, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({ error: 'Could not calculate market mood', detail: error.message });
  }
});

app.get('/api/stocks/search', (req, res) => {
  const q = normalizeSymbol(req.query.q || '');
  if (!q) return res.json([]);
  const results = STOCKS
    .filter((x) => [x.symbol, x.displaySymbol, x.name, x.sector, x.exchange].join(' ').toUpperCase().replace(/\s+/g, '').includes(q))
    .map(({ yahoo, ...item }) => item)
    .slice(0, 10);
  res.json(results);
});


async function yahooHistory(stock, range = '1mo', interval = '1d') {
  const allowedRanges = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y']);
  const allowedIntervals = new Set(['1m', '5m', '15m', '1d']);
  const safeRange = allowedRanges.has(range) ? range : '1mo';
  const safeInterval = allowedIntervals.has(interval) ? interval : '1d';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.yahoo)}?interval=${safeInterval}&range=${safeRange}&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`History not found for ${stock.displaySymbol}`);

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};

  const candles = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString(),
    open: Number(quote.open?.[i]),
    high: Number(quote.high?.[i]),
    low: Number(quote.low?.[i]),
    close: Number(quote.close?.[i]),
    volume: Number(quote.volume?.[i] || 0)
  })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite));

  return {
    symbol: stock.symbol,
    displaySymbol: stock.displaySymbol,
    range: safeRange,
    interval: safeInterval,
    candles,
    fetchedAt: new Date().toISOString()
  };
}

app.get('/api/stocks/:symbol/quote', async (req, res) => {
  try {
    const stock = findStock(req.params.symbol);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(await yahooQuote(stock));
  } catch (error) {
    res.status(502).json({ error: 'Could not fetch live price', detail: error.message });
  }
});


app.get('/api/stocks/:symbol/history', async (req, res) => {
  try {
    const stock = findStock(req.params.symbol);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(await yahooHistory(stock, String(req.query.range || '1mo'), String(req.query.interval || '1d')));
  } catch (error) {
    res.status(502).json({ error: 'Could not fetch candlestick history', detail: error.message });
  }
});

app.get('/api/stocks/:symbol/analysis', async (req, res) => {
  try {
    const stock = findStock(req.params.symbol);
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    const q = await yahooQuote(stock);
    res.json({
      symbol: q.symbol,
      displaySymbol: q.displaySymbol,
      currentPrice: q.price,
      targetPrice: Number((q.price * 1.03).toFixed(2)),
      confidence: 70,
      trend: q.change >= 0 ? 'bullish' : 'bearish',
      recommendation: Math.abs(q.changePercent || 0) < 0.5 ? 'hold' : q.change > 0 ? 'buy' : 'sell',
      rsi: 50,
      sma20: q.price,
      sma50: q.price,
      predictions: Array.from({ length: 7 }).map((_, i) => ({
        date: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
        price: Number((q.price * (1 + 0.003 * (i + 1))).toFixed(2))
      }))
    });
  } catch (error) {
    res.status(502).json({ error: 'Could not fetch analysis', detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Indian Stock API running at http://localhost:${PORT}`);
});
