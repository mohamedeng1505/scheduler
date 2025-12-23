export interface Slot {
  id: string;
  day: string;
  start: string; // HH:mm
  end: string; // HH:mm
  hours: number;
}

export interface Task {
  id: string;
  name: string;
  tags: string[];
  duration: number;
  assignedSlotId: string | null;
  postponed?: boolean;
}

export type SlotDraft = Pick<Slot, 'day' | 'start' | 'end'>;
export type SavedSlotList = { id: string; name: string; slots: Slot[] };

