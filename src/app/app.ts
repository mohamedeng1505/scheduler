import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

interface Slot {
  name: string;
  day: string;
  start: string; // HH:mm
  end: string;   // HH:mm
  hours: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];

  protected slots: Slot[] = [];
  protected newSlot: Slot = { name: '', day: this.days[0], start: '09:00', end: '10:00', hours: 1 };
  protected editingIndex: number | null = null;

  protected get totalHours(): number {
    return this.slots.reduce((sum, slot) => sum + slot.hours, 0);
  }

  protected get derivedHours(): number | null {
    return this.computeHours(this.newSlot.start, this.newSlot.end);
  }

  protected saveSlot(form: NgForm): void {
    const trimmedName = this.newSlot.name.trim();
    const hours = this.computeHours(this.newSlot.start, this.newSlot.end);

    if (!trimmedName || !this.newSlot.day || hours === null) {
      return;
    }

    const slot: Slot = {
      name: trimmedName,
      day: this.newSlot.day,
      start: this.newSlot.start,
      end: this.newSlot.end,
      hours
    };

    if (this.editingIndex === null) {
      this.slots = [...this.slots, slot];
    } else {
      const updated = [...this.slots];
      updated[this.editingIndex] = slot;
      this.slots = updated;
    }

    const keepDay = slot.day;
    this.newSlot = { name: '', day: keepDay, start: '09:00', end: '10:00', hours: 1 };
    form.resetForm({ name: '', day: keepDay, start: '09:00', end: '10:00', hours: 1 });
    this.editingIndex = null;
  }

  protected startEdit(index: number): void {
    const slot = this.slots[index];
    if (!slot) return;

    this.editingIndex = index;
    this.newSlot = { ...slot };
  }

  protected cancelEdit(form: NgForm): void {
    this.editingIndex = null;
    this.newSlot = { name: '', day: this.days[0], start: '09:00', end: '10:00', hours: 1 };
    form.resetForm({ name: '', day: this.days[0], start: '09:00', end: '10:00', hours: 1 });
  }

  protected duplicateSlot(index: number): void {
    const slot = this.slots[index];
    if (!slot) return;

    const copy: Slot = { ...slot, name: `${slot.name} (copy)` };
    this.slots = [...this.slots, copy];
  }

  private computeHours(start: string, end: string): number | null {
    if (!start || !end) return null;

    const toMinutes = (t: string): number | null => {
      const [h, m] = t.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      return h * 60 + m;
    };

    const startMin = toMinutes(start);
    const endMin = toMinutes(end);

    if (startMin === null || endMin === null) return null;
    if (endMin <= startMin) return null;

    const diffHours = (endMin - startMin) / 60;
    return Math.round(diffHours * 100) / 100; // two decimals
  }
}
