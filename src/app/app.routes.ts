import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent)
  },
  {
    path: 'scheduler',
    loadComponent: () => import('./scheduler/scheduler.component').then((m) => m.SchedulerComponent)
  },
  {
    path: 'budget',
    loadComponent: () => import('./budget/budget.component').then((m) => m.BudgetComponent)
  },
  {
    path: 'money-challenge',
    loadComponent: () =>
      import('./money-challenge/money-challenge.component').then(
        (m) => m.MoneyChallengeComponent
      )
  },
  {
    path: 'goals',
    loadComponent: () => import('./goals/goals.component').then((m) => m.GoalsComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
