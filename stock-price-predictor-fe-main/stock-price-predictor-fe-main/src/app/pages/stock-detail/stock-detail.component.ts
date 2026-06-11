import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, interval, startWith, switchMap, catchError, of, takeUntil } from 'rxjs';

import {
  StockService,
  StockQuote,
  StockPrediction,
  OHLCVPoint
} from '../../services/stock.service';

declare const Plotly: any;

type SignalType = 'BUY' | 'HOLD' | 'SELL';

interface PortfolioPosition {
  buyPrice: number | null;
  quantity: number | null;
}

interface PriceAlert {
  symbol: string;
  target: number;
  direction: 'above' | 'below';
  createdAt: string;
  triggered?: boolean;
}

@Component({
  selector: 'app-stock-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './stock-detail.component.html',
  styleUrl: './stock-detail.component.css'
})
export class StockDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  symbol = '';
  loading = false;
  error = '';
  selectedRange = '1mo';
  selectedInterval = '1d';

  quote: StockQuote | null = null;
  prediction: StockPrediction | null = null;
  history: OHLCVPoint[] = [];

  portfolio: PortfolioPosition = { buyPrice: null, quantity: null };
  alertTarget: number | null = null;
  alertDirection: 'above' | 'below' = 'above';
  alerts: PriceAlert[] = [];
  alertMessage = '';

  @ViewChild('candlestickChart') candlestickChart!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private plotlyLoaded = false;
  private viewReady = false;

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const symbol = params.get('symbol') || 'NIFTY50';

      if (symbol !== this.symbol) {
        this.symbol = symbol;
        this.loadSavedPortfolio();
        this.loadAlerts();
        this.startAutoRefresh();
        this.loadPrediction();
        this.loadHistory();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadPlotly().then(() => this.renderCandlestick());
  }

  startAutoRefresh(): void {
    this.loading = true;
    this.error = '';

    interval(10000).pipe(
      startWith(0),
      switchMap(() =>
        this.stockService.getStockQuote(this.symbol).pipe(
          catchError(() => {
            this.error = 'Backend is not running. Start it with: npm run api';
            this.loading = false;
            return of(null as any);
          })
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe((data: StockQuote | null) => {
      if (!data) return;

      this.quote = data;
      this.loading = false;
      this.checkAlerts();
    });
  }

  loadPrediction(): void {
    this.stockService.getStockPrediction(this.symbol)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => this.prediction = data,
        error: () => {}
      });
  }

  loadHistory(): void {
    this.stockService.getStockHistory(
      this.symbol,
      this.selectedRange,
      this.selectedInterval
    )
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: data => {
        this.history = data?.candles || [];

        if (!this.history.length) {
          this.error = 'No historical candle data is available for this symbol.';
          return;
        }

        this.error = '';
        this.loadPlotly()
          .then(() => this.renderCandlestick())
          .catch(() => {
            this.error = 'Failed to load chart library. Please refresh the page.';
          });
      },
      error: () => {
        this.error = 'Failed to fetch historical chart data from the backend.';
      }
    });
  }

  changeRange(range: string, interval: string): void {
    this.selectedRange = range;
    this.selectedInterval = interval;
    this.loadHistory();
  }

  get aiScore(): number {
    let score = 50;
    const changePercent = Number(this.quote?.changePercent || 0);
    const price = Number(this.quote?.price || 0);
    const rsi = Number(this.prediction?.rsi || 50);
    const sma20 = Number(this.prediction?.sma20 || price);
    const sma50 = Number(this.prediction?.sma50 || price);

    if (changePercent > 0) score += Math.min(15, changePercent * 2);
    if (changePercent < 0) score += Math.max(-15, changePercent * 2);
    if (price && sma20 && price > sma20) score += 10;
    if (price && sma50 && price > sma50) score += 10;
    if (sma20 && sma50 && sma20 > sma50) score += 8;
    if (rsi >= 45 && rsi <= 65) score += 7;
    if (rsi > 75) score -= 10;
    if (rsi < 35) score -= 8;
    if (this.prediction?.trend?.toLowerCase() === 'bullish') score += 8;
    if (this.prediction?.trend?.toLowerCase() === 'bearish') score -= 8;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  get signal(): SignalType {
    if (this.aiScore >= 70) return 'BUY';
    if (this.aiScore <= 40) return 'SELL';
    return 'HOLD';
  }

  get signalClass(): string {
    return this.signal.toLowerCase();
  }

  get aiReason(): string {
    const price = Number(this.quote?.price || 0);
    const sma20 = Number(this.prediction?.sma20 || price);
    const sma50 = Number(this.prediction?.sma50 || price);
    const changePercent = Number(this.quote?.changePercent || 0);

    if (this.signal === 'BUY') {
      return 'Price momentum is positive and the AI score is strong, so this stock is looking bullish right now.';
    }
    if (this.signal === 'SELL') {
      return 'Momentum is weak or risk is high, so the system is showing a cautious sell signal.';
    }
    if (price > sma20 && sma20 >= sma50 && changePercent >= 0) {
      return 'The stock is stable with positive trend support, but the signal is not strong enough for a direct buy.';
    }
    return 'The stock is in a mixed zone, so holding and watching the next movement is safer.';
  }

  get portfolioValue(): number {
    return Number(this.quote?.price || 0) * Number(this.portfolio.quantity || 0);
  }

  get investedAmount(): number {
    return Number(this.portfolio.buyPrice || 0) * Number(this.portfolio.quantity || 0);
  }

  get profitLoss(): number {
    return this.portfolioValue - this.investedAmount;
  }

  get profitLossPercent(): number {
    return this.investedAmount ? (this.profitLoss / this.investedAmount) * 100 : 0;
  }

  savePortfolio(): void {
    this.safeSet(`portfolio_${this.symbol}`, JSON.stringify(this.portfolio));
  }

  resetPortfolio(): void {
    this.portfolio = { buyPrice: null, quantity: null };
    this.safeRemove(`portfolio_${this.symbol}`);
  }

  addAlert(): void {
    const target = Number(this.alertTarget || 0);
    if (!target || target <= 0) {
      this.alertMessage = 'Enter a valid alert price.';
      return;
    }

    this.alerts.unshift({
      symbol: this.symbol,
      target,
      direction: this.alertDirection,
      createdAt: new Date().toISOString(),
      triggered: false
    });

    this.alertTarget = null;
    this.alertMessage = 'Price alert saved successfully.';
    this.saveAlerts();
    this.checkAlerts();
  }

  removeAlert(index: number): void {
    this.alerts.splice(index, 1);
    this.saveAlerts();
  }

  private checkAlerts(): void {
    const price = Number(this.quote?.price || 0);
    if (!price || !this.alerts.length) return;

    let changed = false;
    for (const item of this.alerts) {
      const hit = item.direction === 'above' ? price >= item.target : price <= item.target;
      if (hit && !item.triggered) {
        item.triggered = true;
        this.alertMessage = `${item.symbol} alert hit: price is ${this.formatMoney(price)}.`;
        changed = true;
      }
    }

    if (changed) this.saveAlerts();
  }

  private loadSavedPortfolio(): void {
    const raw = this.safeGet(`portfolio_${this.symbol}`);
    if (!raw) {
      this.portfolio = { buyPrice: null, quantity: null };
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.portfolio = {
        buyPrice: parsed?.buyPrice ?? null,
        quantity: parsed?.quantity ?? null
      };
    } catch {
      this.portfolio = { buyPrice: null, quantity: null };
    }
  }

  private loadAlerts(): void {
    try {
      const parsed = JSON.parse(this.safeGet('stock_price_alerts') || '[]');
      this.alerts = Array.isArray(parsed)
        ? parsed.filter((x: PriceAlert) => x.symbol === this.symbol)
        : [];
    } catch {
      this.alerts = [];
    }
  }

  private saveAlerts(): void {
    try {
      const all = JSON.parse(this.safeGet('stock_price_alerts') || '[]');
      const others = Array.isArray(all) ? all.filter((x: PriceAlert) => x.symbol !== this.symbol) : [];
      this.safeSet('stock_price_alerts', JSON.stringify([...this.alerts, ...others]));
    } catch {
      this.safeSet('stock_price_alerts', JSON.stringify(this.alerts));
    }
  }

  private loadPlotly(): Promise<void> {
    if (this.plotlyLoaded || typeof Plotly !== 'undefined') {
      this.plotlyLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.getElementById('plotly-js');

      if (existing) {
        existing.addEventListener('load', () => {
          this.plotlyLoaded = true;
          resolve();
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'plotly-js';
      script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';

      script.onload = () => {
        this.plotlyLoaded = true;
        resolve();
      };

      script.onerror = () => reject();

      document.body.appendChild(script);
    });
  }

  private renderCandlestick(): void {
    if (
      !this.viewReady ||
      !this.candlestickChart ||
      !this.history.length ||
      typeof Plotly === 'undefined'
    ) {
      return;
    }

    const chartData = [...this.history]
      .map(item => ({
        ...item,
        date: this.normalizeCandleDate(item.date)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const trace = {
      x: chartData.map(item => new Date(item.date)),
      open: chartData.map(item => item.open),
      high: chartData.map(item => item.high),
      low: chartData.map(item => item.low),
      close: chartData.map(item => item.close),
      type: 'candlestick',
      name: this.quote?.displaySymbol || this.symbol,
      increasing: { line: { color: '#22c55e' } },
      decreasing: { line: { color: '#ef4444' } }
    };

    const showTimeLabels = this.selectedRange === '1d';
    const layout = {
      margin: { l: 55, r: 20, t: 20, b: 45 },
      dragmode: 'pan',
      paper_bgcolor: 'rgba(15, 23, 42, 0)',
      plot_bgcolor: '#020617',
      font: { color: '#cbd5e1' },
      xaxis: {
        title: showTimeLabels ? 'Date & Time' : 'Date',
        type: 'date',
        tickformat: showTimeLabels ? '%d %b<br>%H:%M' : '%d %b',
        rangeslider: { visible: true, thickness: 0.05 },
        showgrid: true,
        gridcolor: '#1e293b'
      },
      yaxis: {
        title: 'Price',
        showgrid: true,
        fixedrange: false,
        gridcolor: '#1e293b'
      }
    };

    const config = {
      responsive: true,
      scrollZoom: true,
      // hide the entire mode bar (this also removes the Plotly logo)
      displayModeBar: false,
      displaylogo: false,
      modeBarButtonsToRemove: ['sendDataToCloud']
    };

    Plotly.react(this.candlestickChart.nativeElement, [trace], layout, config);
  }

  private normalizeCandleDate(rawDate: string): string {
    if (!rawDate) {
      return rawDate;
    }

    return rawDate.trim().replace(/\s+/g, 'T');
  }

  private safeGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private safeSet(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch {}
  }

  private safeRemove(key: string): void {
    try { localStorage.removeItem(key); } catch {}
  }

  formatMoney(value?: number): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '—';
    }

    return '₹' + Number(value).toLocaleString('en-IN', {
      maximumFractionDigits: 2
    });
  }

  formatRange(low?: number, high?: number): string {
    if (!low || !high) return '—';
    return `${this.formatMoney(low)} - ${this.formatMoney(high)}`;
  }

  formatPlain(value?: number): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '—';
    }

    return Number(value).toLocaleString('en-IN', {
      maximumFractionDigits: 2
    });
  }

  formatNumber(value?: number): string {
    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(Number(value)) ||
      value === 0
    ) {
      return '—';
    }

    const num = Number(value);

    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(2) + ' K';

    return num.toLocaleString('en-IN');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
