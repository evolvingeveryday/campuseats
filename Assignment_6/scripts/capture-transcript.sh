#!/usr/bin/env bash
set -u
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3419}"
HOST="127.0.0.1"
OUT="$ROOT_DIR/transcript.txt"
TMP_DIR="$(mktemp -d)"
SERVER_LOG="$TMP_DIR/server.log"
BASE="http://${HOST}:${PORT}"
TOKEN='Bearer demo-token'
PID=''

cleanup() {
  if [ -n "$PID" ]; then kill "$PID" >/dev/null 2>&1 || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

PORT="$PORT" HOST="$HOST" RATE_LIMIT_MAX=100 RATE_LIMIT_WINDOW_MS=60000 NODE_ENV=development node "$ROOT_DIR/src/server.js" >"$SERVER_LOG" 2>&1 &
PID=$!

ready=0
for _ in $(seq 1 50); do
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.1
done
if [ "$ready" -ne 1 ]; then
  echo "Could not start API on $BASE. Server log:" >&2
  cat "$SERVER_LOG" >&2
  exit 1
fi

: > "$OUT"
{
  echo 'CS543 Web Services Assignment 6 — CampusEats Orders API'
  echo "Transcript generated: $(date)"
  echo "Base URL: $BASE"
  echo 'Commands use curl -sS -i so HTTP status, response headers and bodies are visible.'
  echo 'The Bearer token is a coursework header-handling placeholder, not a real authentication system.'
} >> "$OUT"

record() {
  label="$1"; shift
  {
    printf '\n\n===== %s =====\n$' "$label"
    printf ' %q' "$@"
    printf '\n'
  } >> "$OUT"
  set +e
  "$@" >> "$OUT" 2>&1
  rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then echo "[curl/client exit code: $rc]" >> "$OUT"; fi
}

record_capture() {
  label="$1"; capture_path="$2"; shift 2
  {
    printf '\n\n===== %s =====\n$' "$label"
    printf ' %q' "$@"
    printf '\n'
  } >> "$OUT"
  set +e
  "$@" > "$capture_path" 2>&1
  rc=$?
  set -e
  cat "$capture_path" >> "$OUT"
  if [ "$rc" -ne 0 ]; then echo "[curl/client exit code: $rc]" >> "$OUT"; fi
}

record_capture 'D1 — Successful create: 201 + Location + JSON' "$TMP_DIR/create.txt" \
  curl -sS -i -X POST "$BASE/orders" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H 'Idempotency-Key: a06-transcript-create-001' \
  -d '{"items":[{"itemId":"meal-01","qty":2}],"address":"Hostel Block A, Room 12","paymentMethod":"cash"}'
ETAG="$(grep -i '^etag:' "$TMP_DIR/create.txt" | head -n 1 | cut -d ':' -f 2- | tr -d '\r' | sed 's/^[[:space:]]*//')"

record 'A5 regression — Repeating same Idempotency-Key returns same 201 resource' \
  curl -sS -i -X POST "$BASE/orders" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H 'Idempotency-Key: a06-transcript-create-001' \
  -d '{"items":[{"itemId":"meal-01","qty":2}],"address":"Hostel Block A, Room 12","paymentMethod":"cash"}'

record 'A5 regression — Conditional GET returns 304 with no body' \
  curl -sS -i "$BASE/orders/ord_0001" -H "Authorization: $TOKEN" -H "If-None-Match: $ETAG"

record 'A5 regression — Stale conditional write returns 412' \
  curl -sS -i -X PATCH "$BASE/orders/ord_0001" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -H 'If-Match: "old-etag"' \
  -d '{"status":"confirmed"}'

record 'D2 — Empty cart returns 422 empty-cart Problem Details' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[],"address":"Hostel Block A"}'

record 'D2 — Two invalid fields reported in one 422' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"meal-01","qty":0}]}'

record 'D2 — Unavailable item returns 422 item-unavailable' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"unavailable","qty":1}],"address":"Hostel Block A"}'

record 'D2 — Declined payment returns 422 payment-declined' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A","paymentMethod":"declined"}'

record 'D2 — Illegal transition pending -> delivered returns 409' \
  curl -sS -i -X PATCH "$BASE/orders/ord_0001" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"delivered"}'

record 'D2 — Malformed JSON returns 400' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d '{not-json'

record 'D2 — Missing Authorization returns 401' curl -sS -i "$BASE/orders"

record 'D2 — Unknown order returns 404 order-not-found' \
  curl -sS -i "$BASE/orders/ord_9999" -H "Authorization: $TOKEN"

record 'D3 — Accept: application/xml returns 406 because this implementation supports JSON only' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/xml' \
  -d '{"items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A"}'

record 'A6 retry safety — 503 includes Retry-After' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -H 'X-Demo-Force-503: 1' \
  -d '{"items":[{"itemId":"meal-01","qty":1}],"address":"Hostel Block A"}'

record 'A5 regression — OPTIONS reports Allow and CORS headers' \
  curl -sS -i -X OPTIONS "$BASE/orders" -H 'Origin: https://example.org' -H 'Access-Control-Request-Method: POST'

record 'A5 retry-safety — Simulated client timeout after server commit' \
  bash -c "curl -sS --max-time 0.25 -i -X POST '$BASE/orders' -H 'Authorization: $TOKEN' -H 'Content-Type: application/json' -H 'Idempotency-Key: a06-timeout-key' -H 'X-Demo-Response-Delay-Ms: 1200' -d '{\"items\":[{\"itemId\":\"meal-timeout\",\"qty\":1}],\"address\":\"Hostel Block B\"}' || true"
sleep 1.3
record 'A5 retry-safety — Retrying timed-out POST with same key returns original order' \
  curl -sS -i -X POST "$BASE/orders" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: a06-timeout-key' -d '{"items":[{"itemId":"meal-timeout","qty":1}],"address":"Hostel Block B"}'

# Exhaust this local demo client's budget without filling the transcript with 100 warm-up responses.
for _ in $(seq 1 150); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/orders" -H "Authorization: $TOKEN" 2>/dev/null || true)"
  if [ "$code" = '429' ]; then break; fi
done
record 'D2 — Rate limit returns 429, Retry-After and per-client budget headers' \
  curl -sS -i "$BASE/orders" -H "Authorization: $TOKEN"

{
  echo
  echo 'End of transcript.'
  echo 'The timeout above is simulated using a development-only delay header; the server creates the order and saves the idempotency result before delaying the response.'
} >> "$OUT"

echo "Transcript written to $OUT"
