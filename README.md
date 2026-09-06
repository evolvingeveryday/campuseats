# campuseats
CampusEats project for CS543 Web Services


---

## 👥 Team Members
- Dipesh Mishra – 20251651036  
- Suraj Kr Saw – 20251651092  
- Sandeep Parmar – 20251651081  
- Vivek Kumar – 20251651104

---

# CampusEats – CS543 Web Services

CampusEats is a food ordering and delivery platform designed for university campuses.  
This repository contains coursework for **CS543 Web Services (IIIT Vadodara)**, covering both SOAP and REST assignments.  
The implementation is done using the **MERN stack (MongoDB, Express, React, Node.js)**.

---

## 📌 Assignment 3 – Integrate External SOAP Partner
**Goal:** Integrate the external payment gateway **UniPay** at the contract level.  
This assignment is design‑time only (no live server).

**Deliverables:**
- `partner.wsdl` – SOAP contract with all six WSDL elements.
- `soap-request.xml` – SOAP envelope for the charge request.
- `soap-response.xml` – SOAP envelope for a successful charge response.
- `soap-fault.xml` – SOAP envelope for a declined card fault.
- `integration.pdf` – Context, HTTP binding, discovery entry, and fault mapping.

---

## 📌 Assignment 4 – Rebuilding a CampusEats Service in REST
**Goal:** Model and implement another CampusEats service (Orders or Delivery) in REST.  
This assignment builds a real service with OpenAPI and MERN code.

**Deliverables:**
- `openapi.yaml` – OpenAPI contract with info, servers, paths, and schemas.
- Source files – Express backend (`models/`, `routes/`, `controllers/`, `errors/`).
- `tests/` – Automated tests covering success, idempotency, and failure paths.
- `NOTES.md` – Resource table, design justification, fallback reasoning, and reflection answers.
- Curl transcript – Demonstrates successful create, idempotent repeat, and failure cases.
- Validation outputs – OpenAPI spec validation and test results.

**Highlights:**
- At least four endpoints: create, read single item, filtered list, and a sub‑resource.
- Unified error shape (consistent JSON error response).
- Idempotency support via `Idempotency-Key` header.
- Hardened outbound call with timeout, exponential backoff, and jitter.
- Documented fallback strategy for dependency failures.

---

## 📂 Repository Structure
