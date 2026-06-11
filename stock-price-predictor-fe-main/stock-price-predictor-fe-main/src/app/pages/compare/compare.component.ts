import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { StockQuote, StockService } from '../../services/stock.service';

interface CompareRow extends StockQuote {
  aiScore: number;
  signal: 'BUY' | 'HOLD' | 'SELL';
}

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.css']
})
export class CompareComponent implements OnInit, OnDestroy {
  selectedSymbols = ['RELIANCE:NSE', 'HDFCBANK:NSE'];
  customSymbol = '';
  rows: CompareRow[] = [];
  loading = false;
  error = '';
  private destroy$ = new Subject<void>();

  constructor(private stockService: StockService) {}

  ngOnInit(): void { this.loadCompare(); }

  loadCompare(): void {
    if (!this.selectedSymbols.length) return;
    this.loading = true;
    this.error = '';
    forkJoin(this.selectedSymbols.map(symbol => this.stockService.getStockQuote(symbol)))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: quotes => {
          this.rows = quotes.map(q => this.toCompareRow(q));
          this.loading = false;
        },
        error: () => {
          this.error = 'Could not load comparison. Please start backend with npm run api.';
          this.loading = false;
        }
      });
  }

  addSymbol(): void {
    const sym = this.customSymbol.trim().toUpperCase();
    if (!sym || this.selectedSymbols.includes(sym)) return;
    this.selectedSymbols.push(sym.includes(':') || sym === 'NIFTY50' ? sym : `${sym}:NSE`);
    this.customSymbol = '';
    this.loadCompare();
  }

  removeSymbol(symbol: string): void {
    this.selectedSymbols = this.selectedSymbols.filter(x => x !== symbol);
    if (this.selectedSymbols.length) this.loadCompare(); else this.rows = [];
  }

  private toCompareRow(q: StockQuote): CompareRow {
    let score = 50;
    const change = Number(q.changePercent || 0);
    if (change > 0) score += Math.min(25, change * 4);
    if (change < 0) score += Math.max(-25, change * 4);
    if ((q.price || 0) > (q.previousClose || q.price || 0)) score += 10;
    if ((q.volume || 0) > (q.avgVolume || 0) && (q.avgVolume || 0) > 0) score += 8;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const signal = score >= 70 ? 'BUY' : score <= 40 ? 'SELL' : 'HOLD';
    return { ...q, aiScore: score, signal };
  }

  formatMoney(value?: number): string {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) return '—';
    return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  formatNumber(value?: number): string {
    if (!value) return '—';
    if (value >= 10000000) return (value / 10000000).toFixed(2) + ' Cr';
    if (value >= 100000) return (value / 100000).toFixed(2) + ' L';
    return value.toLocaleString('en-IN');
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
