# CS543 Web Services — Assignment 7
## CampusEats Dishes Service with GraphQL

**Chosen service:** Dishes / Menu service for CampusEats.  
**Stack:** Node.js, Apollo Server, GraphQL, MySQL (`mysql2`), HTML, CSS and JavaScript.

The application exposes a GraphQL API over the `dishes` MySQL table and includes a simple browser page that lists dishes and adds a dish using a GraphQL mutation.

## Features

- `Query.dishes`: return all dishes from MySQL.
- `Query.dish(id: ID!)`: return one dish by ID.
- `Mutation.addDish(input: AddDishInput!)`: insert a new dish into MySQL.
- Four seed dishes are inserted by `schema.sql`.
- The HTML page uses `fetch()` to call `/graphql` and refreshes the menu after a successful mutation.
- `/health` reports whether the server can reach MySQL.

## Fastest setup on a Mac (Docker Desktop + Node.js required)

1. Install Node.js 20 or newer and Docker Desktop if they are not already installed.
2. Extract this ZIP and open Terminal in this folder.
3. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

4. Start the MySQL database:

   ```bash
   docker compose up -d db
   ```

   The compose file creates a local MySQL 8.4 container and initializes the database/table with four sample dishes. The demo root password is `campuseats_demo_pw`; this is for local coursework only, not for deployment.

5. Install Node.js dependencies and start the app:

   ```bash
   npm install
   npm start
   ```

6. Open the browser at **http://localhost:4000**.
7. The GraphQL endpoint is **http://localhost:4000/graphql** and the database health check is **http://localhost:4000/health**.

You can also run `./run_mac.sh`, which installs npm dependencies if needed, starts the database through Docker Compose if Docker is available, and then starts the server.

## If MySQL is already installed locally (without Docker)

1. Start MySQL.
2. Import the schema and seed rows (enter your MySQL password if prompted):

   ```bash
   mysql -u root -p < schema.sql
   ```

3. Copy `.env.example` to `.env` and edit `DB_USER` and `DB_PASSWORD` to match your local MySQL user. Keep `DB_HOST=127.0.0.1`, `DB_PORT=3306`, and `DB_NAME=campuseats_graphql` unless your setup differs.
4. Run `npm install` and `npm start`.
5. Open `http://localhost:4000`.

## Test the GraphQL API

In the Apollo Sandbox at `http://localhost:4000/graphql`, run this query:

```graphql
query {
  dishes {
    id
    name
    price
    available
  }
}
```

To find a single dish by ID:

```graphql
query FindDish($id: ID!) {
  dish(id: $id) {
    id
    name
    price
    available
  }
}
```

Variables example:

```json
{ "id": "1" }
```

To add a dish:

```graphql
mutation AddDish($input: AddDishInput!) {
  addDish(input: $input) {
    id
    name
    price
    available
  }
}
```

Variables example:

```json
{
  "input": {
    "name": "Paneer Roll Special",
    "price": 95,
    "available": true
  }
}
```

The `name` must be unique because the database has a unique constraint on dish names. If you run the mutation twice with the same name, use a different name for the second attempt.

## Assignment questions — answers in the README

### 1. Which CampusEats service did you pick?
We selected the **Dishes/Menu service**. It stores each dish's ID, name, price, and availability.

### 2. Name one field a client can skip and one it cannot. Why do we use `!`?
A query client can omit `available` from its selection set and request only `id name price`; GraphQL returns only the requested fields. The `!` in the output type `available: Boolean!` means that, when the field is included in the response, its value must not be `null`—it does **not** force the client to request the field. In the mutation input, `name: String!` is required and cannot be omitted because the `!` marks a non-null input field.

### 3. Map it to SQL: which part became `WHERE`, and which resolver ran `INSERT`?
The `dish(id: ID!)` query's ID argument is passed to the SQL statement `SELECT ... FROM dishes WHERE id = ?`; the argument fills the `?` parameter. The `addDish` mutation runs the `addDish` resolver in `server.js`, which calls `addDish()` in `db.js`; that function executes `INSERT INTO dishes (name, price, available) VALUES (?, ?, ?)` with parameterized values.

## Before/after mutation evidence for submission

1. Open `http://localhost:4000` and take a screenshot of the seeded dish catalogue **before** adding a record.
2. Enter a new unique dish name and price, click **Add dish to MySQL**, and wait for the success message and refreshed list.
3. Take a second screenshot **after** the new dish appears in the list. Keep both images in the `screenshots/` folder.
4. For a demonstration video, record the browser showing the original list, submitting the form, and showing the saved dish in the refreshed list.

The `screenshots/` folder has an evidence note. Screenshots are not fabricated here because the before/after state must come from a live run against your database.

## Run one-line summary

`cp .env.example .env && docker compose up -d db && npm install && npm start` — then open `http://localhost:4000`.

## Team details

Please verify/edit this roster before submission if your Assignment 7 team is different.

| Roll number | Name |
|---|---|
| 20251651036 | Dipesh Mishra |
| 20251651092 | Suraj Kumar Saw |
| 20251651081 | Sandeep Parmar |
| 20251651104 | Vivek Kumar |

## Files

- `schema.graphql` — GraphQL object/input types, queries and mutation.
- `server.js` — Apollo Server, resolvers, HTTP routes and static page hosting.
- `db.js` — MySQL pool and SQL operations through `mysql2`.
- `schema.sql` — database/table setup and four seed records.
- `public/index.html` — HTML/CSS/JavaScript frontend using `fetch()`.
- `docker-compose.yml` — optional local MySQL container.
- `.env.example` — configuration template.
