export type AuditModule = 'Authentication' | 'Reservations' | 'Front desk' | 'Billing' | 'Rooms' | 'Housekeeping' | 'Maintenance' | 'Inventory' | 'Procurement' | 'Staff' | 'Administration' | 'Settings';
export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  role: string;
  action: string;
  module: AuditModule;
  description: string;
  related: string;
  status: 'Success' | 'Pending' | 'Attention';
}

const KEY = 'hotelos-audit-log-v1';
const seed: AuditEntry[] = [
  ['login', 'Authentication', 'User login', 'Manager demo session started', 'SESSION-001', 'Success'],
  ['reservation', 'Reservations', 'Reservation created', 'New reservation HOS-2611-042 created for a Superior Room', 'HOS-2611-042', 'Success'],
  ['checkin', 'Front desk', 'Guest check-in', 'Adaeze Okonkwo checked in to room 101', 'HOS-2611-001', 'Success'],
  ['payment', 'Billing', 'Payment recorded', 'POS payment recorded against guest folio', 'PAY-2611-0042', 'Success'],
  ['room', 'Rooms', 'Room status changed', 'Room 205 marked dirty after departure', 'ROOM-205', 'Success'],
  ['task', 'Housekeeping', 'Task assigned', 'Turnover cleaning assigned to Chika Nwosu', 'HK-205-014', 'Success'],
  ['maintenance', 'Maintenance', 'Maintenance updated', 'Air-conditioning inspection marked in progress', 'MT-008', 'Pending'],
  ['stock', 'Inventory', 'Stock adjusted', 'Bath towel stock count updated after physical count', 'LIN-BT', 'Attention'],
  ['po', 'Procurement', 'Purchase order created', 'Purchase order raised for guest amenities', 'PO-2611-006', 'Success'],
  ['staff', 'Staff', 'Staff record updated', 'A staff profile was updated by the General Manager', 'ST-014', 'Success'],
  ['settings', 'Settings', 'Hotel settings updated', 'Regional preferences reviewed', 'CFG-REGIONAL', 'Success'],
  ['role', 'Administration', 'Permissions changed', 'Front Desk role permissions reviewed', 'ROLE-FD', 'Success'],
].map(([id, module, action, description, related, status], index) => ({
  id, module: module as AuditModule, action, description, related, status: status as AuditEntry['status'],
  user: index === 2 ? 'Chika Nwosu' : 'Blessing Ojo',
  role: index === 2 ? 'Front Desk' : 'General Manager',
  at: `2026-11-${String(8 - Math.floor(index / 4)).padStart(2, '0')}T${String(8 + (index * 2) % 11).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}:00`,
}));

function read(): AuditEntry[] {
  if (typeof localStorage === 'undefined') return [...seed];
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as AuditEntry[]; } catch { /* use demo seed */ }
  return [...seed];
}

export function getAuditEntries(): AuditEntry[] { return read(); }

export function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'at'>) {
  const rows = read();
  const next: AuditEntry = { ...entry, id: `AUD-${Date.now()}`, at: new Date().toISOString() };
  const updated = [next, ...rows];
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { /* browser storage may be unavailable */ }
  return next;
}
