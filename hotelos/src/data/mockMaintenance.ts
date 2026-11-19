import type { MaintenanceRequest } from '@/types';
import { addDays, DEMO_TODAY } from '@/utils/demoClock';

const d = (o: number) => addDays(DEMO_TODAY, o);

/** Blocking requests match the seeded room states: 105 and B8 under maintenance, 305 out of service. */
export const mockMaintenanceRequests: MaintenanceRequest[] = [
  { id: 'mt-001', hotelId: 'h-vi', roomId: 'rm-105', category: 'HVAC', priority: 'high', status: 'in_progress', assigneeId: 'st-007', description: 'Air-conditioning not cooling; compressor inspection under way.', costEstimate: 85000, blocksRoom: true, createdAt: d(-4) },
  { id: 'mt-002', hotelId: 'h-vi', roomId: 'rm-305', category: 'Renovation', priority: 'normal', status: 'in_progress', assigneeId: 'st-007', description: 'Bathroom refit and re-tiling.', costEstimate: 640000, blocksRoom: true, createdAt: d(-12) },
  { id: 'mt-003', hotelId: 'h-epe', roomId: 'rm-b8', category: 'Plumbing', priority: 'high', status: 'open', description: 'Shower drain slow; pipe clearance needed.', costEstimate: 30000, blocksRoom: true, createdAt: d(-2) },
  { id: 'mt-004', hotelId: 'h-vi', location: 'Main lobby', category: 'Electrical', priority: 'normal', status: 'assigned', assigneeId: 'st-008', description: 'Chandelier bulbs flickering.', costEstimate: 18000, blocksRoom: false, createdAt: d(-1) },
  { id: 'mt-005', hotelId: 'h-vi', location: 'Passenger lift 2', category: 'Mechanical', priority: 'urgent', status: 'in_progress', assigneeId: 'st-007', description: 'Door sensor fault; lift limited to manual operation.', costEstimate: 320000, blocksRoom: false, createdAt: d(-3) },
  { id: 'mt-006', hotelId: 'h-vi', location: 'Restaurant kitchen', category: 'HVAC', priority: 'normal', status: 'open', description: 'Extractor fan noisy; bearings likely worn.', costEstimate: 55000, blocksRoom: false, createdAt: d(-1) },
  { id: 'mt-007', hotelId: 'h-vi', roomId: 'rm-203', category: 'Electrical', priority: 'low', status: 'resolved', assigneeId: 'st-008', description: 'Bedside lamp socket loose.', costEstimate: 12000, blocksRoom: false, createdAt: d(-20), resolvedAt: d(-19), resolutionNotes: 'Socket replaced and tested.' },
  { id: 'mt-008', hotelId: 'h-vi', roomId: 'rm-301', category: 'Electronics', priority: 'low', status: 'resolved', assigneeId: 'st-008', description: 'Smart TV remote and HDMI port faulty.', costEstimate: 48000, blocksRoom: false, createdAt: d(-35), resolvedAt: d(-33), resolutionNotes: 'Port and remote replaced.' },
  { id: 'mt-009', hotelId: 'h-vi', roomId: 'rm-402', category: 'Plumbing', priority: 'normal', status: 'resolved', assigneeId: 'st-007', description: 'Leaking basin tap.', costEstimate: 15000, blocksRoom: false, createdAt: d(-9), resolvedAt: d(-8), resolutionNotes: 'Cartridge replaced.' },
  { id: 'mt-010', hotelId: 'h-vi', roomId: 'rm-105', category: 'Furniture', priority: 'low', status: 'resolved', assigneeId: 'st-007', description: 'Wardrobe door hinge broken.', costEstimate: 9000, blocksRoom: false, createdAt: d(-60), resolvedAt: d(-59), resolutionNotes: 'Hinge repaired.' },
];
