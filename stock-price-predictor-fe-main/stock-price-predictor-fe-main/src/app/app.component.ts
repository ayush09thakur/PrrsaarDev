import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a routerLink="/" class="brand">Indian Stock Live</a>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/compare" routerLinkActive="active">Compare</a>
          <a routerLink="/news" routerLinkActive="active">News</a>
          <a routerLink="/watchlist" routerLinkActive="active">Watchlist</a>
        </nav>
      </header>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #060b18; color: #f8fafc; }
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .topbar 
    { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 18px 24px; background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
      border-bottom: 1px solid rgba(255,255,255,.08); }
    .brand { font-size: 1.25rem; font-weight: 800; color: #38bdf8; text-decoration: none; }
    .nav-links { display: flex; gap: 18px; flex-wrap: wrap; }
    .nav-links a { color: #cbd5e1; text-decoration: none; font-weight: 600; }
    .nav-links a.active { color: #e2e8f0; border-bottom: 2px solid #38bdf8; padding-bottom: 2px; }
    .main-content { flex: 1; padding: 24px; }
  `]
})
export class AppComponent {}