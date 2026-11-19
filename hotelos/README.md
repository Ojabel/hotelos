# HotelOS — frontend (Milestones 1–5)

Frontend-only hotel management UI. No backend, no real payments, no external services. All data is local mock data.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm test
npm run build
```

## Demo access
Use **Continue with demo account** on /login, or sign in with `manager@hotelos.demo` / `HotelOS2026`
(also `frontdesk@`, `housekeeping@`, `accounts@`, `restaurant@` with the same password).
Switch role and property from the account menu (top right).

## Structure
- `src/styles/index.css` – design tokens (CSS variables) consumed by `tailwind.config.js`
- `src/components/ui` – shared primitives; `src/components/layout` – sidebar, top bar, search, breadcrumbs
- `src/routes/nav.ts` – single source for navigation, route metadata and role access
- `src/routes/pageRegistry.ts` – implemented screens; anything unlisted shows a "Scheduled for Milestone N" page
- `src/data` – typed, internally consistent seed data; `src/utils/demoClock.ts` fixes "today" to 2026-11-08
- `src/services` – mock services (backend integration points)
- `src/utils/reservationRules.ts` – overlap/availability rules (tested in `reservationRules.test.ts`)

## Status
Milestone 6: reports and analytics from shared mock records, browser-local hotel settings, configurable demonstration roles and permissions, and searchable activity logs.
Milestone 7: responsive guest website and guest portal with shared demo booking data, date-based availability, locally persisted guest profiles and reservations, confirmation print, reservation cancellation and guest-scoped service requests.

Settings and admin configuration are local demonstration state. Frontend permission checks are not production authorization. Reports identify seed-data gaps instead of inventing booking-source, feedback, expense-department or room-status history figures.
Milestone 1: shell, auth, design system, seed data.
Milestone 2: dashboard, rooms (table/grid/detail/floor plan), reservations (list, 5-step booking, walk-in, detail, calendar).
Milestone 3: front desk (overview, arrivals, departures, in-house; check-in, check-out, room transfer, early check-in, late check-out), guests (directory, profile, VIP, notes/complaints), billing (overview, folios, invoices, payments, refunds, expenses, financial reports) with printable invoice and receipt previews.
Milestone 4: housekeeping (tasks, schedule, inspections, supplies), maintenance (requests, technicians, room blocking), restaurant (overview, menu, tables, kitchen orders) and room service with charge-to-room.
Milestone 5: inventory (stock, alerts, suppliers, purchase orders with partial receiving, movements) and staff (directory, departments, weekly shift roster with rest/hours rules, attendance and leave, illustrative payroll with payslip previews).
Remaining screens show a "Scheduled for Milestone N" page until built.

Milestone 7: guest website and guest portal routes are implemented with shared demo reservation data, date-based availability, locally persisted bookings/profile changes and guest-scoped local service requests. Guest portal access and bookings are simulations only; service requests do not enter an operational queue or create charges. The shared room, guest, reservation and folio-related mock collections are persisted locally to preserve public bookings across reloads.
