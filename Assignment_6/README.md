# CampusEats

**CS543 Web Services — Assignment 6**

---

## 👥 Team Members | Group 19

| Roll Number | Name |
|---|---|
| 20251651036 | Dipesh Mishra |
| 20251651092 | Suraj Kr Saw |
| 20251651081 | Sandeep Parmar |
| 20251651104 | Vivek Kumar |

---


# CS543 Web Services — Assignment 6
## CampusEats Orders API: Honest Responses, Status Codes, Errors & Validation

This is a self-contained Node.js implementation of the CampusEats **Orders** service for Assignment 6. It uses Node's built-in HTTP server and Node test runner, so no third-party npm packages are required. The implementation follows the attached Assignment 6 PDF and carries forward the relevant HTTP conventions called out in Assignment 5.

> **Important scope note:** Only the two assignment PDFs were attached; the existing Assignment 5 source folder was not attached. This ZIP is therefore a complete reference implementation built from the assignment requirements, not a patch applied to an unseen repository. Merge these files into your team's existing `campuseats` repository if your instructor expects the exact Assignment 5 implementation to be continued.

## Requirements
- Node.js 18 or later
- `curl`

Check your versions:

```bash
node --version
curl --version
```

## Run the service
From this folder:

```bash
npm start
```

The API runs at `http://127.0.0.1:3000`. Leave this terminal open. Open another Terminal tab/window for the commands below.

The assignment asks for header-handling, not a real token provider. For protected endpoints, send any non-empty Bearer token, for example:

```http
Authorization: Bearer demo-token
```

Example create request:

```bash
curl -i -X POST http://127.0.0.1:3000/orders \
  -H 'Authorization: Bearer demo-token' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: order-demo-001' \
  -d '{"items":[{"itemId":"meal-01","qty":2}],"address":"Hostel Block A, Room 12","paymentMethod":"cash"}'
```

A successful create returns `201 Created`, a `Location: /orders/ord_0001` header and the new order as JSON. The service keeps its demo data in memory; restarting the process clears orders and idempotency keys.

## Useful endpoints

| Method | URL | Purpose | Success |
|---|---|---|---|
| `POST` | `/orders` | Create an order | `201 Created` + `Location` |
| `GET` | `/orders` | List/filter/sort/page orders | `200 OK` |
| `GET` | `/orders/{id}` | Read one order; supports ETag revalidation | `200 OK` or `304 Not Modified` |
| `PATCH` | `/orders/{id}` | Move an order through valid states | `200 OK` |
| `DELETE` | `/orders/{id}` | Delete a pending order | `204 No Content` |
| `OPTIONS` | `/orders` or `/orders/{id}` | Show allowed methods and CORS preflight response | `204 No Content` |
| `GET` | `/health` | Local process health check | `200 OK` |

All `/orders` routes require `Authorization: Bearer <non-empty-token>`. Every error uses the same Problem Details structure and the media type `application/problem+json; charset=utf-8`. Successful JSON responses use `application/json; charset=utf-8`.

## Order request rules
`POST /orders` expects:

```json
{
  "items": [{ "itemId": "meal-01", "qty": 2 }],
  "address": "Hostel Block A, Room 12",
  "paymentMethod": "cash"
}
```

- `items` must be an array with at least one item.
- Each item needs a non-empty `itemId` and an integer `qty >= 1`.
- `address` is required and cannot be blank.
- `paymentMethod` is optional; accepted values are `cash`, `card`, or `declined` (the latter simulates a declined payment for the assignment's error catalogue).
- The demo item ID `unavailable` simulates an unavailable menu item.
- `paymentMethod: "declined"` simulates a domain-level payment refusal.

Order transitions are deliberately constrained:

```text
pending   -> confirmed | cancelled
confirmed -> preparing | cancelled
preparing -> ready
ready     -> delivered
cancelled and delivered are terminal states
```

A disallowed transition returns `409 Conflict` with type `illegal-transition`.

## Reproduce the transcript
Run in a terminal from the project folder:

```bash
npm run transcript
```

The script starts a local demo server, uses real `curl -i` calls to capture success and failure headers/bodies, exercises idempotency and a simulated client timeout, then stops the server. It writes the transcript to `transcript.txt`. It needs permission to bind a local port and to run `curl`.

To run it manually, the script defaults to port `3419`. Override it with `PORT=3456 npm run transcript` if that port is already in use.

## Run the tests

```bash
npm test
```

Tests use Node's built-in `node:test` runner and do not need a database or third-party packages.

## Assignment files
- `src/server.js` — Orders API, status codes, Problem Details, validation, rate limiting, ETags, idempotency and CORS.
- `tests/api.test.js` — automated route and regression checks.
- `openapi.yaml` — OpenAPI 3.1 contract.
- `NOTES.md` — status map, error catalogue, safety analysis, and answers to Assignment 6 questions.
- `transcript.txt` — real `curl -i` output generated by `npm run transcript`.
- `scripts/capture-transcript.sh` — reproducible transcript script.
