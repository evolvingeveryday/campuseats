# CS543 — Assignment 5: HTTP Methods & Headers

**Team ID:** _(fill in your Team ID here)_

**Roll No & Name of every team member:**
* Dipesh Mishra – 20251651036
* Suraj Kr Saw – 20251651092
* Sandeep Parmar – 20251651081
* Vivek Kumar – 20251651104

Service: **CampusEats Orders Service** (same service as Assignment 4).
All behaviour below was verified against a running instance of
`orders-service/app.js` — see `curl-transcript.txt` for the real `curl -v`
output and `orders-service/tests/orders.test.js` for the automated checks
(15/15 passing).

---

## Part A — CampusEats method map (A1)

| Action | Method | URL | Success | Failure |
|---|---|---|---|---|
| Create order | POST | `/orders` | 201 | 400, 401, 422, 429 |
| List orders (filter by status) | GET | `/orders?status=pending` | 200 | — |
| Read single order | GET | `/orders/{id}` | 200 / 304 | 404 |
| Modify order | PATCH | `/orders/{id}` | 200 | 401, 404, 412, 428 |
| Delete order | DELETE | `/orders/{id}` | 204 | 401, 404 |
| Cancel order (non-CRUD action) | POST | `/orders/{id}/cancel` | 202 (first time) / 200 (already cancelled) | 401, 404, 409 |
| Discover methods | OPTIONS | `/orders/{id}` | 204 + `Allow` | — |

**Verb audit fix:** Assignment 4's leftover `controllers/ordersController.js`
still had a stub `exports.cancelOrder` reachable only through in-code calls,
never through a `POST /cancelOrder`-style URL — so there was no leaked verb
in a route path to fix. The one real inconsistency we found was that
Assignment 4's `openapi.yaml` documented fields (`userID`, `vendorID`,
`orderItems`, `orderID`) that didn't match what the actual Express code
implements (`customerId`, `items`, `id`). We fixed the OpenAPI file to match
the running code rather than the other way around, since the code is ground
truth for what a client actually receives.

---

## A3 — Safe & idempotent

| Endpoint | Safe? | Idempotent? | Notes |
|---|---|---|---|
| `GET /orders` | Yes | Yes | Pure read, changes nothing |
| `GET /orders/{id}` | Yes | Yes | Pure read; also cacheable (ETag) |
| `POST /orders` | No | **No, by nature** — made retry-safe via `Idempotency-Key` | Repeat calls without a key create duplicate orders |
| `PATCH /orders/{id}` | No | Yes | Same body + same target state → same end state; made *safe to retry blindly* by requiring `If-Match` |
| `DELETE /orders/{id}` | No | Yes | First call deletes (204), repeat calls on a gone resource return 404 — end state ("resource absent") is the same either way |
| `POST /orders/{id}/cancel` | No | **No, by nature** — made retry-safe by design (see below) | A cancel-of-a-cancel returns 200 instead of erroring |
| `OPTIONS /orders/{id}` | Yes | Yes | Metadata only |

**The one that is neither, and how we made it retry-safe:** `POST /orders`
is neither safe nor naturally idempotent — calling it twice normally means
two orders and two kitchen tickets. We made it retry-safe with the
`Idempotency-Key` header: the store caches the first response
(`{status, body, location}`) keyed by that header, and any repeat with the
same key gets the identical cached response instead of creating a new
record (see `idempotencyCache` in `store.js` and step 2 of
`curl-transcript.txt`).

---

## Part B/D2 — Headers table

| Endpoint | Request headers it needs | Response headers it sets |
|---|---|---|
| `POST /orders` | `Content-Type`, `Authorization: Bearer`, `Idempotency-Key` (optional) | `Location`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Access-Control-Allow-Origin`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| `GET /orders` | `Accept` (optional) | `X-RateLimit-*`, CORS/security headers |
| `GET /orders/{id}` | `If-None-Match` (optional) | `ETag`, `Cache-Control`, `X-RateLimit-*`, CORS/security headers |
| `PATCH /orders/{id}` | `Authorization: Bearer`, `If-Match` (required), `Content-Type` | `ETag` (new value), `X-RateLimit-*` |
| `DELETE /orders/{id}` | `Authorization: Bearer` | `X-RateLimit-*` (204, no body) |
| `POST /orders/{id}/cancel` | `Authorization: Bearer` | `X-RateLimit-*` |
| `OPTIONS /orders/{id}` or `/orders` | — | `Allow`, CORS preflight headers when it's a browser preflight |
| Rate-limited request | any | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` (only on 429) |
| Any request | — | `Date`, `Server`/`X-Powered-By` (set automatically by Express, not by our code) |

---

## Part C4 — The safe-retry plan

| Endpoint | Risk if retried blindly | Mechanism | Why |
|---|---|---|---|
| `POST /orders` | Duplicate order + duplicate kitchen ticket / charge | **Idempotency-Key** | Not safe, not naturally idempotent — the only fix is to remember and replay the first result |
| `GET /orders/{id}` | None (safe), but wastes bandwidth on an unchanged resource | **If-None-Match** | Client already has a fresh copy; 304 skips resending it |
| `PATCH /orders/{id}` | Two editors' writes clobbering each other (lost update) | **If-Match** | Forces the client to prove it read the current version before writing |
| `DELETE /orders/{id}` | None — repeat delete of an already-gone resource is a no-op (404) | *(none needed)* | Already idempotent by nature |
| `POST /orders/{id}/cancel` | Second cancel call erroring on an already-cancelled order | **Built-in idempotent handling** (return 200 instead of 409/error when already cancelled) | No safe natural key exists for a state-transition action, so the endpoint itself absorbs the repeat |

This follows directly from the A3 split: only the two endpoints that are
*not* naturally idempotent (`POST /orders`, `POST /.../cancel`) needed an
explicit retry-safety mechanism; the naturally idempotent ones didn't.

---

## NOTES.md — the eight answers

### 1. Method, success status, and the one response header that matters most, for three endpoints

- **`POST /orders`** → 201 Created → **`Location`**. It's the header a
  client *needs* to find the resource it just created; without it, the
  only way to get the new order's URL is to parse the body and guess.
- **`GET /orders/{id}`** → 200 OK → **`ETag`**. It's what makes every other
  caching/concurrency feature (304s, `If-Match` writes) possible — nothing
  else here does anything without it.
- **`PATCH /orders/{id}`** → 200 OK → **`ETag`** (the new one). The client
  must capture this before it can safely PATCH again, so returning the
  *updated* ETag closes the loop for the next edit.

### 2. Which endpoints are safe / idempotent; which is neither and how it was made retry-safe

`GET /orders`, `GET /orders/{id}`, and `OPTIONS` are safe. `PATCH`,
`DELETE`, `GET`, and `OPTIONS` are idempotent. `POST /orders` and
`POST /orders/{id}/cancel` are neither safe nor naturally idempotent.
`POST /orders` was made retry-safe with an `Idempotency-Key` that caches
and replays the original response. `POST /orders/{id}/cancel` was made
retry-safe differently: instead of a key, the handler itself treats
"already cancelled" as success (`200`) rather than an error, so a repeated
cancel from a flaky network is harmless. (Full table in A3/C4 above.)

### 3. One ETag, the request that returns 304, the write that returns 412

From `curl-transcript.txt` (steps 3–6), order `5103f202-...` had:

```
ETag: "37efbac392b080f100c0798b7031dcdaab061978"
```

- **304:** `GET /orders/5103f202-...` with
  `If-None-Match: "37efbac392b080f100c0798b7031dcdaab061978"` → `304 Not
  Modified`, no body.
- **412:** `PATCH /orders/5103f202-...` with
  `If-Match: "stale-value-from-an-old-copy"` → `412 Precondition Failed`.

**What each saves/prevents:** the 304 saves bandwidth and a JSON parse for
a client whose cached copy is still current. The 412 prevents a lost
update — it stops a client working from a stale read from silently
overwriting a change made by someone else in between.

### 4. One request that triggers 422, one that triggers 400, and the difference

- **400** (`curl-transcript.txt`, step 7): `POST /orders` with
  `{"customerId":"user_77"}` (no `items` array at all) →
  `400 Malformed Request Body`. The request doesn't even parse into a
  valid order shape.
- **422**: `POST /orders` with a syntactically valid body but 11 items,
  e.g. `{"customerId":"user_99","items":[11 items]}` → `422 Order Refused,
  "Order exceeds maximum of 10 items per order"`. The JSON is well-formed
  and has everything required — the *business rule* (kitchen capacity)
  refuses it.

**The difference:** 400 means "I can't even understand this request";
422 means "I understood it perfectly, and the domain says no."

### 5. Browser on another origin blocked, server logs show 200 — who blocked it, which header fixes it

The **browser itself** blocked it — the server actually processed the
request and returned 200, but the browser's own same-origin policy refused
to hand the response to the calling page because the response didn't carry
permission for that origin. The fix is **`Access-Control-Allow-Origin`**
(and, for the preflight `OPTIONS` that precedes non-simple requests,
answering it with `Access-Control-Allow-Methods` /
`Access-Control-Allow-Headers` too — see step 13 of the curl transcript).

### 6. One Cache-Control that allows caching, one that must use no-store; why each

- **Allow caching:** `GET /orders/{id}` → `Cache-Control: private,
  max-age=30, must-revalidate`. It's a per-user read of relatively stable
  data; a short cache window trims repeat reads while `must-revalidate` +
  the `ETag` keep it from ever serving something stale beyond that window.
- **`no-store`:** any response carrying `Authorization`-gated or
  payment-adjacent data — in this service that means the *request* headers
  themselves (`Authorization: Bearer ...`) must never be cached or logged
  by an intermediary, and if we ever add a `/orders/{id}/payment-status`
  endpoint it should set `Cache-Control: no-store` so a shared proxy or
  browser back/forward cache can't retain another user's order or payment
  state.

### 7. When would `POST` be right for the search endpoint instead of `GET`, and what do you give up?

`GET /orders?status=...` stays a `GET` today because the filter is small
and fits comfortably in a query string. `POST` would become the right
choice if the search criteria grew large or structured enough to not fit
in a URL safely — e.g. searching orders by a list of 200 menu-item IDs, a
free-text query with special characters, or a saved/complex filter object
— since URLs have practical length limits and query-string encoding gets
ugly fast. **What you give up by switching to POST:** the request stops
being safe and idempotent in the HTTP sense, it becomes un-bookmarkable
and un-shareable as a URL, intermediate caches/CDNs can no longer cache it
by URL, and browsers won't prefetch or let you "open in new tab" the same
way.

### 8. `Location` on a 201 vs on a 3xx — what does it point to in each case?

On a **201 Created** (`POST /orders`), `Location` points to the **URL of
the resource that was just created** — e.g.
`Location: /orders/5103f202-5b53-452c-9ec0-d6faa958a940` — so the client
can immediately `GET` it. On a **3xx redirect**, `Location` instead points
to **where the client should go next to complete the original request** —
the *target* of the redirect, not something new that was created. Same
header name, opposite direction of information: "here's what I made" vs.
"go here instead."
