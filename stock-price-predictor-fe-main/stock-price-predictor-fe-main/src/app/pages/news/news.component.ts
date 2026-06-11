import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface NewsCard {
  title: string;
  description: string;
  tag: string;
  url: string;
}

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.css']
})
export class NewsComponent {
  news: NewsCard[] = [
    {
      title: 'Indian Market News',
      description: 'Open Google News for the latest Indian stock market headlines, NIFTY updates and Sensex movements.',
      tag: 'Market',
      url: 'https://news.google.com/search?q=Indian%20stock%20market%20NIFTY%20Sensex'
    },
    {
      title: 'NIFTY 50 Updates',
      description: 'Track NIFTY 50 related news, index movement and sector performance.',
      tag: 'Index',
      url: 'https://news.google.com/search?q=NIFTY%2050%20today'
    },
    {
      title: 'Banking Sector News',
      description: 'Latest news about HDFC Bank, ICICI Bank, SBI and Indian banking sector.',
      tag: 'Banking',
      url: 'https://news.google.com/search?q=Indian%20banking%20stocks%20today'
    },
    {
      title: 'IT Sector News',
      description: 'Latest updates on Infosys, Wipro and Indian IT companies.',
      tag: 'IT',
      url: 'https://news.google.com/search?q=Indian%20IT%20stocks%20Infosys%20today'
    },
    {
      title: 'Auto Sector News',
      description: 'Latest headlines on Maruti, Tata Motors, M&M and auto industry trends.',
      tag: 'Auto',
      url: 'https://news.google.com/search?q=Indian%20auto%20stocks%20today'
    },
    {
      title: 'Energy Sector News',
      description: 'Follow Reliance, ONGC and power/energy market updates.',
      tag: 'Energy',
      url: 'https://news.google.com/search?q=Indian%20energy%20stocks%20Reliance'
    }
  ];
}
