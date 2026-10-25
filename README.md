# payment-ui

A React test client for [payment-api](../payment-api).

## Run

1. Start MySQL and Redis (`payment-api-mysql`, `payment-api-redis` containers).
2. Start the API on port 8080 (`./mvnw spring-boot:run` in `payment-api`).
3. Start the UI:

```bash
npm install
npm run dev
```

Open http://localhost:5173.

The dev server forwards `/api/*` to `http://localhost:8080`. To use a different
backend, set `API_URL`:

```bash
API_URL=http://localhost:8081 npm run dev
```

## What you can test

- **Auth:** create an account, sign in and out. "Break access token" makes the
  next request fail with 401 so you can watch the client refresh automatically.
  The access token is kept in memory only; the refresh token is an HttpOnly
  cookie set by the API, so page scripts can never read it.
- **Payments:** create, list, look up by ID, edit and delete (soft delete).
- **Idempotency:** "Resend last payment with the same key" simulates a retry
  (same payment returned). "Use last key" with different details gives a 422.
  Clear the key field to see the 400 for a missing header.

The Activity panel shows every request with its status, headers and body.
