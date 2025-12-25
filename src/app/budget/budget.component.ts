import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './budget.component.html',
  styleUrl: './budget.component.css'
})
export class BudgetComponent {
  monthLabel = 'October 2025';
  syncLabel = 'Synced 2 hours ago';

  categories = [
    {
      name: 'Mortgage',
      group: 'Housing',
      planned: 1450,
      actual: 1450,
      due: '1st',
      status: 'paid'
    },
    {
      name: 'Electric + Water',
      group: 'Utilities',
      planned: 220,
      actual: 198,
      due: '12th',
      status: 'paid'
    },
    {
      name: 'Groceries',
      group: 'Living',
      planned: 520,
      actual: 446,
      due: 'Weekly',
      status: 'in'
    },
    {
      name: 'Transport',
      group: 'Living',
      planned: 180,
      actual: 142,
      due: 'Weekly',
      status: 'in'
    },
    {
      name: 'Subscriptions',
      group: 'Digital',
      planned: 78,
      actual: 78,
      due: '18th',
      status: 'paid'
    },
    {
      name: 'Student Loan',
      group: 'Debt',
      planned: 310,
      actual: 310,
      due: '25th',
      status: 'paid'
    },
    {
      name: 'Fun + Dining',
      group: 'Lifestyle',
      planned: 160,
      actual: 210,
      due: 'Weekly',
      status: 'over'
    }
  ];

  incomeStreams = [
    {
      name: 'Product Salary',
      cadence: 'Biweekly',
      nextPay: 'Oct 11',
      amount: 2450,
      status: 'cleared'
    },
    {
      name: 'Freelance Retainer',
      cadence: 'Project',
      nextPay: 'Oct 18',
      amount: 600,
      status: 'expected'
    },
    {
      name: 'High-yield Interest',
      cadence: 'Monthly',
      nextPay: 'Oct 30',
      amount: 18,
      status: 'pending'
    }
  ];

  bills = [
    {
      name: 'Rent',
      due: 'Oct 1',
      amount: 1450,
      account: 'Checking',
      status: 'paid'
    },
    {
      name: 'Electric',
      due: 'Oct 12',
      amount: 90,
      account: 'Checking',
      status: 'scheduled'
    },
    {
      name: 'Internet',
      due: 'Oct 16',
      amount: 65,
      account: 'Autopay',
      status: 'scheduled'
    },
    {
      name: 'Auto Insurance',
      due: 'Oct 20',
      amount: 110,
      account: 'Savings',
      status: 'due'
    }
  ];

  envelopes = [
    {
      name: 'Emergency Buffer',
      target: 500,
      spent: 220,
      accent: 'sun'
    },
    {
      name: 'Travel',
      target: 300,
      spent: 80,
      accent: 'mint'
    },
    {
      name: 'Gifts',
      target: 150,
      spent: 95,
      accent: 'rose'
    },
    {
      name: 'Home Upgrade',
      target: 250,
      spent: 60,
      accent: 'sky'
    }
  ];

  notes = [
    'Shift dining out to weekends only.',
    'Move 120 to travel once bonus hits.',
    'Review subscriptions before next cycle.'
  ];

  get totalIncome(): number {
    return this.incomeStreams.reduce((total, item) => total + item.amount, 0);
  }

  get totalPlanned(): number {
    return this.categories.reduce((total, item) => total + item.planned, 0);
  }

  get totalActual(): number {
    return this.categories.reduce((total, item) => total + item.actual, 0);
  }

  get cashLeft(): number {
    return this.totalIncome - this.totalPlanned;
  }

  get savingsRate(): number {
    if (!this.totalIncome) {
      return 0;
    }
    return ((this.totalIncome - this.totalActual) / this.totalIncome) * 100;
  }

  envelopeProgress(envelope: { target: number; spent: number }): number {
    if (!envelope.target) {
      return 0;
    }
    return Math.min((envelope.spent / envelope.target) * 100, 100);
  }

  trackByName(index: number, item: { name: string }): string {
    return item.name;
  }
}
