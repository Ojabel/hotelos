# HotelOS backend

This is the NestJS API project. It is independent from the existing `../hotelos` React application.

## Local setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `DATABASE_URL` in `.env` to a local PostgreSQL database, then run:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
```

The API listens on `http://localhost:3000`. Liveness and database readiness are `/api/v1/health` and `/api/v1/health/database`; OpenAPI is at `/api/docs` when enabled.

Useful checks: `npm run build`, `npm run lint`, and `npm test -- --runInBand`. Building generates the Prisma client first. Prisma CLI commands read `DATABASE_URL` from the environment or `backend/.env`; Prisma generation itself does not connect to the database.

Never commit `.env` or add secrets to the frontend's `VITE_*` variables.
