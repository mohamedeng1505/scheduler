import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { TasksComponent } from './tasks/tasks.component';
import { TimeSlotsComponent } from './time-slots/time-slots.component';
import { Slot, Task, SlotDraft, SavedSlotList } from './types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, TasksComponent, TimeSlotsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly apiBase = 'http://localhost:4000/api';

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
  protected savedSlotLists: SavedSlotList[] = [];

  protected newSlot: SlotDraft = { day: this.days[0], start: '09:00', end: '10:00' };
  protected newTask: { name: string; duration: number } = { name: '', duration: 1 };

  protected editingSlotIndex: number | null = null;
  protected selectedSlotIds: Set<string> = new Set<string>();
  protected selectedSlotListId: string | null = null;
  protected slotListMenuOpen = false;
  @ViewChild(TasksComponent) protected tasksComponent?: TasksComponent;

  constructor(private http: HttpClient, private host: ElementRef) {}

  ngOnInit(): void {
    this.loadData();
    this.loadSavedSlotLists();
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

  protected get totalSlotHours(): number {
    return this.slots.reduce((sum, slot) => sum + slot.hours, 0);
  }

  protected get totalTaskHours(): number {
    return this.tasks.reduce((sum, task) => sum + task.duration, 0);
  }

  protected get hourDifference(): number {
    return this.totalSlotHours - this.totalTaskHours;
  }

  protected get hasAssignedTasks(): boolean {
    return this.tasks.some((task) => !!task.assignedSlotId);
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
    this.newSlot = { day: keepDay, start: '09:00', end: '10:00' };
    form.resetForm({ day: keepDay, start: '09:00', end: '10:00' });
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
    this.newSlot = { day: this.days[0], start: '09:00', end: '10:00' };
    form.resetForm({ day: this.days[0], start: '09:00', end: '10:00' });
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
      duration: Math.round(duration * 100) / 100,
      assignedSlotId: null,
      postponed: false
    };

    this.tasks = [...this.tasks, task];
    this.newTask = { name: '', duration: 1 };
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
    this.tasks = next;
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
    this.newSlot = { day: this.days[0], start: '09:00', end: '10:00' };
    this.newTask = { name: '', duration: 1 };
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

  private removeSlotsByIds(ids: string[]): boolean {
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
      const tasksToRemove = new Set(
        this.tasks
          .filter((t) => t.assignedSlotId && idSet.has(t.assignedSlotId))
          .map((t) => t.id)
      );

      this.tasks = this.tasks.filter((t) => !tasksToRemove.has(t.id));

      this.selectedSlotIds = new Set(
        Array.from(this.selectedSlotIds).filter((id) => !idSet.has(id))
      );
    }

    return removed;
  }

  private loadData(): void {
    this.http
      .get<{ slots: Slot[]; tasks: Task[] }>(`${this.apiBase}/data`)
      .subscribe({
        next: (data) => {
          this.slots = data.slots ?? [];
          this.tasks = (data.tasks ?? []).map((t) => ({ ...t, postponed: !!t.postponed }));
          this.normalizeTasks();
          this.clearSlotSelection();
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
    this.http
      .post(`${this.apiBase}/sync`, {
        slots: this.slots,
        tasks: this.tasks
      })
      .subscribe({
        error: (err) => {
          console.error('Failed to save data', err);
        }
      });
  }

  private toMinutes(t: string): number | null {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
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

  private normalizeTasks(): void {
    if (!this.tasks.length) return;

    const groups = new Map<string, Task>();

    for (const task of this.tasks) {
      const trimmedName = task.name.trim();
      const normalizedName = trimmedName || task.name;
      const key = `${normalizedName.toLowerCase()}::${this.taskStatusKey(task)}`;
      const copy: Task = { ...task, name: normalizedName };

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
}
