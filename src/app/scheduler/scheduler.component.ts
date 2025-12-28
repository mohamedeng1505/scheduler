import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TasksComponent } from '../tasks/tasks.component';
import { TimeSlotsComponent } from '../time-slots/time-slots.component';
import { SavedSlotList, Slot, SlotDraft, Task } from '../types';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, TasksComponent, TimeSlotsComponent],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.shared.css', './scheduler.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SchedulerComponent implements OnInit, OnDestroy {
  private readonly apiBase = 'http://localhost:4000/api';
  private readonly noTimeTag = 'No time';
  private readonly pendingCleanupTag = '__pending_cleanup__';
  private readonly defaultStart = '09:00';
  private readonly defaultEnd = '10:00';
  private cleanupTimerId?: number;

  protected readonly days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];

  protected slots: Slot[] = [];
  protected tasks: Task[] = [];
  protected requiredTasks: Task[] = [];
  protected noTimeTasks: Task[] = [];
  protected pendingCleanupTasks: Task[] = [];
  protected savedSlotLists: SavedSlotList[] = [];
  protected noTimeDraft = '';
  protected totalSlotHours = 0;
  protected totalTaskHours = 0;
  protected hourDifference = 0;
  protected hasAssignedTasks = false;
  protected cleanupModalOpen = false;

  protected newSlot: SlotDraft = this.createDefaultSlotDraft();
  protected newTask: { name: string; duration: number } = this.createDefaultTaskDraft();

  protected editingSlotIndex: number | null = null;
  protected selectedSlotIds: Set<string> = new Set<string>();
  protected selectedSlotListId: string | null = null;
  protected slotListMenuOpen = false;
  @ViewChild(TasksComponent) protected tasksComponent?: TasksComponent;

  constructor(
    private http: HttpClient,
    private host: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadSavedSlotLists();
    this.cleanupTimerId = window.setInterval(() => {
      this.cleanupPassedSlots();
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.cleanupTimerId !== undefined) {
      window.clearInterval(this.cleanupTimerId);
    }
  }

  protected get selectedSlotCount(): number {
    return this.selectedSlotIds.size;
  }

  protected get selectedSlotListLabel(): string {
    const selected = this.savedSlotLists.find((l) => l.id === this.selectedSlotListId);
    if (selected) {
      const count = selected.slots.length;
      return `${selected.name} (${count} slot${count === 1 ? '' : 's'})`;
    }
    return 'Saved lists';
  }

  protected get derivedHours(): number | null {
    return this.computeHours(this.newSlot.start, this.newSlot.end);
  }

  protected trackByDay(_index: number, day: string): string {
    return day;
  }

  protected trackBySlotListId(_index: number, list: SavedSlotList): string {
    return list.id;
  }

  protected trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  protected saveSlot(form: NgForm): void {
    const hours = this.computeHours(this.newSlot.start, this.newSlot.end);

    if (!this.newSlot.day || hours === null) {
      return;
    }

    const slot: Slot = {
      id:
        this.editingSlotIndex === null
          ? this.generateId('slot')
          : this.slots[this.editingSlotIndex]?.id ?? this.generateId('slot'),
      day: this.newSlot.day,
      start: this.newSlot.start,
      end: this.newSlot.end,
      hours
    };

    if (this.editingSlotIndex === null) {
      this.slots = [...this.slots, slot];
    } else {
      const updated = [...this.slots];
      updated[this.editingSlotIndex] = slot;
      this.slots = updated;
    }
    this.persistState();

    const keepDay = slot.day;
    this.resetSlotDraft(keepDay);
    form.resetForm({ day: keepDay, start: this.defaultStart, end: this.defaultEnd });
    this.editingSlotIndex = null;
  }

  protected startEdit(slotId: string): void {
    const index = this.slots.findIndex((s) => s.id === slotId);
    if (index < 0) return;
    const slot = this.slots[index];
    if (!slot) return;

    this.editingSlotIndex = index;
    this.newSlot = { day: slot.day, start: slot.start, end: slot.end };
  }

  protected cancelEdit(form: NgForm): void {
    this.editingSlotIndex = null;
    this.resetSlotDraft();
    form.resetForm({ day: this.days[0], start: this.defaultStart, end: this.defaultEnd });
  }

  protected duplicateSlot(slotId: string): void {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return;

    const copy: Slot = { ...slot, id: this.generateId('slot') };
    this.slots = [...this.slots, copy];
    this.persistState();
  }

  protected deleteSlot(slotId: string): void {
    const removed = this.removeSlotsByIds([slotId]);
    if (removed) {
      this.persistState();
    }
  }

  protected addTask(taskForm: NgForm): void {
    const trimmedName = this.newTask.name.trim();
    const duration = Number(this.newTask.duration);
    if (!trimmedName || Number.isNaN(duration) || duration <= 0) {
      return;
    }

    const task: Task = {
      id: this.generateId('task'),
      name: trimmedName,
      tags: [],
      duration: Math.round(duration * 100) / 100,
      assignedSlotId: null,
      postponed: false
    };

    this.tasks = [...this.tasks, task];
    this.resetTaskDraft();
    taskForm.resetForm({ name: '', duration: 1 });
    this.persistState();
  }

  protected toggleSlotSelection(slotId: string): void {
    const next = new Set(this.selectedSlotIds);
    if (next.has(slotId)) {
      next.delete(slotId);
    } else {
      next.add(slotId);
    }
    this.selectedSlotIds = next;
  }

  protected selectAllSlots(): void {
    this.selectedSlotIds = new Set(this.slots.map((s) => s.id));
  }

  protected clearSlotSelection(): void {
    this.selectedSlotIds = new Set();
  }

  protected bulkDeleteSelectedSlots(): void {
    const ids = Array.from(this.selectedSlotIds);
    if (!ids.length) return;
    const removed = this.removeSlotsByIds(ids);
    if (removed) {
      this.persistState();
    }
  }

  protected bulkDuplicateSelectedSlots(): void {
    if (!this.selectedSlotIds.size) return;
    const toDuplicate = this.slots.filter((s) => this.selectedSlotIds.has(s.id));
    if (!toDuplicate.length) return;
    const copies = toDuplicate.map((slot) => ({ ...slot, id: this.generateId('slot') }));
    this.slots = [...this.slots, ...copies];
    this.persistState();
  }

  protected saveSlotList(): void {
    if (!this.slots.length) {
      window.alert('Add at least one slot before saving a list.');
      return;
    }

    const name = window.prompt('Name this slot list:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert('A name is required to save this slot list.');
      return;
    }

    this.http
      .post<SavedSlotList>(`${this.apiBase}/slot-lists`, { name: trimmed, slots: this.slots })
      .subscribe({
        next: (list) => {
          this.savedSlotLists = [...this.savedSlotLists, list];
          this.selectedSlotListId = list.id;
          window.alert(`Saved "${list.name}".`);
        },
        error: (err) => {
          console.error('Failed to save slot list', err);
          window.alert('Failed to save slot list. Please try again.');
        }
      });
  }

  protected loadSlotList(): void {
    if (!this.savedSlotLists.length || !this.selectedSlotListId) {
      return;
    }

    const selected = this.savedSlotLists.find((list) => list.id === this.selectedSlotListId);
    if (!selected) return;

    this.slots = selected.slots;
    this.editingSlotIndex = null;
    this.clearSlotSelection();

    const validSlotIds = new Set(this.slots.map((s) => s.id));
    this.tasks = this.tasks.map((t) =>
      t.assignedSlotId && !validSlotIds.has(t.assignedSlotId) ? { ...t, assignedSlotId: null } : t
    );

    this.persistState();
  }

  protected onTasksChange(next: Task[]): void {
    this.tasks = [...next, ...this.noTimeTasks];
    this.persistState();
  }

  protected resetSchedule(): void {
    if (!this.slots.length && !this.tasks.length) {
      return;
    }

    const confirmed = window.confirm('Clear all time slots and required tasks? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    this.slots = [];
    this.tasks = [];
    this.editingSlotIndex = null;
    this.selectedSlotIds = new Set<string>();
    this.slotListMenuOpen = false;
    this.resetSlotDraft();
    this.resetTaskDraft();
    this.persistState();
  }

  protected emptySlots(): void {
    if (!this.hasAssignedTasks) {
      return;
    }

    const confirmed = window.confirm('Unassign all tasks from their time slots?');
    if (!confirmed) {
      return;
    }

    this.tasks = this.tasks.map((task) =>
      task.assignedSlotId ? { ...task, assignedSlotId: null } : task
    );
    this.persistState();
  }

  private loadData(): void {
    this.http
      .get<{ slots: Slot[]; tasks: Task[]; noTimeTasks?: string[] }>(`${this.apiBase}/data`)
      .subscribe({
        next: (data) => {
          this.slots = data.slots ?? [];
          const loadedTasks = (data.tasks ?? []).map((t) => ({
            ...t,
            postponed: !!t.postponed,
            tags: Array.isArray(t.tags) ? t.tags : []
          }));
          const legacyNoTime = (data.noTimeTasks ?? [])
            .map((name) => name.trim())
            .filter(Boolean);
          const noTimeNames = new Set(
            loadedTasks
              .filter((task) => this.isNoTimeTask(task))
              .map((task) => task.name.trim().toLowerCase())
          );
          const migratedNoTime = legacyNoTime
            .filter((name) => !noTimeNames.has(name.toLowerCase()))
            .map((name) => this.buildNoTimeTask(name));
          this.tasks = [...loadedTasks, ...migratedNoTime];
          this.normalizeTasks();
          this.updateDerivedState();
          this.clearSlotSelection();
          this.cleanupPassedSlots();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load saved data', err);
        }
      });
  }

  private loadSavedSlotLists(): void {
    this.http
      .get<{ savedSlotLists: SavedSlotList[] }>(`${this.apiBase}/slot-lists`)
      .subscribe({
        next: (data) => {
          this.savedSlotLists = data.savedSlotLists ?? [];
          if (!this.selectedSlotListId && this.savedSlotLists.length) {
            this.selectedSlotListId = this.savedSlotLists[this.savedSlotLists.length - 1].id;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load saved slot lists', err);
        }
      });
  }

  protected toggleSlotListMenu(): void {
    if (!this.savedSlotLists.length) return;
    this.slotListMenuOpen = !this.slotListMenuOpen;
  }

  protected selectSlotList(id: string): void {
    this.selectedSlotListId = id;
    this.slotListMenuOpen = false;
  }

  protected renameSlotList(list: SavedSlotList, event?: Event): void {
    event?.stopPropagation();
    const proposed = window.prompt('Edit list name:', list.name);
    if (proposed === null) return;
    const trimmed = proposed.trim();
    if (!trimmed || trimmed === list.name) {
      return;
    }

    this.http
      .patch<SavedSlotList>(`${this.apiBase}/slot-lists/${list.id}`, { name: trimmed })
      .subscribe({
        next: (updated) => {
          this.savedSlotLists = this.savedSlotLists.map((l) =>
            l.id === updated.id ? { ...l, name: updated.name } : l
          );
        },
        error: (err) => {
          console.error('Failed to rename slot list', err);
          window.alert('Failed to rename slot list. Please try again.');
        }
      });
  }

  protected deleteSlotList(id: string): void {
    if (!id) return;
    this.http.delete<{ status: string; id: string }>(`${this.apiBase}/slot-lists/${id}`).subscribe({
      next: () => {
        this.savedSlotLists = this.savedSlotLists.filter((list) => list.id !== id);
        if (this.selectedSlotListId === id) {
          this.selectedSlotListId = this.savedSlotLists.length
            ? this.savedSlotLists[this.savedSlotLists.length - 1].id
            : null;
        }
        if (!this.savedSlotLists.length) {
          this.slotListMenuOpen = false;
        }
      },
      error: (err) => {
        console.error('Failed to delete slot list', err);
      }
    });
  }

  @HostListener('document:click', ['$event'])
  protected handleOutsideClick(event: MouseEvent): void {
    if (!this.slotListMenuOpen) return;
    const target = event.target as Node | null;
    const dropdown = this.host.nativeElement.querySelector('.slot-list-dropdown') as HTMLElement | null;
    if (dropdown && target && !dropdown.contains(target)) {
      this.slotListMenuOpen = false;
    }
  }

  private persistState(): void {
    this.normalizeTasks();
    this.updateDerivedState();
    this.cdr.markForCheck();
    this.http
      .post(`${this.apiBase}/sync`, {
        slots: this.slots,
        tasks: this.tasks,
        noTimeTasks: this.noTimeTaskNames()
      })
      .subscribe({
        error: (err) => {
          console.error('Failed to save data', err);
        }
      });
  }

  protected addNoTimeTask(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const task = this.buildNoTimeTask(trimmed);
    this.tasks = [...this.tasks, task];
    this.persistState();
  }

  protected submitNoTimeTask(): void {
    const trimmed = this.noTimeDraft.trim();
    if (!trimmed) return;
    this.addNoTimeTask(trimmed);
    this.noTimeDraft = '';
  }

  private toMinutes(t: string): number | null {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  private cleanupPassedSlots(now: Date = new Date()): void {
    if (!this.slots.length) return;
    const passedIds = this.slots
      .filter((slot) => this.isSlotPassed(slot, now))
      .map((slot) => slot.id);
    if (!passedIds.length) return;

    const passedIdSet = new Set(passedIds);
    const tasksAssignedToRemoved = this.tasks.filter(
      (t) => t.assignedSlotId && passedIdSet.has(t.assignedSlotId)
    );
    if (tasksAssignedToRemoved.length) {
      this.tasks = this.tasks.map((task) =>
        task.assignedSlotId && passedIdSet.has(task.assignedSlotId)
          ? this.markTaskPendingCleanup(task)
          : task
      );
    }

    const removed = this.removeSlotsByIds(passedIds, true);
    if (removed) {
      if (tasksAssignedToRemoved.length) {
        this.cleanupModalOpen = true;
      }
      this.persistState();
    }
  }

  private isSlotPassed(slot: Slot, now: Date): boolean {
    const dayIndex = this.days.indexOf(slot.day);
    if (dayIndex < 0) return false;
    const endMin = this.toMinutes(slot.end);
    if (endMin === null) return false;

    const nowDayIndex = now.getDay();
    const dayDelta = dayIndex - nowDayIndex;
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + dayDelta);
    endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

    return endDate <= now;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private computeHours(start: string, end: string): number | null {
    if (!start || !end) return null;

    const startMin = this.toMinutes(start);
    const endMin = this.toMinutes(end);

    if (startMin === null || endMin === null) return null;
    if (endMin <= startMin) return null;

    const diffHours = (endMin - startMin) / 60;
    return Math.round(diffHours * 100) / 100;
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private taskStatusKey(task: Task): string {
    if (task.postponed) return 'postponed';
    if (task.assignedSlotId) return `assigned:${task.assignedSlotId}`;
    return 'unassigned';
  }

  private isNoTimeTask(task: Task): boolean {
    return Array.isArray(task.tags) && task.tags.includes(this.noTimeTag);
  }

  private isPendingCleanupTask(task: Task): boolean {
    return Array.isArray(task.tags) && task.tags.includes(this.pendingCleanupTag);
  }

  private normalizedTags(tags: string[]): string[] {
    const normalized = (tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean);
    return Array.from(new Set(normalized)).sort();
  }

  private buildNoTimeTask(name: string): Task {
    return {
      id: this.generateId('task'),
      name,
      tags: [this.noTimeTag],
      duration: 0,
      assignedSlotId: null,
      postponed: false
    };
  }

  private noTimeTaskNames(): string[] {
    return this.noTimeTasks.map((task) => task.name);
  }

  private normalizeTasks(): void {
    if (!this.tasks.length) return;

    const groups = new Map<string, Task>();

    for (const task of this.tasks) {
      const trimmedName = task.name.trim();
      const normalizedName = trimmedName || task.name;
      const tags = this.normalizedTags(Array.isArray(task.tags) ? task.tags : []);
      const key = `${normalizedName.toLowerCase()}::${this.taskStatusKey(task)}::${tags.join('|')}`;
      const copy: Task = { ...task, name: normalizedName, tags };

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, copy);
      } else {
        groups.set(key, {
          ...existing,
          duration: this.roundHours(existing.duration + copy.duration)
        });
      }
    }

    this.tasks = Array.from(groups.values());
  }

  private updateDerivedState(): void {
    this.totalSlotHours = this.roundHours(
      this.slots.reduce((sum, slot) => sum + slot.hours, 0)
    );

    const required: Task[] = [];
    const noTime: Task[] = [];
    const pending: Task[] = [];
    let taskTotal = 0;
    let hasAssigned = false;

    for (const task of this.tasks) {
      if (this.isPendingCleanupTask(task)) {
        pending.push(task);
        continue;
      }
      if (this.isNoTimeTask(task)) {
        noTime.push(task);
        continue;
      }
      required.push(task);
      taskTotal += task.duration;
      if (task.assignedSlotId) {
        hasAssigned = true;
      }
    }

    this.requiredTasks = required;
    this.noTimeTasks = noTime;
    this.pendingCleanupTasks = pending;
    if (pending.length && !this.cleanupModalOpen) {
      this.cleanupModalOpen = true;
    }
    this.totalTaskHours = this.roundHours(taskTotal);
    this.hasAssignedTasks = hasAssigned;
    this.hourDifference = this.roundHours(this.totalSlotHours - this.totalTaskHours);
  }

  private resetSlotDraft(day: string = this.days[0]): void {
    this.newSlot = this.createDefaultSlotDraft(day);
  }

  private resetTaskDraft(): void {
    this.newTask = this.createDefaultTaskDraft();
  }

  private createDefaultSlotDraft(day: string = this.days[0]): SlotDraft {
    return { day, start: this.defaultStart, end: this.defaultEnd };
  }

  private createDefaultTaskDraft(): { name: string; duration: number } {
    return { name: '', duration: 1 };
  }

  private removeSlotsByIds(ids: string[], deleteAssignedTasks: boolean = true): boolean {
    if (!ids.length) return false;
    const idSet = new Set(ids);

    if (this.editingSlotIndex !== null) {
      const editingId = this.slots[this.editingSlotIndex]?.id;
      if (editingId && idSet.has(editingId)) {
        this.editingSlotIndex = null;
      }
    }

    const beforeCount = this.slots.length;
    this.slots = this.slots.filter((s) => !idSet.has(s.id));
    const removed = beforeCount !== this.slots.length;

    if (removed) {
      const tasksAssignedToRemoved = this.tasks.filter(
        (t) => t.assignedSlotId && idSet.has(t.assignedSlotId)
      );
      if (deleteAssignedTasks) {
        const tasksToRemove = new Set(tasksAssignedToRemoved.map((t) => t.id));
        this.tasks = this.tasks.filter((t) => !tasksToRemove.has(t.id));
      } else {
        this.tasks = this.tasks.map((t) =>
          t.assignedSlotId && idSet.has(t.assignedSlotId) ? { ...t, assignedSlotId: null } : t
        );
      }

      this.selectedSlotIds = new Set(
        Array.from(this.selectedSlotIds).filter((id) => !idSet.has(id))
      );
    }

    return removed;
  }

  protected confirmDeletePendingCleanup(): void {
    if (!this.pendingCleanupTasks.length) return;
    const pendingIds = new Set(this.pendingCleanupTasks.map((task) => task.id));
    this.tasks = this.tasks.filter((task) => !pendingIds.has(task.id));
    this.cleanupModalOpen = false;
    this.persistState();
  }

  protected confirmReturnPendingCleanup(): void {
    if (!this.pendingCleanupTasks.length) return;
    const pendingIds = new Set(this.pendingCleanupTasks.map((task) => task.id));
    this.tasks = this.tasks.map((task) =>
      pendingIds.has(task.id) ? this.restorePendingCleanupTask(task) : task
    );
    this.cleanupModalOpen = false;
    this.persistState();
  }

  protected keepPendingCleanupTask(taskId: string): void {
    if (!taskId) return;
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || !this.isPendingCleanupTask(task)) return;
    this.tasks = this.tasks.map((t) => (t.id === taskId ? this.restorePendingCleanupTask(t) : t));
    if (!this.tasks.some((t) => this.isPendingCleanupTask(t))) {
      this.cleanupModalOpen = false;
    }
    this.persistState();
  }

  protected deletePendingCleanupTask(taskId: string): void {
    if (!taskId) return;
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || !this.isPendingCleanupTask(task)) return;
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    if (!this.tasks.some((t) => this.isPendingCleanupTask(t))) {
      this.cleanupModalOpen = false;
    }
    this.persistState();
  }

  private markTaskPendingCleanup(task: Task): Task {
    const nextTags = new Set([...(task.tags ?? []), this.pendingCleanupTag]);
    return {
      ...task,
      assignedSlotId: null,
      tags: Array.from(nextTags)
    };
  }

  private restorePendingCleanupTask(task: Task): Task {
    const tags = (task.tags ?? []).filter((tag) => tag !== this.pendingCleanupTag);
    return {
      ...task,
      assignedSlotId: null,
      tags
    };
  }
}
