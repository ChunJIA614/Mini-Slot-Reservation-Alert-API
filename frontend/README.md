# Reservation System Frontend

A lightweight Vite, React, and TypeScript dashboard for the ASP.NET Core
reservation API in this repository. It uses standard CSS and the browser Fetch
API—no Redux, Tailwind, or component library.

## Backend-first contract

The implementation follows the actual C# contracts rather than the numeric
sample contract in the original frontend brief:

- `slotId` and `userId` are strings with 1–100 URL-safe characters: letters,
  numbers, dots, underscores, and hyphens.
- `durationMinutes` is a whole number from 1 to 480.
- The reservation form sends the selected instant as `startUtc`; the API
  computes `endUtc` and returns both timestamps with a GUID `id`.
- Availability uses
  `GET /api/slots/{slotId}/availability/longest?serviceDate=YYYY-MM-DD`.
- The backend derives and enforces one fixed `09:00–17:00` service window in
  `Asia/Kuala_Lumpur` (UTC+8). The browser selects a service date and start
  time, but cannot redefine those bounds.
- A reservation must be minute-aligned, in the future, and finish no later
  than 17:00. For example, selecting 11:00 with a 120-minute duration reserves
  11:00–13:00.
- After a successful reservation or a `409 Conflict`, the UI asks the API for
  the longest remaining window again; it does not calculate the result locally.
- Availability timestamps can be `null` when the entire search horizon is
  occupied.
- The backend has no reservation collection or health endpoint. The table is
  therefore labelled **This session**, and API status reflects the latest real
  reservation or availability request.

The service layer performs runtime response-shape checks in addition to static
TypeScript typing. ASP.NET Problem Details, validation failures, network errors,
and `409 Conflict` responses are handled without crashing the UI.

## Run locally

The simplest option starts the frontend and backend together:

```powershell
cd frontend
npm install
npm run dev:full
```

Alternatively, start the backend from the repository root:

```powershell
dotnet run --project src/MiniSlotReservation.Api
```

Then open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at
`http://localhost:5050`, so local development does not require a CORS change.

If the browser reports `502 Bad Gateway`, Vite is running but the backend is
not reachable on port `5050`. Start the API or use `npm run dev:full`.

## Configuration

The checked-in `.env` uses:

```dotenv
VITE_API_BASE_URL=/api
```

For a separately hosted frontend, set this to the deployed backend URL ending
in `/api`, for example:

```dotenv
VITE_API_BASE_URL=https://api.example.com/api
```

The backend includes a restricted CORS allowlist with `http://localhost:5173`
as its local default. For a separately hosted frontend, configure the deployed
origin with `Cors__AllowedOrigins__0=https://your-frontend.example`. Do not use
a wildcard for a production reservation API. Vite environment values are
embedded at build time; do not place secrets in them.

## Quality checks

```powershell
npm run build
npm run test:run
npm run lint
```

The 14 frontend tests cover the exact selected-time POST body, Malaysia-time
conversion, fixed-window constraints, GUID/UTC response mapping, ASP.NET `409`
Problem Details, the service-date availability route, backend-driven refresh,
session table updates, and validation.

## Source layout

```text
src/
  components/
    Alert/
    AvailabilityCard/
    ReservationForm/
    ReservationList/
  pages/ReservationPage/
  services/reservationService.ts
  types/reservation.ts
  utils/formatters.ts
  App.tsx
  main.tsx
```
