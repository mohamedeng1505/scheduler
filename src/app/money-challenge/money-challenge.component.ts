import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

type MoneyChallengeState = {
  selected: number[];
};

@Component({
  selector: 'app-money-challenge',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './money-challenge.component.html',
  styleUrl: './money-challenge.component.css'
})
export class MoneyChallengeComponent implements OnInit {
  private readonly apiBase = 'http://localhost:4000/api';

  protected readonly gridRows: number[][] = [
    [60, 20, 40, 120, 140, 300, 300, 200, 120, 400],
    [40, 100, 20, 160, 120, 140, 140, 300, 200, 120],
    [100, 40, 100, 20, 160, 120, 120, 140, 300, 200],
    [40, 100, 20, 100, 20, 20, 160, 120, 20, 300],
    [120, 140, 120, 60, 20, 100, 100, 20, 100, 100],
    [80, 20, 60, 200, 100, 20, 100, 100, 20, 20],
    [80, 160, 400, 60, 100, 40, 40, 100, 20, 160],
    [120, 60, 400, 80, 160, 100, 100, 40, 100, 20],
    [200, 400, 120, 80, 40, 60, 60, 100, 40, 100]
  ];
  protected readonly gridValues = this.gridRows.flat();

  protected selected = new Set<number>();

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSelection();
  }

  protected isSelected(index: number): boolean {
    return this.selected.has(index);
  }

  protected toggleCell(index: number): void {
    if (this.selected.has(index)) {
      this.selected.delete(index);
    } else {
      this.selected.add(index);
    }
    this.persistSelection();
  }

  private loadSelection(): void {
    this.http.get<MoneyChallengeState>(`${this.apiBase}/money-challenge`).subscribe({
      next: (data) => {
        const selected = Array.isArray(data?.selected) ? data.selected : [];
        const sanitized = selected.filter((value) => Number.isInteger(value) && value >= 0 && value < 90);
        this.selected = new Set<number>(sanitized);
      },
      error: (err) => {
        console.error('Failed to load money challenge state', err);
      }
    });
  }

  private persistSelection(): void {
    const selected = Array.from(this.selected).filter((value) => Number.isInteger(value));
    selected.sort((a, b) => a - b);
    this.http.post(`${this.apiBase}/money-challenge`, { selected }).subscribe({
      error: (err) => {
        console.error('Failed to save money challenge state', err);
      }
    });
  }
}
