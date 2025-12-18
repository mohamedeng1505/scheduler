import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Slot, Task } from '../types';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['../app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksComponent implements OnChanges {
  @Input() tasks: Task[] = [];
  @Input() slots: Slot[] = [];
  @Output() tasksChange = new EventEmitter<Task[]>();

  protected editingTaskId: string | null = null;
  protected editingTaskDraft: { name: string; duration: number } = { name: '', duration: 1 };
  protected draggingTaskId: string | null = null;

  protected totalTaskHours = 0;
  protected unassignedTaskHours = 0;
  protected assignedTaskHours = 0;
  protected postponedTaskHours = 0;
  protected sortedTasks: Task[] = [];
  protected activeTasks: Task[] = [];
  protected postponedTasks: Task[] = [];
  protected taskSummary: { name: string; totalHours: number }[] = [];

  private slotById = new Map<string, Slot>();

  ngOnChanges(): void {
    if (this.editingTaskId && !this.tasks.some((t) => t.id === this.editingTaskId)) {
      this.editingTaskId = null;
      this.editingTaskDraft = { name: '', duration: 1 };
    }
    if (this.draggingTaskId && !this.tasks.some((t) => t.id === this.draggingTaskId)) {
      this.handleTaskDragEnd();
    }

    this.slotById = new Map(this.slots.map((slot) => [slot.id, slot]));
    this.updateDerivedState();
  }

  protected trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  protected trackByTaskSummaryName(_index: number, summary: { name: string; totalHours: number }): string {
    return summary.name;
  }

  private updateDerivedState(): void {
    const summary = new Map<string, { name: string; totalHours: number }>();
    let total = 0;
    let assigned = 0;
    let unassigned = 0;
    let postponedTotal = 0;

    for (const task of this.tasks) {
      const duration = task.duration;
      if (!task.postponed) {
        total += duration;
        if (task.assignedSlotId) {
          assigned += duration;
        } else {
          unassigned += duration;
        }
      } else {
        postponedTotal += duration;
      }

      const trimmedName = task.name.trim();
      if (!trimmedName) continue;
      const key = trimmedName.toLowerCase();
      const existing = summary.get(key);
      if (existing) {
        existing.totalHours = this.roundHours(existing.totalHours + duration);
      } else {
        summary.set(key, { name: trimmedName, totalHours: this.roundHours(duration) });
      }
    }

    const sortedTasks = [...this.tasks].sort((a, b) => {
      const aAssigned = a.assignedSlotId ? 1 : 0;
      const bAssigned = b.assignedSlotId ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      return b.duration - a.duration;
    });

    const sortedActive = sortedTasks.filter((task) => !task.postponed);
    const sortedPostponed = sortedTasks.filter((task) => task.postponed);

    this.totalTaskHours = this.roundHours(total);
    this.unassignedTaskHours = this.roundHours(unassigned);
    this.assignedTaskHours = this.roundHours(assigned);
    this.postponedTaskHours = this.roundHours(postponedTotal);
    this.sortedTasks = sortedTasks;
    this.activeTasks = sortedActive;
    this.postponedTasks = sortedPostponed;
    this.taskSummary = Array.from(summary.values()).sort((a, b) => {
      if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
      return a.name.localeCompare(b.name);
    });
  }

  public isEditing(taskId: string): boolean {
    return this.editingTaskId === taskId;
  }

  public handleTaskDragStart(taskId: string): void {
    this.draggingTaskId = taskId;
  }

  public handleTaskDragEnd(): void {
    this.draggingTaskId = null;
  }

  public allowSlotDrop(event: DragEvent): void {
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

    const updatedTasks = this.tasks
      .filter((t) => t.id !== sourceTask.id)
      .map((t) =>
        t.id === targetTask.id
          ? { ...t, duration: mergedDuration, assignedSlotId: mergedAssignedSlotId, postponed: mergedPostponed }
          : t
      );

    this.emitTasks(updatedTasks);
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

    this.emitTasks(
      this.tasks.map((t) =>
        t.id === taskId ? { ...t, assignedSlotId: null } : t
      )
    );
    this.handleTaskDragEnd();
  }

  public handleDropOnSlot(event: DragEvent, slotId: string): void {
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
      const next = this.tasks.map((t) =>
        t.id === taskId ? { ...t, assignedSlotId: slotId } : t
      );
      this.emitTasks(next);
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

      this.emitTasks([...updatedTasks, newTask]);
    }

    this.handleTaskDragEnd();
  }

  public unassignTask(taskId: string): void {
    this.emitTasks(
      this.tasks.map((t) =>
        t.id === taskId ? { ...t, assignedSlotId: null } : t
      )
    );
  }

  public deleteTask(taskId: string): void {
    const next = this.tasks.filter((t) => t.id !== taskId);
    this.emitTasks(next);
    if (this.draggingTaskId === taskId) {
      this.handleTaskDragEnd();
    }
  }

  protected startEditTask(task: Task): void {
    this.editingTaskId = task.id;
    this.editingTaskDraft = { name: task.name, duration: task.duration };
  }

  protected duplicateTask(task: Task): void {
    if (!task) return;
    const nextName = this.nextDuplicateName(task.name);
    const copy: Task = {
      ...task,
      id: this.generateId('task'),
      name: nextName,
      assignedSlotId: null,
      postponed: false
    };
    this.emitTasks([...this.tasks, copy]);
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

    const nextTasks = this.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            name: trimmedName,
            duration: Math.round(duration * 100) / 100
          }
        : t
    );

    this.emitTasks(nextTasks);
    this.editingTaskId = null;
    this.editingTaskDraft = { name: '', duration: 1 };
    form.resetForm();
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
    this.emitTasks(
      this.tasks.map((t) =>
        t.id === taskId ? { ...t, postponed: !t.postponed } : t
      )
    );
  }

  private emitTasks(next: Task[]): void {
    this.tasksChange.emit(next);
  }

  private stripNumberSuffix(name: string): { base: string; suffix: number | null } {
    const trimmed = name.trim();
    const match = trimmed.match(/^(.*)\s\((\d+)\)$/);
    if (!match) {
      return { base: trimmed, suffix: null };
    }
    const base = match[1].trim();
    const suffix = Number.parseInt(match[2], 10);
    return Number.isNaN(suffix) ? { base: trimmed, suffix: null } : { base, suffix };
  }

  private nextDuplicateName(originalName: string): string {
    const { base } = this.stripNumberSuffix(originalName);
    const existing = new Set(this.tasks.map((t) => t.name.trim()));

    let counter = 1;
    while (existing.has(`${base} (${counter})`)) {
      counter += 1;
    }

    return `${base} (${counter})`;
  }

  private remainingHoursForSlot(slotId: string, excludeTaskId?: string): number {
    const slot = this.slotById.get(slotId);
    if (!slot) return 0;

    const used = this.tasks
      .filter((t) => t.assignedSlotId === slotId && t.id !== excludeTaskId)
      .reduce((sum, t) => sum + t.duration, 0);

    return Math.max(slot.hours - used, 0);
  }

  private remainingHoursForSlotExcluding(slotId: string, excludeTaskIds: string[] = []): number {
    const slot = this.slotById.get(slotId);
    if (!slot) return 0;
    const exclude = new Set(excludeTaskIds);
    const used = this.tasks
      .filter((t) => t.assignedSlotId === slotId && !exclude.has(t.id))
      .reduce((sum, t) => sum + t.duration, 0);

    return Math.max(slot.hours - used, 0);
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private sumTaskHours(predicate: (task: Task) => boolean): number {
    const total = this.tasks.filter(predicate).reduce((sum, task) => sum + task.duration, 0);
    return this.roundHours(total);
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
