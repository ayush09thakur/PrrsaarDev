import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface StockQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  price: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
}

export interface StockPrediction {
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral' | string;
  recommendation: 'buy' | 'sell' | 'hold' | string;
  rsi: number;
  sma20: number;
  sma50: number;
  predictions: Array<{ date: string; price: number }>;
}

export interface OHLCVPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

const defaultApiBase = 'http://localhost:3000';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private readonly apiBase: string;
  private readonly watchlistKey = 'stockai_watchlist';

  constructor(private http: HttpClient) {
    // Allow override without rebuilding.
    this.apiBase = (globalThis as any)?.STOCKAI_API_BASE || defaultApiBase;
  }

  getTrendingStocks(): Observable<StockQuote[]> {
    return this.getJson<StockQuote[]>(`${this.apiBase}/api/stocks/trending`).pipe(
      catchError(() => of(this.mockTrending()))
    );
  }

  searchStocks(query: string): Observable<StockSearchResult[]> {
    const q = (query || '').trim();
    if (!q) return of([]);

    return this.getJson<StockSearchResult[]>(
      `${this.apiBase}/api/stocks/search?q=${encodeURIComponent(q)}`
    ).pipe(catchError(() => of(this.mockSearch(q))));
  }

  getStockQuote(symbol: string): Observable<StockQuote> {
    const sym = (symbol || '').trim().toUpperCase();
    return this.getJson<StockQuote>(`${this.apiBase}/api/stocks/${encodeURIComponent(sym)}/quote`).pipe(
      catchError(() => of(this.mockQuote(sym)))
    );
  }

  getStockPrediction(symbol: string): Observable<StockPrediction> {
    const sym = (symbol || '').trim().toUpperCase();
    return this.getJson<StockPrediction>(
      `${this.apiBase}/api/stocks/${encodeURIComponent(sym)}/analysis`
    ).pipe(catchError(() => of(this.mockPrediction(sym))));
  }

  isInWatchlist(symbol: string): boolean {

    const list = this.getWatchlist();
    return list.includes((symbol || '').trim().toUpperCase());
  }

  toggleWatchlist(symbol: string): boolean {
    const sym = (symbol || '').trim().toUpperCase();
    const list = this.getWatchlist();
    const idx = list.indexOf(sym);

    if (idx >= 0) list.splice(idx, 1);
    else list.push(sym);

    this.persistWatchlist(list);
    return list.includes(sym);
  }

  getWatchlist(): string[] {
    try {
      const raw = localStorage.getItem(this.watchlistKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(String)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private persistWatchlist(list: string[]): void {
    try {
      const normalized = list.map(String).map(s => s.trim().toUpperCase()).filter(Boolean);
      localStorage.setItem(this.watchlistKey, JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }

  private getJson<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }
  private mockTrending(): StockQuote[] {
    const trendingSymbols = ['NIFTY50', 'SENSEX', 'AAPL', 'TSLA', 'MSFT', 'NVDA', 'AMZN'];

    return trendingSymbols.map(sym => {
      const q = this.mockQuote(sym);

      return {
        ...q,
        change: (q.change ?? 0) + (Math.random() * 10 - 5),
        changePercent: (q.changePercent ?? 0) + (Math.random() * 4 - 2)
      };
    });
  }

  private mockSearch(q: string): StockSearchResult[] {
    const upper = q.toUpperCase();

    const base: StockSearchResult[] = [
      { symbol: 'NIFTY50', name: 'NIFTY 50', exchange: 'NSE' },
      { symbol: 'SENSEX', name: 'SENSEX', exchange: 'BSE' },

      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
      { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' }
    ];

    const normalizedUpper = upper.replace(/\s+/g, ' ').trim();

    return base
      .filter(x =>
        x.symbol.includes(upper) ||
        x.name.toUpperCase().includes(normalizedUpper) ||
        // Allow natural-language queries
        (x.symbol === 'NIFTY50' && normalizedUpper.includes('NIFTY')) ||
        (x.symbol === 'SENSEX' && normalizedUpper.includes('SENSEX'))
      )
      .slice(0, 8);
  }

  private mockQuote(symbol: string): StockQuote {
    const price = this.seededNumber(symbol, 100, 1000);
    const change = this.seededNumber(symbol + 'd', -8, 8);
    const changePercent = (change / Math.max(price, 1)) * 100;

    return {
      symbol,
      name: `${symbol} Corp.`,
      exchange: 'NASDAQ',
      price,
      change,
      changePercent,
      open: price - this.seededNumber(symbol + 'o', -5, 5),
      high: price + this.seededNumber(symbol + 'h', 0, 12),
      low: price - this.seededNumber(symbol + 'l', 0, 12),
      previousClose: price - this.seededNumber(symbol + 'pc', -4, 4),
      volume: Math.floor(this.seededNumber(symbol + 'v', 1e7, 8e7)),
      marketCap: Math.floor(this.seededNumber(symbol + 'm', 5e10, 2e12)),
      high52w: price + this.seededNumber(symbol + '52h', 0, 80),
      low52w: Math.max(1, price - this.seededNumber(symbol + '52l', 0, 80))
    };
  }

  private mockPrediction(symbol: string): StockPrediction {
    const currentPrice = this.seededNumber(symbol + 'cp', 50, 500);
    const deltaPct = this.seededNumber(symbol + 'dp', -0.12, 0.18);

    const rec = deltaPct > 0.07 ? 'buy' : deltaPct < -0.07 ? 'sell' : 'hold';
    const trend = rec === 'buy' ? 'bullish' : rec === 'sell' ? 'bearish' : 'neutral';

    const targetPrice = currentPrice * (1 + deltaPct);
    const confidence = Math.round(this.seededNumber(symbol + 'c', 45, 88));

    const rsi = Math.round(this.seededNumber(symbol + 'r', 25, 78));
    const sma20 = currentPrice * this.seededNumber(symbol + 's20', 0.94, 1.06);
    const sma50 = currentPrice * this.seededNumber(symbol + 's50', 0.9, 1.1);

    const predictions = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString();
      const drift = (deltaPct * (i + 1)) / 7;
      return { date, price: currentPrice * (1 + drift) };
    });

    return {
      symbol,
      currentPrice,
      targetPrice,
      confidence,
      trend,
      recommendation: rec,
      rsi,
      sma20,
      sma50,
      predictions
    };
  }

  private seededNumber(seed: string, min: number, max: number): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const t = (h >>> 0) / 4294967296;
    return min + (max - min) * t;
  }
}

