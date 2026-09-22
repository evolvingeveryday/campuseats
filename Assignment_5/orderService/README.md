# CampusEats Orders Service

A RESTful **Orders Service** for the CampusEats application, implemented using **Node.js and Express**.

This service demonstrates REST API design principles, HTTP methods and status codes, request validation, authentication, idempotency, conditional requests, ETags, rate limiting, CORS, security headers, content negotiation, and retry-safe operations.

---

## Overview

The Orders Service manages customer food orders for CampusEats.

It provides APIs to:

* Create an order
* List orders
* Retrieve a single order
* Update an order
* Delete an order
* Cancel an order
* Handle conditional requests using ETags
* Prevent duplicate order creation using idempotency keys
* Protect write operations using Bearer authentication
* Apply per-client rate limiting
* Support CORS
* Return standardized error responses using `application/problem+json`

The service uses an **in-memory data store** for demonstration purposes instead of a permanent database.

---

## Technology Stack

* **Node.js**
* **Express.js**
* **Jest**
* **Supertest**
* **Compression**
* JavaScript
* REST / HTTP

---

## Project Structure

```text
orders-service/
│
├── app.js
├── auth.js
├── cors.js
├── errors.js
├── etag.js
├── models.js
├── negotiate.js
├── rateLimit.js
├── security.js
├── store.js
├── validator.js
│
└── tests/
    └── orders.test.js
```
