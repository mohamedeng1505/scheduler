import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type SchedulerMode = 'planning' | 'execution';

@Injectable({ providedIn: 'root' })
export class SchedulerModeService {
  private readonly storageKey = 'scheduler-mode';
  private readonly modeSubject = new BehaviorSubject<SchedulerMode>(this.loadMode());

  readonly mode$ = this.modeSubject.asObservable();

  get mode(): SchedulerMode {
    return this.modeSubject.value;
  }

  setMode(mode: SchedulerMode): void {
    if (mode === this.modeSubject.value) return;
    this.modeSubject.next(mode);
    this.persistMode(mode);
  }

  private loadMode(): SchedulerMode {
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (stored === 'planning' || stored === 'execution') {
        return stored;
      }
    } catch {
      // Ignore storage failures (private mode / disabled storage).
    }
    return 'execution';
  }

  private persistMode(mode: SchedulerMode): void {
    try {
      window.localStorage.setItem(this.storageKey, mode);
    } catch {
      // Ignore storage failures.
    }
  }
}
