import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

type Account = {
  name: string;
  initial: number;
  draft?: number;
  editing?: boolean;
};

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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


  accounts: Account[] = [
    { name: 'Cash', initial: 0 },
    { name: 'Ahli bank', initial: 0 },
    { name: 'Ahli dollars', initial: 0 },
    { name: 'Faisal savings', initial: 0 },
    { name: 'Faisal current', initial: 0 },
    { name: 'Hyperwallet', initial: 0 },
    { name: 'Paypal', initial: 0 },
    { name: 'Dollars', initial: 0 },
    { name: 'Card', initial: 0 },
    { name: 'Faisal 3 years', initial: 0 },
    { name: 'Ahli certificates', initial: 0 },
    { name: 'Gold 21', initial: 0 },
    { name: 'Phone cash', initial: 0 },
    { name: 'Vodafone cash', initial: 0 },
    { name: 'Stock market', initial: 0 },
    { name: 'FIB mutual fund', initial: 0 },
    { name: 'CIB mutual fund', initial: 0 },
    { name: 'Bashayer mutual fund', initial: 0 },
    { name: 'Mama Hanan', initial: 0 },
    { name: 'Zoo balance', initial: 0 },
    { name: 'Dody', initial: 0 },
    { name: 'A Mostafa', initial: 0 },
    { name: 'Youssef', initial: 0 },
    { name: 'Home savings', initial: 0 },
    { name: 'Adham', initial: 0 },
    { name: 'Riyals', initial: 0 },
    { name: 'Omar', initial: 0 },
    { name: 'Noon', initial: 0 },
    { name: 'Younes', initial: 0 },
    { name: 'Ahli bank Extra', initial: 0 },
    { name: 'Gold 24', initial: 0 },
    { name: 'Mashreq bank', initial: 0 },
    { name: 'Azimut', initial: 0 },
    { name: 'Mai', initial: 0 },
    { name: 'Money challenge', initial: 0 },
    { name: 'Mousa', initial: 0 },
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

  startEdit(account: Account): void {
    account.draft = account.initial;
    account.editing = true;
  }

  saveEdit(account: Account): void {
    const value = Number(account.draft);
    account.initial = Number.isFinite(value) ? value : 0;
    account.editing = false;
  }

  cancelEdit(account: Account): void {
    account.draft = account.initial;
    account.editing = false;
  }

  trackByName(index: number, item: { name: string }): string {
    return item.name;
  }
}

