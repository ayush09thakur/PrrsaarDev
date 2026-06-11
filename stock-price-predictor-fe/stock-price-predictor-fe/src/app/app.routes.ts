import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'stock/:symbol',
    loadComponent: () =>
      import('./pages/stock-detail/stock-detail.component')
        .then(m => m.StockDetailComponent),
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./pages/compare/compare.component')
        .then(m => m.CompareComponent),
  },
  {
    path: 'news',
    loadComponent: () =>
      import('./pages/news/news.component')
        .then(m => m.NewsComponent),
  },
  {
    path: 'watchlist',
    loadComponent: () =>
      import('./pages/watchlist/watchlist.component')
        .then(m => m.WatchlistComponent),
  },
  {
    path: '**',
    redirectTo: '',
  }
];