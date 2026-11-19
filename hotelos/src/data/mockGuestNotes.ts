import type { GuestNote } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';

const d = (o: number) => addDays(DEMO_TODAY, o);

export const mockGuestNotes: GuestNote[] = [
  { id: 'gn-001', guestId: 'g-003', date: d(-40), author: 'Amara Eze', kind: 'note', text: 'Long-standing corporate client. Prefers a quiet room away from the lift.' },
  { id: 'gn-002', guestId: 'g-003', date: d(-12), author: 'Tolu Adeniyi', kind: 'request', text: 'Requests fresh flowers and still water on arrival.' },
  { id: 'gn-003', guestId: 'g-008', date: d(-30), author: 'Amara Eze', kind: 'note', text: 'Government delegation lead — airport pickup arranged for every stay.' },
  { id: 'gn-004', guestId: 'g-001', date: d(-1), author: 'Tolu Adeniyi', kind: 'request', text: 'Extra pillows and a late breakfast on Saturday.' },
  { id: 'gn-005', guestId: 'g-005', date: d(-20), author: 'Blessing Ojo', kind: 'complaint', text: 'Reported noise from the corridor on the first night.', resolved: true },
  { id: 'gn-006', guestId: 'g-022', date: d(-8), author: 'Tolu Adeniyi', kind: 'complaint', text: 'Slow Wi-Fi in the room; engineer asked to check.', resolved: false },
  { id: 'gn-007', guestId: 'g-014', date: d(-15), author: 'Amara Eze', kind: 'note', text: 'Allergic to feather bedding — always use synthetic pillows.' },
];
