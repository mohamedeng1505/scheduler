import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Slot, Task } from '../types';
import { TasksComponent } from '../tasks/tasks.component';

@Component({
  selector: 'app-time-slots',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-slots.component.html',
  styleUrls: ['../app.css']
})
export class TimeSlotsComponent {
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

  protected get sortedSlots(): Slot[] {
    return [...this.slots].sort((a, b) => this.slotSortValue(a) - this.slotSortValue(b));
  }

  protected get totalHours(): number {
    return this.slots.reduce((sum, slot) => sum + slot.hours, 0);
  }

  protected tasksForSlot(slotId: string): Task[] {
    return this.tasks.filter((t) => t.assignedSlotId === slotId);
  }

  protected isSlotSelected(slotId: string): boolean {
    return this.selectedSlotIds.has(slotId);
  }

  protected isSlotFull(slotId: string): boolean {
    const remaining = this.remainingHoursForSlot(slotId);
    return remaining <= 0.001;
  }

  private slotSortValue(slot: Slot): number {
    const dayOrder = this.days.length ? this.days : this.fallbackDays;
    const dayIndex = dayOrder.indexOf(slot.day);
    const startMin = this.toMinutes(slot.start) ?? 0;
    return (dayIndex === -1 ? Number.MAX_SAFE_INTEGER : dayIndex) * 1440 + startMin;
  }

  private remainingHoursForSlot(slotId: string): number {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return 0;

    const used = this.tasks
      .filter((t) => t.assignedSlotId === slotId)
      .reduce((sum, t) => sum + t.duration, 0);

    return Math.max(slot.hours - used, 0);
  }

  private toMinutes(t: string): number | null {
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }
}
