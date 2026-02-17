import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

type Account = {
  id: string;
  name: string;
  initial: number;
  draft?: number;
  editing?: boolean;
};

type ExpenseTransaction = {
  id: string;
  accountId: string;
  categoryId?: string;
  subcategoryId?: string;
  amount: number;
  date?: string;
  note?: string;
  editing?: boolean;
  draft?: {
    accountId: string;
    categoryId?: string;
    subcategoryId?: string;
    amount: number;
    date?: string;
    note?: string;
  };
};

type IncomeTransaction = {
  id: string;
  accountId: string;
  categoryId?: string;
  subcategoryId?: string;
  amount: number;
  date?: string;
  note?: string;
  editing?: boolean;
  draft?: {
    accountId: string;
    categoryId?: string;
    subcategoryId?: string;
    amount: number;
    date?: string;
    note?: string;
  };
};

type TransferTransaction = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  note?: string;
  editing?: boolean;
  draft?: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date?: string;
    note?: string;
  };
};

type MonthlyPlanEntry = {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  planned: number;
  actual: number;
  due?: string;
  status: string;
  draft?: number;
  editing?: boolean;
};

type BudgetState = {
  accounts: Account[];
  expenseCategories?: { id: string; name: string }[];
  expenseSubcategories?: { id: string; name: string }[];
  incomeCategories?: { id: string; name: string }[];
  incomeSubcategories?: { id: string; name: string }[];
  monthlyPlanEntries?: MonthlyPlanEntry[];
  expenseTransactions: ExpenseTransaction[];
  incomeTransactions: IncomeTransaction[];
  transferTransactions: TransferTransaction[];
};

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  templateUrl: './budget.component.html',
  styleUrl: './budget.component.css'
})

export class BudgetComponent {
  private readonly apiBase = 'http://localhost:4000/api';

  private readonly monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  });

  get monthLabel(): string {
    return this.monthFormatter.format(new Date());
  }
  syncLabel = 'Synced 2 hours ago';

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


  accounts: Account[] = [];
  expenseCategories: { id: string; name: string }[] = [];
  expenseSubcategories: { id: string; name: string }[] = [];
  incomeCategories: { id: string; name: string }[] = [];
  incomeSubcategories: { id: string; name: string }[] = [];
  monthlyPlanEntries: MonthlyPlanEntry[] = [];
  expenseTransactions: ExpenseTransaction[] = [];
  incomeTransactions: IncomeTransaction[] = [];
  transferTransactions: TransferTransaction[] = [];

  newMonthlyPlan: Omit<MonthlyPlanEntry, 'id'> = {
    categoryId: '',
    subcategoryId: '',
    planned: 0,
    actual: 0,
    due: '',
    status: 'in'
  };
  newExpense: Omit<ExpenseTransaction, 'id'> = {
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    amount: 0,
    date: '',
    note: ''
  };
  newIncome: Omit<IncomeTransaction, 'id'> = {
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    amount: 0,
    date: '',
    note: ''
  };
  newTransfer: Omit<TransferTransaction, 'id'> = {
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    date: '',
    note: ''
  };

  constructor(private http: HttpClient) {
    this.loadBudget();
  }

  notes = [
    'Shift dining out to weekends only.',
    'Move 120 to travel once bonus hits.',
    'Review subscriptions before next cycle.'
  ];

  get totalIncome(): number {
    return this.incomeStreams.reduce((total, item) => total + item.amount, 0);
  }

  get totalPlanned(): number {
    return this.monthlyPlanEntries.reduce((total, item) => total + (Number.isFinite(item.planned) ? item.planned : 0), 0);
  }

  get totalActual(): number {
    return this.monthlyPlanEntries.reduce((total, item) => total + (Number.isFinite(item.actual) ? item.actual : 0), 0);
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
    this.persistAccounts();
  }

  cancelEdit(account: Account): void {
    account.draft = account.initial;
    account.editing = false;
  }

  trackByName(index: number, item: { name: string }): string {
    return item.name;
  }

  trackById(index: number, item: { id: string }): string {
    return item.id;
  }

  getAccountBalance(accountId: string): number {
    const account = this.accounts.find((acct) => acct.id === accountId);
    const initial = account ? account.initial : 0;
    const incomeTotal = this.incomeTransactions
      .filter((tx) => tx.accountId === accountId)
      .reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0);
    const expenseTotal = this.expenseTransactions
      .filter((tx) => tx.accountId === accountId)
      .reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0);
    const transfersIn = this.transferTransactions
      .filter((tx) => tx.toAccountId === accountId)
      .reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0);
    const transfersOut = this.transferTransactions
      .filter((tx) => tx.fromAccountId === accountId)
      .reduce((sum, tx) => sum + (Number.isFinite(tx.amount) ? tx.amount : 0), 0);

    return initial + incomeTotal + transfersIn - expenseTotal - transfersOut;
  }

  private loadBudget(): void {
    this.http.get<BudgetState>(`${this.apiBase}/budget`).subscribe({
      next: (data) => {
        this.accounts = Array.isArray(data?.accounts) ? data.accounts : [];
        this.expenseCategories = Array.isArray(data?.expenseCategories) ? data.expenseCategories : [];
        this.expenseSubcategories = Array.isArray(data?.expenseSubcategories) ? data.expenseSubcategories : [];
        this.incomeCategories = Array.isArray(data?.incomeCategories) ? data.incomeCategories : [];
        this.incomeSubcategories = Array.isArray(data?.incomeSubcategories) ? data.incomeSubcategories : [];
        this.monthlyPlanEntries = Array.isArray(data?.monthlyPlanEntries) ? data.monthlyPlanEntries : [];
        this.expenseTransactions = Array.isArray(data?.expenseTransactions) ? data.expenseTransactions : [];
        this.incomeTransactions = Array.isArray(data?.incomeTransactions) ? data.incomeTransactions : [];
        this.transferTransactions = Array.isArray(data?.transferTransactions) ? data.transferTransactions : [];
      },
      error: (err) => {
        console.error('Failed to load budget data', err);
      }
    });
  }

  private persistMonthlyPlan(): void {
    const payload = {
      monthlyPlanEntries: this.monthlyPlanEntries
    };
    this.http.put(`${this.apiBase}/budget/monthly-plan`, payload).subscribe({
      error: (err) => {
        console.error('Failed to save monthly plan entries', err);
      }
    });
  }

  private persistAccounts(): void {
    const payload = {
      accounts: this.accounts.map((acct) => ({
        id: acct.id,
        name: acct.name,
        initial: acct.initial
      }))
    };
    this.http.put(`${this.apiBase}/budget/accounts`, payload).subscribe({
      error: (err) => {
        console.error('Failed to save budget accounts', err);
      }
    });
  }

  addMonthlyPlanEntry(): void {
    if (!this.newMonthlyPlan.categoryId || !Number.isFinite(Number(this.newMonthlyPlan.planned))) {
      return;
    }

    const entry: MonthlyPlanEntry = {
      id: this.makeId('plan'),
      categoryId: this.newMonthlyPlan.categoryId,
      subcategoryId: this.newMonthlyPlan.subcategoryId || undefined,
      planned: Number(this.newMonthlyPlan.planned) || 0,
      actual: Number(this.newMonthlyPlan.actual) || 0,
      due: this.newMonthlyPlan.due || undefined,
      status: this.newMonthlyPlan.status || 'in'
    };

    this.monthlyPlanEntries = [entry, ...this.monthlyPlanEntries];
    this.newMonthlyPlan = {
      categoryId: '',
      subcategoryId: '',
      planned: 0,
      actual: 0,
      due: '',
      status: 'in'
    };
    this.persistMonthlyPlan();
  }

  deleteMonthlyPlanEntry(entry: MonthlyPlanEntry): void {
    this.monthlyPlanEntries = this.monthlyPlanEntries.filter((item) => item.id !== entry.id);
    this.persistMonthlyPlan();
  }

  startEditMonthlyPlan(entry: MonthlyPlanEntry): void {
    entry.draft = entry.actual;
    entry.editing = true;
  }

  saveEditMonthlyPlan(entry: MonthlyPlanEntry): void {
    const value = Number(entry.draft);
    if (!Number.isFinite(value)) {
      this.cancelEditMonthlyPlan(entry);
      return;
    }
    entry.actual = value;
    entry.editing = false;
    entry.draft = undefined;
    this.persistMonthlyPlan();
  }

  cancelEditMonthlyPlan(entry: MonthlyPlanEntry): void {
    entry.draft = entry.actual;
    entry.editing = false;
  }

  addExpenseTransaction(): void {
    if (!this.newExpense.accountId || !Number.isFinite(Number(this.newExpense.amount))) {
      return;
    }
    const tx: ExpenseTransaction = {
      id: this.makeId('exp'),
      accountId: this.newExpense.accountId,
      categoryId: this.newExpense.categoryId || undefined,
      subcategoryId: this.newExpense.subcategoryId || undefined,
      amount: Number(this.newExpense.amount),
      date: this.newExpense.date || undefined,
      note: this.newExpense.note || undefined
    };
    this.expenseTransactions = [tx, ...this.expenseTransactions];
    this.newExpense = {
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      amount: 0,
      date: '',
      note: ''
    };
    this.persistTransactions();
  }

  addIncomeTransaction(): void {
    if (!this.newIncome.accountId || !Number.isFinite(Number(this.newIncome.amount))) {
      return;
    }
    const tx: IncomeTransaction = {
      id: this.makeId('inc'),
      accountId: this.newIncome.accountId,
      categoryId: this.newIncome.categoryId || undefined,
      subcategoryId: this.newIncome.subcategoryId || undefined,
      amount: Number(this.newIncome.amount),
      date: this.newIncome.date || undefined,
      note: this.newIncome.note || undefined
    };
    this.incomeTransactions = [tx, ...this.incomeTransactions];
    this.newIncome = {
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      amount: 0,
      date: '',
      note: ''
    };
    this.persistTransactions();
  }

  addTransferTransaction(): void {
    if (
      !this.newTransfer.fromAccountId ||
      !this.newTransfer.toAccountId ||
      this.newTransfer.fromAccountId === this.newTransfer.toAccountId ||
      !Number.isFinite(Number(this.newTransfer.amount))
    ) {
      return;
    }
    const tx: TransferTransaction = {
      id: this.makeId('xfer'),
      fromAccountId: this.newTransfer.fromAccountId,
      toAccountId: this.newTransfer.toAccountId,
      amount: Number(this.newTransfer.amount),
      date: this.newTransfer.date || undefined,
      note: this.newTransfer.note || undefined
    };
    this.transferTransactions = [tx, ...this.transferTransactions];
    this.newTransfer = {
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      date: '',
      note: ''
    };
    this.persistTransactions();
  }

  private persistTransactions(): void {
    const payload = {
      expenseTransactions: this.expenseTransactions,
      incomeTransactions: this.incomeTransactions,
      transferTransactions: this.transferTransactions
    };
    this.http.put(`${this.apiBase}/budget/transactions`, payload).subscribe({
      error: (err) => {
        console.error('Failed to save budget transactions', err);
      }
    });
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  startEditExpense(tx: ExpenseTransaction): void {
    tx.draft = {
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId,
      amount: tx.amount,
      date: tx.date,
      note: tx.note
    };
    tx.editing = true;
  }

  saveEditExpense(tx: ExpenseTransaction): void {
    if (!tx.draft || !tx.draft.accountId) {
      return;
    }
    tx.accountId = tx.draft.accountId;
    tx.categoryId = tx.draft.categoryId || undefined;
    tx.subcategoryId = tx.draft.subcategoryId || undefined;
    tx.amount = Number(tx.draft.amount) || 0;
    tx.date = tx.draft.date || undefined;
    tx.note = tx.draft.note || undefined;
    tx.editing = false;
    tx.draft = undefined;
    this.persistTransactions();
  }

  cancelEditExpense(tx: ExpenseTransaction): void {
    tx.editing = false;
    tx.draft = undefined;
  }

  deleteExpense(tx: ExpenseTransaction): void {
    this.expenseTransactions = this.expenseTransactions.filter((item) => item.id !== tx.id);
    this.persistTransactions();
  }

  startEditIncome(tx: IncomeTransaction): void {
    tx.draft = {
      accountId: tx.accountId,
      categoryId: tx.categoryId,
      subcategoryId: tx.subcategoryId,
      amount: tx.amount,
      date: tx.date,
      note: tx.note
    };
    tx.editing = true;
  }

  saveEditIncome(tx: IncomeTransaction): void {
    if (!tx.draft || !tx.draft.accountId) {
      return;
    }
    tx.accountId = tx.draft.accountId;
    tx.categoryId = tx.draft.categoryId || undefined;
    tx.subcategoryId = tx.draft.subcategoryId || undefined;
    tx.amount = Number(tx.draft.amount) || 0;
    tx.date = tx.draft.date || undefined;
    tx.note = tx.draft.note || undefined;
    tx.editing = false;
    tx.draft = undefined;
    this.persistTransactions();
  }

  cancelEditIncome(tx: IncomeTransaction): void {
    tx.editing = false;
    tx.draft = undefined;
  }

  deleteIncome(tx: IncomeTransaction): void {
    this.incomeTransactions = this.incomeTransactions.filter((item) => item.id !== tx.id);
    this.persistTransactions();
  }

  startEditTransfer(tx: TransferTransaction): void {
    tx.draft = {
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
      amount: tx.amount,
      date: tx.date,
      note: tx.note
    };
    tx.editing = true;
  }

  saveEditTransfer(tx: TransferTransaction): void {
    if (!tx.draft || !tx.draft.fromAccountId || !tx.draft.toAccountId) {
      return;
    }
    tx.fromAccountId = tx.draft.fromAccountId;
    tx.toAccountId = tx.draft.toAccountId;
    tx.amount = Number(tx.draft.amount) || 0;
    tx.date = tx.draft.date || undefined;
    tx.note = tx.draft.note || undefined;
    tx.editing = false;
    tx.draft = undefined;
    this.persistTransactions();
  }

  cancelEditTransfer(tx: TransferTransaction): void {
    tx.editing = false;
    tx.draft = undefined;
  }

  deleteTransfer(tx: TransferTransaction): void {
    this.transferTransactions = this.transferTransactions.filter((item) => item.id !== tx.id);
    this.persistTransactions();
  }

  getAccountName(accountId: string): string {
    return this.accounts.find((acct) => acct.id === accountId)?.name || 'Unknown';
  }

  getExpenseCategoryName(categoryId?: string): string {
    if (!categoryId) {
      return '';
    }
    return this.expenseCategories.find((cat) => cat.id === categoryId)?.name || '';
  }

  getExpenseSubcategoryName(subcategoryId?: string): string {
    if (!subcategoryId) {
      return '';
    }
    return this.expenseSubcategories.find((sub) => sub.id === subcategoryId)?.name || '';
  }

  getMonthlyPlanSubline(entry: MonthlyPlanEntry): string {
    const sub = this.getExpenseSubcategoryName(entry.subcategoryId);
    const due = entry.due ? `due ${entry.due}` : '';
    if (sub && due) {
      return `${sub} · ${due}`;
    }
    if (sub) {
      return sub;
    }
    if (due) {
      return due;
    }
    return 'No details';
  }

  getIncomeCategoryName(categoryId?: string): string {
    if (!categoryId) {
      return '';
    }
    return this.incomeCategories.find((cat) => cat.id === categoryId)?.name || '';
  }

  getIncomeSubcategoryName(subcategoryId?: string): string {
    if (!subcategoryId) {
      return '';
    }
    return this.incomeSubcategories.find((sub) => sub.id === subcategoryId)?.name || '';
  }
}

