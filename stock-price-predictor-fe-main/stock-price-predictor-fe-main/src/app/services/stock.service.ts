import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface StockQuote {
  symbol: string;
  displaySymbol?: string;
  name?: string;
  sector?: string;
  exchange?: string;
  currency?: string;
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
  datetime?: string;
  fetchedAt?: string;
  isMarketOpen?: boolean;
  avgVolume?: number;
  peRatio?: number;
  eps?: number;
  dividendYield?: number;
  dayRange?: string;
  yearRange?: string;
}

export interface StockPrediction {
  symbol: string;
  displaySymbol?: string;
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

export interface MarketMood {
  bullish: StockQuote[];
  bearish: StockQuote[];
  topGainers: StockQuote[];
  topLosers: StockQuote[];
  totalStocks: number;
}

export interface StockSearchResult {
  symbol: string;
  displaySymbol?: string;
  name: string;
  sector?: string;
  exchange: string;
}

const defaultApiBase = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly apiBase: string;
  private readonly watchlistKey = 'stockai_watchlist';

  constructor(private http: HttpClient) {
    this.apiBase = (globalThis as any)?.STOCKAI_API_BASE || defaultApiBase;
  }

  getTrendingStocks(): Observable<StockQuote[]> {
    return this.http.get<StockQuote[]>(`${this.apiBase}/api/stocks/trending?t=${Date.now()}`);
  }

  getMarketMood(): Observable<MarketMood> {
    return this.http.get<MarketMood>(`${this.apiBase}/api/stocks/market-mood?t=${Date.now()}`);
  }

  searchStocks(query: string): Observable<StockSearchResult[]> {
    const q = (query || '').trim();
    return this.http.get<StockSearchResult[]>(`${this.apiBase}/api/stocks/search?q=${encodeURIComponent(q)}&t=${Date.now()}`);
  }

  getStockQuote(symbol: string): Observable<StockQuote> {
    const sym = (symbol || '').trim().toUpperCase();
    return this.http.get<StockQuote>(`${this.apiBase}/api/stocks/${encodeURIComponent(sym)}/quote?t=${Date.now()}`);
  }

  getStockHistory(symbol: string, range = '1mo', intervalValue = '1d'): Observable<{ candles: OHLCVPoint[] }> {
    const sym = (symbol || '').trim().toUpperCase();
    return this.http.get<{ candles: OHLCVPoint[] }>(
      `${this.apiBase}/api/stocks/${encodeURIComponent(sym)}/history?range=${range}&interval=${intervalValue}&t=${Date.now()}`
    );
  }

  private normalizeCandleDate(rawDate: string): string {
    const trimmed = rawDate.trim();
    if (!trimmed) return trimmed;
    const normalized = trimmed.replace(' ', 'T');
    return normalized;
  }

  getStockPrediction(symbol: string): Observable<StockPrediction> {
    const sym = (symbol || '').trim().toUpperCase();
    return this.http.get<StockPrediction>(`${this.apiBase}/api/stocks/${encodeURIComponent(sym)}/analysis?t=${Date.now()}`);
  }

  isInWatchlist(symbol: string): boolean {
    return this.getWatchlist().includes((symbol || '').trim().toUpperCase());
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
      return parsed.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private persistWatchlist(list: string[]): void {
    try {
      localStorage.setItem(this.watchlistKey, JSON.stringify(list.map(String).map((s) => s.trim().toUpperCase()).filter(Boolean)));
    } catch {}
  }
}
