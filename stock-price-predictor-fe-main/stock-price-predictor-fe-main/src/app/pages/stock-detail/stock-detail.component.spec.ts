import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { StockDetailComponent } from './stock-detail.component';
import { StockService } from '../../services/stock.service';

declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const expect: any;
declare const jasmine: any;

describe('StockDetailComponent', () => {
  let component: StockDetailComponent;
  let fixture: ComponentFixture<StockDetailComponent>;

  const mockStockService = {
    getStockQuote: jasmine.createSpy('getStockQuote').and.returnValue(of(null)),
    getStockPrediction: jasmine.createSpy('getStockPrediction').and.returnValue(of(null)),
    getStockHistory: jasmine.createSpy('getStockHistory').and.returnValue(of({ candles: [] }))
  };

  const mockActivatedRoute = {
    paramMap: of(convertToParamMap({ symbol: 'NIFTY50' }))
  };

  beforeEach(async () => {
    (globalThis as any).Plotly = { react: jasmine.createSpy('react') };

    await TestBed.configureTestingModule({
      imports: [StockDetailComponent],
      providers: [
        { provide: StockService, useValue: mockStockService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(StockDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create stock detail component', () => {
    expect(component).toBeTruthy();
  });

  it('should set default symbol from route', () => {
    expect(component.symbol).toBe('NIFTY50');
  });
});