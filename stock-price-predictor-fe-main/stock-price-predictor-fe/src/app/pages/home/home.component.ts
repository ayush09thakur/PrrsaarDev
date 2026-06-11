import { Component, OnDestroy, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, interval, of, startWith, switchMap, takeUntil } from 'rxjs';
import { MarketMood, StockQuote, StockSearchResult, StockService } from '../../services/stock.service';

import * as echarts from 'echarts';

declare global {
  interface Window { webkitSpeechRecognition?: any; SpeechRecognition?: any; }
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  trending: StockQuote[] = [];
  mood: MarketMood | null = null;
  trendingLoading = true;
  error = '';
  lastUpdated: Date | null = null;

  searchQuery = '';
  searchResults: StockSearchResult[] = [];
  searchLoading = false;
  showDropdown = false;
  voiceMessage = 'Voice search ready';

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  @ViewChild('echartContainer') echartContainer!: ElementRef<HTMLDivElement>;
  private chartInstance: echarts.ECharts | null = null;
  private resizeListener = () => { this.chartInstance?.resize(); };

  constructor(private stockService: StockService) {}

  ngOnInit(): void {
    interval(10000).pipe(
      startWith(0),
      switchMap(() => this.stockService.getTrendingStocks().pipe(catchError(() => of([] as StockQuote[])))),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.trending = data;
      this.trendingLoading = false;
      this.lastUpdated = new Date();
      this.error = data.length ? '' : 'Backend is not running. Start it with: npm run api';
      this.loadMarketMood();
    });

    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) return of([] as StockSearchResult[]);
        this.searchLoading = true;
        return this.stockService.searchStocks(q).pipe(catchError(() => of([] as StockSearchResult[])));
      }),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.searchResults = results;
      this.searchLoading = false;
    });
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  private initChart(): void {
    try {
      const el = this.echartContainer?.nativeElement;
      if (!el) return;
      this.chartInstance = (echarts as any).init(el);
      const option: any = {
        title: { text: 'Sample Stock Trend', left: 'center', textStyle: { color: '#cbd5e1' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['10:00','10:10','10:20','10:30','10:40','10:50'], axisLine:{lineStyle:{color:'#475569'}}},
        yAxis: { type: 'value', axisLine:{lineStyle:{color:'#475569'}}},
        series: [{ data: [150, 160, 155, 170, 165, 175], type: 'line', smooth: true, areaStyle: {} }]
      };
      this.chartInstance?.setOption(option);
      window.addEventListener('resize', this.resizeListener);
    } catch (e) {
      console.error('ECharts init error', e);
    }
  }

  loadMarketMood(): void {
    this.stockService.getMarketMood().pipe(takeUntil(this.destroy$), catchError(() => of(null))).subscribe(data => this.mood = data);
  }

  onSearchChange(value: string): void {
    this.search$.next(value);
    this.showDropdown = !!value;
    if (!value) this.searchResults = [];
  }

  onBlur(): void { setTimeout(() => this.showDropdown = false, 160); }

  startVoiceSearch(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.voiceMessage = 'Voice search is not supported in this browser. Use Chrome for best result.';
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => this.voiceMessage = 'Listening... say a stock name like Reliance or HDFC Bank';
    recognition.onerror = () => this.voiceMessage = 'Could not hear clearly. Try again.';
    recognition.onresult = (event: any) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      this.searchQuery = spoken.replace(/stock|share|price|show|open/gi, '').trim();
      this.voiceMessage = `Searching for: ${this.searchQuery}`;
      this.onSearchChange(this.searchQuery);
      this.showDropdown = true;
    };
    recognition.start();
  }

  formatVolume(v?: number): string {
    const n = Number(v || 0);
    if (!n) return '—';
    if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  ngOnDestroy(): void { 
    this.destroy$.next(); this.destroy$.complete(); 
    if (this.chartInstance) {
      this.chartInstance.dispose();
      window.removeEventListener('resize', this.resizeListener);
      this.chartInstance = null;
    }
  }
}
