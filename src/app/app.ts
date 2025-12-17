import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ElementRef, HostListener } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { OnInit } from '@angular/core';

interface Slot {
  id: string;
  day: string;
  start: string; // HH:mm
  end: string; // HH:mm
  hours: number;
}

interface Task {
  id: string;
  name: string;
  duration: number;
  assignedSlotId: string | null;
  postponed?: boolean;
}

type SlotDraft = Pick<Slot, 'day' | 'start' | 'end'>;
type SavedSlotList = { id: string; name: string; slots: Slot[] };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
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
  protected editingTaskId: string | null = null;
  protected editingTaskDraft: { name: string; duration: number } = { name: '', duration: 1 };
  protected draggingTaskId: string | null = null;
  protected selectedSlotIds: Set<string> = new Set<string>();
  protected selectedSlotListId: string | null = null;
  protected slotListMenuOpen = false;

  constructor(private http: HttpClient, private host: ElementRef) {}

  ngOnInit(): void {
    this.loadData();
    this.loadSavedSlotLists();
  }

  protected get sortedSlots(): Slot[] {
    return [...this.slots].sort((a, b) => this.slotSortValue(a) - this.slotSortValue(b));
  }

  protected get selectedSlotCount(): number {
    return this.selectedSlotIds.size;
  }

  protected get totalHours(): number {
    return this.slots.reduce((sum, slot) => sum + slot.hours, 0);
  }

  protected get totalTaskHours(): number {
    return this.tasks
      .filter((task) => !task.postponed)
      .reduce((sum, task) => sum + task.duration, 0);
  }

  protected get sortedTasks(): Task[] {
    return [...this.tasks].sort((a, b) => {
      const aAssigned = a.assignedSlotId ? 1 : 0;
      const bAssigned = b.assignedSlotId ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      return b.duration - a.duration;
    });
  }

  protected get activeTasks(): Task[] {
    return this.sortedTasks.filter((task) => !task.postponed);
  }

  protected get postponedTasks(): Task[] {
    return this.sortedTasks.filter((task) => task.postponed);
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

  protected startEdit(index: number): void {
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

  protected duplicateSlot(index: number): void {
    if (index < 0) return;
    const slot = this.slots[index];
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

  protected handleTaskDragStart(taskId: string): void {
    this.draggingTaskId = taskId;
  }

  protected handleTaskDragEnd(): void {
    this.draggingTaskId = null;
  }

  protected allowSlotDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected allowTaskReturnDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected allowTaskOver(event: DragEvent, targetTaskId: string): void {
    if (!this.draggingTaskId || this.draggingTaskId === targetTaskId) return;
    event.preventDefault();
  }

  protected handleTaskDropOnTask(event: DragEvent, targetTaskId: string): void {
    event.preventDefault();
    const sourceTaskId = this.draggingTaskId;
    if (!sourceTaskId || sourceTaskId === targetTaskId) {
      this.handleTaskDragEnd();
      return;
    }

    const sourceTask = this.tasks.find((t) => t.id === sourceTaskId);
    const targetTask = this.tasks.find((t) => t.id === targetTaskId);

    if (!sourceTask || !targetTask) {
      this.handleTaskDragEnd();
      return;
    }

    const sourceName = sourceTask.name.trim().toLowerCase();
    const targetName = targetTask.name.trim().toLowerCase();

    if (!sourceName || sourceName !== targetName) {
      this.handleTaskDragEnd();
      return;
    }

    const mergedDuration = this.roundHours(sourceTask.duration + targetTask.duration);
    let mergedAssignedSlotId = targetTask.assignedSlotId ?? sourceTask.assignedSlotId ?? null;
    const mergedPostponed = !!(targetTask.postponed || sourceTask.postponed);

    if (mergedAssignedSlotId) {
      const available = this.remainingHoursForSlotExcluding(mergedAssignedSlotId, [
        sourceTask.id,
        targetTask.id
      ]);
      if (mergedDuration > available) {
        mergedAssignedSlotId = null;
      }
    }

    this.tasks = this.tasks
      .filter((t) => t.id !== sourceTask.id)
      .map((t) =>
        t.id === targetTask.id
          ? { ...t, duration: mergedDuration, assignedSlotId: mergedAssignedSlotId, postponed: mergedPostponed }
          : t
      );

    this.persistState();
    this.handleTaskDragEnd();
  }

  protected handleTaskReturnDrop(event: DragEvent): void {
    event.preventDefault();
    const taskId = this.draggingTaskId;
    if (!taskId) {
      this.handleTaskDragEnd();
      return;
    }

    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      this.handleTaskDragEnd();
      return;
    }

    this.tasks = this.tasks.map((t) =>
      t.id === taskId ? { ...t, assignedSlotId: null } : t
    );
    this.handleTaskDragEnd();
    this.persistState();
  }

  protected dropTaskOnSlot(event: DragEvent, slotId: string): void {
    event.preventDefault();
    const taskId = this.draggingTaskId;
    const slot = this.slots.find((s) => s.id === slotId);
    const task = this.tasks.find((t) => t.id === taskId);
    if (!taskId || !slot || !task) {
      this.handleTaskDragEnd();
      return;
    }

    const remaining = this.remainingHoursForSlot(slotId, taskId);
    const available = this.roundHours(remaining);

    if (task.duration <= available) {
      this.tasks = this.tasks.map((t) =>
        t.id === taskId ? { ...t, assignedSlotId: slotId } : t
      );
    } else {
      if (available <= 0) {
        this.handleTaskDragEnd();
        return;
      }

      const splitDuration = available;
      const remainder = this.roundHours(task.duration - splitDuration);

      const newTask: Task = {
        ...task,
        id: this.generateId('task'),
        duration: splitDuration,
        assignedSlotId: slotId,
        postponed: false
      };

      const updatedTasks = remainder > 0
        ? this.tasks.map((t) =>
            t.id === taskId ? { ...t, duration: remainder, assignedSlotId: null } : t
          )
        : this.tasks.filter((t) => t.id !== taskId);

      this.tasks = [...updatedTasks, newTask];
    }

    this.handleTaskDragEnd();
    this.persistState();
  }

  protected unassignTask(taskId: string): void {
    this.tasks = this.tasks.map((t) =>
      t.id === taskId ? { ...t, assignedSlotId: null } : t
    );
    this.persistState();
  }

  protected tasksForSlot(slotId: string): Task[] {
    return this.tasks.filter((t) => t.assignedSlotId === slotId);
  }

  protected slotIndex(slotId: string): number {
    return this.slots.findIndex((s) => s.id === slotId);
  }

  protected isSlotSelected(slotId: string): boolean {
    return this.selectedSlotIds.has(slotId);
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

  protected deleteTask(taskId: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    if (this.draggingTaskId === taskId) {
      this.handleTaskDragEnd();
    }
    this.persistState();
  }

  protected startEditTask(task: Task): void {
    this.editingTaskId = task.id;
    this.editingTaskDraft = { name: task.name, duration: task.duration };
  }

  protected duplicateTask(task: Task): void {
    if (!task) return;
    const copy: Task = {
      ...task,
      id: this.generateId('task'),
      assignedSlotId: null,
      postponed: false
    };
    this.tasks = [...this.tasks, copy];
    this.persistState();
  }

  protected cancelEditTask(form: NgForm): void {
    this.editingTaskId = null;
    this.editingTaskDraft = { name: '', duration: 1 };
    form.resetForm();
  }

  protected saveTaskEdit(taskId: string, form: NgForm): void {
    const trimmedName = this.editingTaskDraft.name.trim();
    const duration = Number(this.editingTaskDraft.duration);
    const task = this.tasks.find((t) => t.id === taskId);

    if (!task || !trimmedName || Number.isNaN(duration) || duration <= 0) {
      return;
    }

    if (task.assignedSlotId) {
      const remaining = this.remainingHoursForSlot(task.assignedSlotId, taskId);
      if (duration > remaining) {
        return;
      }
    }

    this.tasks = this.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            name: trimmedName,
            duration: Math.round(duration * 100) / 100
          }
        : t
    );

    this.editingTaskId = null;
    this.editingTaskDraft = { name: '', duration: 1 };
    form.resetForm();
    this.persistState();
  }

  protected availableHoursForTask(task: Task): number | null {
    if (!task.assignedSlotId) return null;
    return this.remainingHoursForSlot(task.assignedSlotId, task.id);
  }

  protected editExceedsSlot(task: Task): boolean {
    const available = this.availableHoursForTask(task);
    const duration = Number(this.editingTaskDraft.duration);
    if (available === null) return false;
    if (Number.isNaN(duration)) return false;
    return duration > available;
  }

  protected toggleTaskPostpone(taskId: string): void {
    this.tasks = this.tasks.map((t) =>
      t.id === taskId ? { ...t, postponed: !t.postponed } : t
    );
    this.persistState();
  }

  private slotSortValue(slot: Slot): number {
    const dayIndex = this.days.indexOf(slot.day);
    const startMin = this.toMinutes(slot.start) ?? 0;
    return (dayIndex === -1 ? Number.MAX_SAFE_INTEGER : dayIndex) * 1440 + startMin;
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
      this.tasks = this.tasks.map((t) =>
        t.assignedSlotId && idSet.has(t.assignedSlotId) ? { ...t, assignedSlotId: null } : t
      );
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

  private remainingHoursForSlot(slotId: string, excludeTaskId?: string): number {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return 0;

    const used = this.tasks
      .filter((t) => t.assignedSlotId === slotId && t.id !== excludeTaskId)
      .reduce((sum, t) => sum + t.duration, 0);

    return Math.max(slot.hours - used, 0);
  }

  private remainingHoursForSlotExcluding(slotId: string, excludeTaskIds: string[] = []): number {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return 0;
    const exclude = new Set(excludeTaskIds);
    const used = this.tasks
      .filter((t) => t.assignedSlotId === slotId && !exclude.has(t.id))
      .reduce((sum, t) => sum + t.duration, 0);

    return Math.max(slot.hours - used, 0);
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
}
