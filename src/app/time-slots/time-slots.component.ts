import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Slot, Task } from '../types';
import { TasksComponent } from '../tasks/tasks.component';

@Component({
  selector: 'app-time-slots',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-slots.component.html',
  styleUrls: ['../app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeSlotsComponent implements OnChanges {
  private readonly fallbackDays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];

  @Input() days: string[] = this.fallbackDays;
  @Input() slots: Slot[] = [];
  @Input() tasks: Task[] = [];
  @Input() selectedSlotIds: Set<string> = new Set<string>();
  @Input() tasksComponent?: TasksComponent;

  @Output() slotEdit = new EventEmitter<string>();
  @Output() slotDuplicate = new EventEmitter<string>();
  @Output() slotDelete = new EventEmitter<string>();
  @Output() slotSelectionToggle = new EventEmitter<string>();

  protected sortedSlots: Slot[] = [];
  protected totalHours = 0;

  private tasksBySlotId = new Map<string, Task[]>();
  private remainingBySlotId = new Map<string, number>();

  protected tasksForSlot(slotId: string): Task[] {
    return this.tasksBySlotId.get(slotId) ?? [];
  }

  protected isSlotSelected(slotId: string): boolean {
    return this.selectedSlotIds.has(slotId);
  }

  protected isSlotFull(slotId: string): boolean {
    const remaining = this.remainingBySlotId.get(slotId) ?? 0;
    return remaining <= 0.001;
  }

  protected trackBySlotId(_index: number, slot: Slot): string {
    return slot.id;
  }

  protected trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  ngOnChanges(): void {
    this.updateDerivedState();
  }

  private slotSortValue(slot: Slot): number {
    const dayOrder = this.days.length ? this.days : this.fallbackDays;
    const dayIndex = dayOrder.indexOf(slot.day);
    const startMin = this.toMinutes(slot.start) ?? 0;
    return (dayIndex === -1 ? Number.MAX_SAFE_INTEGER : dayIndex) * 1440 + startMin;
  }

  private updateDerivedState(): void {
    this.sortedSlots = [...this.slots].sort((a, b) => this.slotSortValue(a) - this.slotSortValue(b));
    this.totalHours = this.slots.reduce((sum, slot) => sum + slot.hours, 0);

    const tasksBySlotId = new Map<string, Task[]>();
    const usedBySlotId = new Map<string, number>();

    for (const task of this.tasks) {
      if (!task.assignedSlotId) continue;
      const slotId = task.assignedSlotId;
      const list = tasksBySlotId.get(slotId) ?? [];
      list.push(task);
      tasksBySlotId.set(slotId, list);
      usedBySlotId.set(slotId, (usedBySlotId.get(slotId) ?? 0) + task.duration);
    }

    const remainingBySlotId = new Map<string, number>();
    for (const slot of this.slots) {
      const used = usedBySlotId.get(slot.id) ?? 0;
      remainingBySlotId.set(slot.id, Math.max(slot.hours - used, 0));
    }

    this.tasksBySlotId = tasksBySlotId;
    this.remainingBySlotId = remainingBySlotId;
  }

  private toMinutes(t: string): number | null {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }
}
