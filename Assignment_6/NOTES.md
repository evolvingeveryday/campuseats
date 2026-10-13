# CS543 Web Services — Assignment 6 Notes
## CampusEats Orders API: Honest Responses, Status Codes, Errors & Validation

**Team ID:**
**Team members (roll number and full name):**  
1. `[20251651036] — [Dipesh Mishra]`  
2. `[20251651092] — [Suraj Kr Saw]`  
3. `[20251651081] — [Sandeep Parmar]`  
4. `[20251651104] — [Vivek Kumar]`

## API method map and status map (A6 Q1)

| Endpoint | Success | Failures and reason |
|---|---|---|
| `POST /orders` | `201 Created`; `Location: /orders/{id}` identifies the new resource. | `400` malformed JSON; `401` missing/empty Bearer header; `406` unsupported `Accept`; `409` same idempotency key reused with a different body; `413` body over 1 MB; `415` unsupported request media type; `422` empty cart, invalid fields, unavailable item, or declined payment; `429` client's rate budget exhausted; `500` unexpected internal failure; `503` temporary unavailability. |
| `GET /orders` | `200 OK`, with `data` and pagination metadata. | `400` invalid filter/sort/page/limit; `401` missing/empty Bearer header; `406` unsupported `Accept`; `429` rate limit. Query parameters filter, sort, and paginate; GET never changes state. |
| `GET /orders/{id}` | `200 OK` plus `ETag` and `Cache-Control`; `304 Not Modified` if `If-None-Match` matches. | `401` missing/empty Bearer header; `404` order not found; `406` unsupported `Accept`; `429` rate limit. |
| `PATCH /orders/{id}` | `200 OK` with the updated order and a new `ETag`. | `400` malformed JSON; `401` missing/empty Bearer header; `404` order not found; `406` unsupported `Accept`; `409` illegal order transition; `412` stale `If-Match`; `415` unsupported request media type; `422` invalid status field; `429` rate limit. |
| `DELETE /orders/{id}` | `204 No Content` after deleting a pending order. | `401` missing/empty Bearer header; `404` order not found; `406` unsupported `Accept`; `409` order is no longer pending; `429` rate limit. Repeating DELETE after the resource has been removed gives `404`, but leaves the same state (resource remains absent). |
| `OPTIONS /orders` | `204 No Content`, `Allow: GET, POST, OPTIONS`, plus CORS headers. | No authentication is required for preflight. |
| `OPTIONS /orders/{id}` | `204 No Content`, `Allow: GET, PATCH, DELETE, POST, OPTIONS`, plus CORS headers. | No authentication is required for preflight. |


## Problem type catalogue (A6 Q2)
The type URI's final segment is the stable problem identifier. All failures are routed through the shared `problem()` helper. Error responses use `application/problem+json; charset=utf-8` and contain `type`, `title`, `status`, and `detail`. Validation/domain errors may also include an `errors[]` field.

| Stable type string | Status | Trigger |
|---|---:|---|
| `empty-cart` | 422 | `items` is an empty array. |
| `item-unavailable` | 422 | At least one item has demo ID `unavailable`. |
| `payment-declined` | 422 | `paymentMethod` is `declined` (demo domain refusal). |
| `order-not-found` | 404 | No order exists for the requested ID. |
| `illegal-transition` | 409 | A status update is not in the allowed transition map, or deletion is attempted after an order leaves `pending`. |
| `validation-error` | 422 | One or more request fields violate the schema/checks. All detected field errors are returned together. |
| `malformed-json` | 400 | The request body cannot be parsed as JSON. |
| `unauthorized` | 401 | Missing or empty Bearer authorization header. |
| `not-acceptable` | 406 | Client requests an unsupported response representation. |
| `precondition-failed` | 412 | `If-Match` does not match the current ETag. |
| `rate-limit-exceeded` | 429 | Per-client request budget is exhausted; includes `Retry-After`. |
| `temporary-unavailable` | 503 | Demo-only transient service failure; includes `Retry-After`. |
| `internal-error` | 500 | Unexpected server-side error; sensitive internal details are logged, not returned. |

## Example Problem Details response (A6 Q3)

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json; charset=utf-8
X-Content-Type-Options: nosniff
```

```json
{
  "type": "https://campuseats.example/problems/validation-error",
  "title": "Validation Failed",
  "status": 422,
  "detail": "One or more request fields are invalid. Correct every field listed in errors and resubmit.",
  "errors": [
    { "field": "items[0].qty", "message": "must be an integer greater than or equal to 1" },
    { "field": "address", "message": "is required and must be a non-empty string" }
  ]
}
```

Field meanings: `type` is a stable problem identifier; `title` is a short summary; `status` repeats the HTTP status; `detail` explains the failure in human terms; `errors[]` points to individual invalid fields and explains each issue. Actual run timestamps and server headers are captured in `transcript.txt`.

## Two bad fields in one 422 (A6 Q4)

```bash
curl -i -X POST http://127.0.0.1:3000/orders \
  -H 'Authorization: Bearer demo-token' \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"meal-01","qty":0}]}'
```

The request has an invalid quantity (`qty` must be an integer ≥ 1) and lacks the required `address`. The service validates the complete body before creating an order, then returns one `422` response containing both errors in `errors[]`. It performs no order creation when validation fails.

An empty array `"items": []` has the distinct domain type `empty-cart`, also with status `422`.

## Safe retries and relevant status codes (A6 Q5)

| Operation / case | Safe to retry? | Why / signal |
|---|---|---|
| `GET /orders` and `GET /orders/{id}` | Yes | GET is a safe read. A `304` means the cached representation is still current. |
| `OPTIONS` | Yes | It describes protocol capabilities and changes no order state. |
| `POST /orders` with the same `Idempotency-Key` and same body | Yes | The server returns the originally recorded `201` result and does not create a duplicate. A reused key with a different body returns `409`. |
| `PATCH /orders/{id}` | Only with care | Send the latest `If-Match` ETag. A stale precondition returns `412`; fetch the current resource and reconcile before retrying. Status transitions are checked. |
| `DELETE /orders/{id}` | Effect is idempotent | Once deleted, the order stays absent; a retry may return `404` rather than another `204`. |
| `429 Too Many Requests` | Retry after delay | `Retry-After` tells the client when the per-client budget should have reset. Do not retry in a tight loop. |
| `503 Service Unavailable` | Usually, after delay | `Retry-After` communicates the suggested wait; use an idempotency key for POST because the client may not know whether the first result was received. |
| `400`, `401`, `406`, `409`, `412`, `415`, `422` | Do not retry unchanged | These describe a request/auth/precondition/domain issue. Correct the request, credentials, or precondition first. |

A plain `POST /orders` without an idempotency key is not naturally idempotent: the same successful request twice could create two orders. `Idempotency-Key` protects against that, which matters if a client times out after the server has created the order but before the response reaches the client. The demo timeout transcript reproduces this situation.

## Internal error mapping and information hiding (A6 Q6)

Risky route processing is enclosed in `try/catch`. Detailed error information (including a stack when available) is written to the server log. The caller receives only `500 Internal Server Error` with type `internal-error` and a generic detail. The response does not reveal stack traces, local file paths, database driver messages, or internal exception text. In non-production mode, the header `X-Demo-Force-Internal-Error: 1` demonstrates this mapping; this demo header is disabled when `NODE_ENV=production`.

## Content negotiation (A6 Q7)

This implementation intentionally supports JSON only. `Accept: application/json` or `Accept: */*` returns JSON. `Accept: application/xml` returns `406 Not Acceptable`, because the service cannot produce XML in this implementation. This is one of the two outcomes explicitly permitted by the assignment. The 406 body is a Problem Details JSON error explaining which representation is supported.

Example:

```bash
curl -i -X POST http://127.0.0.1:3000/orders \
  -H 'Authorization: Bearer demo-token' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/xml' \
  -d '{"items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A"}'
```

## Assignment 5 HTTP conventions retained

### Method map

| Action | Method + URL |
|---|---|
| Create an order | `POST /orders` |
| List/filter/sort/page orders | `GET /orders?status=pending&sort=createdAt&order=desc&page=1&limit=20` |
| Read one order | `GET /orders/{id}` |
| Change order status | `PATCH /orders/{id}` |
| Delete a pending order | `DELETE /orders/{id}` |
| Ask supported methods / CORS preflight | `OPTIONS /orders` or `OPTIONS /orders/{id}` |
| Constrained client fallback for update/delete | `POST /orders/{id}` with `X-HTTP-Method-Override: PATCH` or `DELETE` |

### Header table

| Endpoint | Request headers of interest | Response headers of interest |
|---|---|---|
| `POST /orders` | `Authorization`, `Content-Type: application/json`, `Accept`, `Idempotency-Key` | `201`, `Location`, `ETag`, `Content-Type`, `X-RateLimit-*`; failures use Problem Details and actual status. |
| `GET /orders` | `Authorization`, `Accept`; query parameters for filtering/sorting/pagination | `200`, `Content-Type`, `X-RateLimit-*`, CORS/security headers. |
| `GET /orders/{id}` | `Authorization`, `Accept`, optional `If-None-Match` | `200` + `ETag` + `Cache-Control`; matching `If-None-Match` returns `304` with no body. |
| `PATCH /orders/{id}` | `Authorization`, `Content-Type`, `If-Match` recommended, optional method override | `200` + new `ETag`; stale `If-Match` returns `412`. |
| `DELETE /orders/{id}` | `Authorization`, optional `X-HTTP-Method-Override: DELETE` on constrained client | `204` and no response body when deleted; `404` if already absent. |
| `OPTIONS` | CORS preflight headers such as `Origin`, `Access-Control-Request-Method`, `Access-Control-Request-Headers` | `204`, `Allow`, `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`. |
| Any order request | `Authorization: Bearer <non-empty-token>` | `401` when missing/empty; `X-Content-Type-Options: nosniff`; `Strict-Transport-Security`; rate limit headers. |
| Any throttled request | Same as endpoint | `429` + `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`. |
| Simulated service outage | Same as endpoint; demo header only in development | `503` + `Retry-After`. |

### Cache, Location, and CORS notes
- `Location` on `201` points to the new order (`/orders/{id}`). No redirect is implemented here; if a `3xx` redirect were used, `Location` would instead point to the redirect target.
- Single-order GET uses `Cache-Control: private, max-age=0, must-revalidate` and an ETag. A create or mutation returns `Cache-Control: no-store` where a cached representation could be misleading.
- `If-None-Match` saves bandwidth by returning `304 Not Modified` with no body if the ETag matches. `If-Match` prevents lost updates by returning `412 Precondition Failed` when a supplied ETag is stale.
- CORS is a browser-enforced policy. A server log can show 200 while the browser blocks JavaScript from reading the response. `Access-Control-Allow-Origin` authorizes the origin; preflight is answered by `OPTIONS`.
- `Date` is set on responses; this small Node server does not expose a runtime version. A generic `Server` value is used for the assignment. HSTS should only be relied on behind HTTPS in production; local development is HTTP.
- Large JSON bodies are gzip-compressed when the client advertises `Accept-Encoding: gzip` and the serialized body exceeds 1 KB.

### One complete HTTP exchange (Assignment 5 A6)

Request (HTTP/1.1):

```http
POST /orders HTTP/1.1
Host: 127.0.0.1:3000
Authorization: Bearer demo-token
Content-Type: application/json
Accept: application/json
Idempotency-Key: assignment-notes-001

{"items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A","paymentMethod":"cash"}
```

Typical response (the actual generated `ord_...` ID and timestamp vary by run):

```http
HTTP/1.1 201 Created
Location: /orders/ord_0001
ETag: "<computed-etag>"
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff

{"id":"ord_0001","items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A","paymentMethod":"cash","status":"pending","createdAt":"<ISO timestamp>","updatedAt":"<ISO timestamp>"}
```
