# Mini Slot Reservation & Alert API

A lightweight reservation system with an ASP.NET Core 8 API and a responsive
Vite, React, and TypeScript dashboard. A user selects a reservation start time
inside a backend-owned `09:00–17:00 Asia/Kuala_Lumpur` service day. The API
prevents concurrent double-booking, stores data in SQLite through Entity
Framework Core, and finds the longest remaining consecutive window for that
fixed day.

## What is included

- `POST /api/reservations` with `SlotId`, `UserId`, `StartUtc`, and
  `DurationMinutes`
- `GET /api/reservations/{id}` for the `Location` returned after creation
- `GET /api/slots/{slotId}/availability/longest` for the availability algorithm
- Per-slot async locking for thread safety inside one API process
- A serializable SQLite transaction for the overlap check and insert
- A unique database index on `(SlotId, StartUtcMilliseconds)` as an atomic
  same-millisecond collision backstop
- A configurable, backend-enforced daily service schedule
- 28 xUnit cases using relational SQLite in-memory databases
- A backend-aligned React dashboard using standard CSS and the Fetch API
- 14 frontend tests covering data contracts, selected times, fixed windows,
  validation, backend-driven refresh, success, and conflicts

## Project structure

```text
MiniSlotReservation.sln
src/MiniSlotReservation.Api/
  Contracts/                 HTTP request and response models
  Controllers/               Reservation and availability endpoints
  Data/ReservationDbContext  EF Core schema and indexes
  Models/Reservation         Stored reservation entity
  Services/                  Concurrency and availability logic
tests/MiniSlotReservation.Api.Tests/
  Infrastructure/            Fixed clock and isolated SQLite test database
  ReservationServiceTests    Success and concurrency tests
  AvailabilityWindowCalculatorTests
frontend/
  src/components/            Form, availability, alerts, and session table
  src/pages/ReservationPage  Dashboard state and orchestration
  src/services/              Typed Fetch API integration
  src/types/                 Backend-aligned TypeScript interfaces
```

## Frontend dashboard

The frontend treats the implemented C# API as authoritative. In particular,
slot and user IDs are text, reservation IDs are GUIDs, timestamps are
`startUtc`/`endUtc`, and availability is requested for a service date. The
supplied frontend brief used a different example route and numeric IDs; those
examples are intentionally not used.

The backend does not currently expose a collection endpoint. The UI therefore
shows reservations successfully created during the current browser session and
labels that scope explicitly instead of presenting client data as the complete
database.

The backend owns a fixed daily window from `09:00` to `17:00` in
`Asia/Kuala_Lumpur` (UTC+8). The browser selects a service date and start time;
the API validates the interval, computes its end, and derives the availability
bounds. After a successful booking or conflict, the UI reloads the longest
window from the API instead of modifying it locally.

Start the API:

```powershell
dotnet run --project src/MiniSlotReservation.Api
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The included Vite proxy forwards `/api` to
`http://localhost:5050`. See `frontend/README.md` for frontend configuration,
testing, and production-origin notes.

For a single-command local startup, stop any separately running frontend/API
processes and run:

```powershell
cd frontend
npm run dev:full
```

## Full implementation steps

1. **Create the solution and projects.** Create one ASP.NET Core Web API project
   and one xUnit project, reference the API project from the test project, and
   add both projects to the solution.

2. **Add relational persistence.** Install
   `Microsoft.EntityFrameworkCore.Sqlite`, create `ReservationDbContext`, and
   model each reservation with an ID, slot ID, user ID, duration, start
   millisecond, and end millisecond.

3. **Protect the schema.** Add required/max-length rules, positive-duration and
   end-after-start check constraints, plus a unique index on slot ID and start
   millisecond. The unique index makes an identical database insert fail
   atomically even if the requests came from separate application instances.

4. **Define the API contract.** Validate URL-safe IDs with no more than 100
   characters. Accept the selected `startUtc` plus a duration of 1–480 minutes.
   The client never supplies an end time; the API computes it.

5. **Own the fixed schedule in the backend.** Configure `09:00–17:00` in
   `Asia/Kuala_Lumpur`, resolve a Windows timezone fallback when necessary, and
   derive the UTC bounds for each `serviceDate`. Require starts to be on a whole
   minute, not in the past, and require the complete interval to fit that day.

6. **Implement concurrency control.** Acquire a keyed `SemaphoreSlim` for the
   slot, create a fresh EF `DbContext`, begin a serializable SQLite transaction,
   check for an overlapping reservation, then insert and commit. Translate a
   SQLite constraint violation to an HTTP `409 Conflict`.

7. **Use half-open time intervals.** Reservations use `[start, end)`. Two
   reservations overlap when:

   ```text
   existing.Start < proposed.End
   AND existing.End > proposed.Start
   ```

   This also means a new reservation may start exactly when an earlier one
   ends. Rejecting all overlaps is stronger than only rejecting identical
   milliseconds and gives normal reservation behavior.

8. **Implement the longest-window algorithm.** Accept a `serviceDate`, derive
   its finite fixed bounds in the API, fetch only reservations intersecting
   those bounds, clip them, sort by start, merge overlaps while moving a cursor,
   and retain the largest gap. Equal gaps return the earliest one. Sorting costs
   `O(n log n)` and the scan costs `O(n)`.

9. **Expose controllers and status codes.** Return `201 Created` plus a
   `Location` header after a successful reservation, `400 Bad Request` for
   invalid input, and `409 Conflict` with Problem Details when the slot is not
   available.

10. **Write deterministic tests.** Inject a frozen clock, use explicit selected
    times, and run separate EF contexts against a shared SQLite in-memory
    database. Cover boundaries, adjacency, overlapping starts, simultaneous
    requests with shared and independent locks, timezone conversion, strict
    service-date parsing, and the longest-gap calculation.

11. **Verify the whole application.** Restore, build, run all tests, launch the
    API, and issue real HTTP requests for the `201`, `409`, and longest-window
    paths.

## Run it locally

### 1. Prerequisite

Install the [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or a
newer SDK capable of targeting .NET 8.

### 2. Restore, build, and test

From the repository root:

```powershell
dotnet restore MiniSlotReservation.sln
dotnet build MiniSlotReservation.sln --no-restore
dotnet test MiniSlotReservation.sln --no-build
```

Expected test coverage includes:

- A selected 120-minute interval is persisted with its expected start/end.
- Two users racing for one slot at the same millisecond produce exactly one
  success and one conflict.
- Two simulated API instances without a shared in-process lock are serialized
  by SQLite and also produce exactly one success.
- Different slots can be reserved at the same millisecond.
- Availability handles overlaps, adjacent reservations, horizon clipping, an
  empty schedule, and a fully occupied schedule.
- Fixed schedule tests verify `09:00–17:00 Asia/Kuala_Lumpur` maps to the
  correct UTC interval.

### 3. Start the API

```powershell
dotnet run --project src/MiniSlotReservation.Api
```

The development profile listens on `http://localhost:5050`. On first startup,
EF Core creates `reservations.db` automatically under the API project folder.

### 4. Create a reservation

PowerShell:

```powershell
$body = @{
    slotId = "slot-1"
    userId = "user-7"
    startUtc = "2026-08-14T03:00:00Z"
    durationMinutes = 120
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:5050/api/reservations" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

Request JSON:

```json
{
  "slotId": "slot-1",
  "userId": "user-7",
  "startUtc": "2026-08-14T03:00:00Z",
  "durationMinutes": 120
}
```

Successful response (`201 Created`):

```json
{
  "id": "c2ec558f-0eee-4ddb-9447-17ca254375d7",
  "slotId": "slot-1",
  "userId": "user-7",
  "durationMinutes": 120,
  "startUtc": "2026-08-14T03:00:00+00:00",
  "endUtc": "2026-08-14T05:00:00+00:00"
}
```

Submitting another reservation for `slot-1` before this one ends returns
`409 Conflict` and a Problem Details body whose `code` is `slot_unavailable`.

### 5. Find the longest available window

```powershell
Invoke-RestMethod -Uri (
    "http://localhost:5050/api/slots/slot-1/availability/longest" +
    "?serviceDate=2026-08-14"
)
```

Example response:

```json
{
  "slotId": "slot-1",
  "serviceDate": "2026-08-14",
  "timeZoneId": "Asia/Kuala_Lumpur",
  "searchFromUtc": "2026-08-14T01:00:00+00:00",
  "searchToUtc": "2026-08-14T09:00:00+00:00",
  "availableFromUtc": "2026-08-14T05:00:00+00:00",
  "availableToUtc": "2026-08-14T09:00:00+00:00",
  "durationMinutes": 240
}
```

This example reserves 11:00–13:00 Malaysia time for 120 minutes. The two free
gaps are 09:00–11:00 and 13:00–17:00, so the API returns the latter as the
longest at 240 minutes. If the entire day is occupied, `availableFromUtc` and
`availableToUtc` are `null`, and `durationMinutes` is `0`.

The file `src/MiniSlotReservation.Api/MiniSlotReservation.Api.http` contains
ready-to-run requests for IDEs that support HTTP files.

## Design notes and production follow-ups

- Slot IDs are trimmed and compared case-sensitively.
- The schedule can be changed in `ReservationSchedule` configuration, while
  the checked-in default is `09:00–17:00 Asia/Kuala_Lumpur`.
- The process-level lock dictionary intentionally retains one small semaphore
  per observed slot. For a high-cardinality production system, use a
  reference-counted eviction strategy.
- SQLite is appropriate for this small single-service exercise. For multiple
  hosts, use a shared transactional database such as PostgreSQL or SQL Server
  with an appropriate row/advisory lock or serializable transaction.
- `EnsureCreated` keeps setup simple. Replace it with versioned EF Core
  migrations before evolving a production schema.
- Authentication, authorization, cancellation endpoints, cleanup/expiration,
  rate limiting, and alert delivery are outside this brief.
