# Part A – Model the Service (Orders)

## A1. Pick your service

For Assignment 4, I chose the **Orders service**. Payments were already covered in Assignment 3, and Orders is central to CampusEats, connecting menus, vendors, payments, and delivery.

## A2. List the operations (SOAP style starting point)

If Orders were SOAP, the operations would have been:

```text
placeOrder(orderID, userID, vendorID, orderItems)

getOrder(orderID)

listOrders(userID)

cancelOrder(orderID)
```

Here, `orderItems` refers to the relationship table **ORDER_ITEMS**, which links each order to multiple menu items with quantities.

## A3. Find the nouns

REST requires resources (nouns) instead of verbs.

From the SOAP operations, the durable resources are:

* **Orders** -> `/orders`
* **Single Order** -> `/orders/{orderID}`
* **Order Items**-> represented inside the Order resource as an array of `{menuID, quantity}`
* **Cancel action** -> `/orders/{orderID}/cancel` (sub-resource)

## A4. Resource table

| Method | URL                        | What it does                         | Success | Failure codes |
| ------ | -------------------------- | ------------------------------------ | ------- | ------------- |
| POST   | `/orders`                  | Create a new order with `orderItems` | 201     | 400, 422      |
| GET    | `/orders/{orderID}`        | Read a single order                  | 200     | 404           |
| GET    | `/orders?userID=123`       | List orders for a user               | 200     | 400           |
| POST   | `/orders/{orderID}/cancel` | Cancel an order                      | 202     | 404, 409      |

## A5. Justify one hard choice

Mapping `cancelOrder` into REST was the hardest choice because **"cancel" is a verb**. REST principles discourage verbs in URLs.

I resolved this by modeling cancellation as a sub-resource (`/orders/{id}/cancel`) that changes the state of the order. This keeps the design resource-oriented and avoids verbs in API paths.


1. Count the lines in your Assignment 3 WSDL and in your openapi.yaml. What is the difference actually made of? Name two things the WSDL declared that the OpenAPI file does not need to.

WSDL (Assignment 3) -> Much longer, because it declared types, bindings, ports, and SOAP envelopes.
OpenAPI (Assignment 4) -> Shorter, only declares paths, schemas, and responses.

Two things WSDL declared that OpenAPI does not need:
- SOAP binding details (e.g., `<binding>` with transport/protocol).
- Service port/address (`<service>` with `<port>`).

---

2. Quote one soap:Fault from your Assignment 3 work and show the status code and problem body that replaced it. Why is returning that error inside a 200 OK a problem for the network in between?

Soap Fault example:
```xml
<soap:Fault>
  <faultcode>soap:Client</faultcode>
  <faultstring>Invalid order request</faultstring>
</soap:Fault>

json
{
  "type": "validation-error",
  "title": "Malformed Request Body",
  "status": 400,
  "detail": "Items must be a non-empty array"
}


**Why 200 OK is a problem:**
- Middleboxes (caches, proxies, load balancers) assume success if status is 200.
- Errors hidden inside 200 break monitoring, retry logic, and client expectations.

---

**3. Which of UDDI's three moves — publish, find, bind — still exist in your new setup, and which disappeared? Explain what took over the job.**

- **Publish** -> Disappeared. We don't register services in UDDI anymore.
- **Find** -> Disappeared. Clients don't query registries; they use documentation or service URLs.
- **Bind** -> Still exists. Clients bind directly to REST endpoints using the OpenAPI contract.

**Replacement:** OpenAPI spec + developer portals take over the job of "publish" and "find."

---

**4. Your XML Schema was enforced before your code ran; your OpenAPI schema is not. Name the specific function in your code that now carries that responsibility, and one failure that would get through if you had not written it.**

- **XML Schema (SOAP)** -> Enforced before code ran.
- **OpenAPI (REST)** -> Only documentation; enforcement is manual.

**Specific function now responsible:** `validateOrder()` in `validator.js`.

**Failure that would slip through without it:** A request missing `items[]` would reach the store and create a broken order record.

---

**5. Name one part of your service where you would still choose the SOAP stack over REST, and state exactly what guarantee you would be buying. Answering "nowhere" needs a stronger argument than answering "somewhere".**

**Example:** Financial transactions or enterprise systems needing guaranteed delivery + strict contract enforcement.

**Guarantee you'd be buying:** WS‑Security + WS‑ReliableMessaging -> ensures messages are delivered once, in order, with integrity.

**Argument if you say "nowhere":** REST is simpler and sufficient for CampusEats, but SOAP still has value in regulated industries.