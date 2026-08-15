Task 1: Using curl -i, make at least five requests to a public, read-only JSON API. Capture the full request and response each time. At least one request must deliberately fail - ask for something that does not exist and capture the 404. Add a one-line note on what each status code and Content-Type means.

C:\\CampusEats>curl -i <https://jsonplaceholder.typicode.com/posts/1>

HTTP/2 200

date: Sat, 15 Aug 2026 09:32:42 GMT

content-type: application/json; charset=utf-8

content-length: 292

access-control-allow-credentials: true

cache-control: max-age=43200

etag: W/"124-yiKdLzqO5gfBrJFrcdJ8Yq0LGnU"

expires: -1

nel: {"report_to":"heroku-nel","response_headers":\["Via"\],"max_age":3600,"success_fraction":0.01,"failure_fraction":0.1}

pragma: no-cache

report-to: {"group":"heroku-nel","endpoints":\[{"url":"<https://nel.heroku.com/reports?s=PD3aZ5JXmnXLLbuM9yuy2jwg6ke8U5C2Yq%2BT0erzkj0%3D\\u0026sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d\\u0026ts=1775729378"}\],"max_age":3600}>

reporting-endpoints: heroku-nel="<https://nel.heroku.com/reports?s=PD3aZ5JXmnXLLbuM9yuy2jwg6ke8U5C2Yq%2BT0erzkj0%3D&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&ts=1775729378>"

server: cloudflare

vary: Origin, Accept-Encoding

via: 2.0 heroku-router

x-content-type-options: nosniff

x-powered-by: Express

x-ratelimit-limit: 1000

x-ratelimit-remaining: 730

x-ratelimit-reset: 1775729393

age: 4045

accept-ranges: bytes

cf-cache-status: HIT

cf-ray: a2b7318e4d7cfd9a-SIN

alt-svc: h3=":443"; ma=86400

{

&nbsp; "userId": 1,

&nbsp; "id": 1,

&nbsp; "title": "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",

&nbsp; "body": "quia et suscipit\\nsuscipit recusandae consequuntur expedita et cum\\nreprehenderit molestiae ut ut quas totam\\nnostrum rerum est autem sunt rem eveniet architecto"

}

**200** → The request was successful.

C:\\CampusEats>curl -i <https://jsonplaceholder.typicode.com/users/3>

HTTP/2 200

date: Sat, 15 Aug 2026 09:41:51 GMT

content-type: application/json; charset=utf-8

content-length: 520

access-control-allow-credentials: true

cache-control: max-age=43200

etag: W/"208-uuwhfwQMzFzbJr9Pg6DKXae0SXA"

expires: -1

nel: {"report_to":"heroku-nel","response_headers":\["Via"\],"max_age":3600,"success_fraction":0.01,"failure_fraction":0.1}

pragma: no-cache

report-to: {"group":"heroku-nel","endpoints":\[{"url":"<https://nel.heroku.com/reports?s=JBBzARIeLBm8nXrdr%2Bj%2BMsge254Pms0lwCjbLfIgYOg%3D\\u0026sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d\\u0026ts=1785529666"}\],"max_age":3600}>

reporting-endpoints: heroku-nel="<https://nel.heroku.com/reports?s=JBBzARIeLBm8nXrdr%2Bj%2BMsge254Pms0lwCjbLfIgYOg%3D&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&ts=1785529666>"

server: cloudflare

vary: Origin, Accept-Encoding

via: 2.0 heroku-router

x-content-type-options: nosniff

x-powered-by: Express

x-ratelimit-limit: 1000

x-ratelimit-remaining: 999

x-ratelimit-reset: 1785529715

age: 1557

accept-ranges: bytes

cf-cache-status: HIT

cf-ray: a2b73ef208b7ce6f-SIN

alt-svc: h3=":443"; ma=86400

{

&nbsp; "id": 3,

&nbsp; "name": "Clementine Bauch",

&nbsp; "username": "Samantha",

&nbsp; "email": "<Nathan@yesenia.net>",

&nbsp; "address": {

&nbsp; "street": "Douglas Extension",

&nbsp; "suite": "Suite 847",

&nbsp; "city": "McKenziehaven",

&nbsp; "zipcode": "59590-4157",

&nbsp; "geo": {

&nbsp; "lat": "-68.6102",

&nbsp; "lng": "-47.0653"

&nbsp; }

&nbsp; },

&nbsp; "phone": "1-463-123-4447",

&nbsp; "website": "ramiro.info",

&nbsp; "company": {

&nbsp; "name": "Romaguera-Jacobson",

&nbsp; "catchPhrase": "Face to face bifurcated interface",

&nbsp; "bs": "e-enable strategic applications"

&nbsp; }

}

//**200** → The request was successful.

C:\\CampusEats>curl -i <https://jsonplaceholder.typicode.com/comments/10>

HTTP/2 200

date: Sat, 15 Aug 2026 09:44:45 GMT

content-type: application/json; charset=utf-8

content-length: 304

access-control-allow-credentials: true

cache-control: max-age=43200

etag: W/"130-QdroCpYRBxteQqhUAtjOMlCo5II"

expires: -1

nel: {"report_to":"heroku-nel","response_headers":\["Via"\],"max_age":3600,"success_fraction":0.01,"failure_fraction":0.1}

pragma: no-cache

report-to: {"group":"heroku-nel","endpoints":\[{"url":"<https://nel.heroku.com/reports?s=L4QedcyBDcPmAz%2FZEyp0PlcAWySYxE1yL1oE5qA7ADg%3D\\u0026sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d\\u0026ts=1786727052"}\],"max_age":3600}>

reporting-endpoints: heroku-nel="<https://nel.heroku.com/reports?s=L4QedcyBDcPmAz%2FZEyp0PlcAWySYxE1yL1oE5qA7ADg%3D&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&ts=1786727052>"

server: cloudflare

vary: Origin, Accept-Encoding

via: 2.0 heroku-router

x-content-type-options: nosniff

x-powered-by: Express

x-ratelimit-limit: 1000

x-ratelimit-remaining: 999

x-ratelimit-reset: 1786727110

accept-ranges: bytes

cf-cache-status: REVALIDATED

cf-ray: a2b743331d68fdae-SIN

alt-svc: h3=":443"; ma=86400

{

&nbsp; "postId": 2,

&nbsp; "id": 10,

&nbsp; "name": "eaque et deleniti atque tenetur ut quo ut",

&nbsp; "email": "<Carmen_Keeling@caroline.name>",

&nbsp; "body": "voluptate iusto quis nobis reprehenderit ipsum amet nulla\\nquia quas dolores velit et non\\naut quia necessitatibus\\nnostrum quaerat nulla et accusamus nisi facilis"

}

//**200** → The request was successful.

C:\\CampusEats>curl -i <https://jsonplaceholder.typicode.com/todos/5>

HTTP/2 200

date: Sat, 15 Aug 2026 09:45:58 GMT

content-type: application/json; charset=utf-8

content-length: 128

access-control-allow-credentials: true

cache-control: max-age=43200

etag: W/"80-nIDrpgGIpb97HlRnMUJPolcZWGI"

expires: -1

nel: {"report_to":"heroku-nel","response_headers":\["Via"\],"max_age":3600,"success_fraction":0.01,"failure_fraction":0.1}

pragma: no-cache

report-to: {"group":"heroku-nel","endpoints":\[{"url":"<https://nel.heroku.com/reports?s=%2BFf5MdTP5kW%2FgAv3R6dqxZi5Vp1e27Vpu2pFv0m2h5M%3D\\u0026sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d\\u0026ts=1785387634"}\],"max_age":3600}>

reporting-endpoints: heroku-nel="<https://nel.heroku.com/reports?s=%2BFf5MdTP5kW%2FgAv3R6dqxZi5Vp1e27Vpu2pFv0m2h5M%3D&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&ts=1785387634>"

server: cloudflare

vary: Origin, Accept-Encoding

via: 2.0 heroku-router

x-content-type-options: nosniff

x-powered-by: Express

x-ratelimit-limit: 1000

x-ratelimit-remaining: 998

x-ratelimit-reset: 1785387636

age: 23888

accept-ranges: bytes

cf-cache-status: HIT

cf-ray: a2b744fc3d67fe8e-SIN

alt-svc: h3=":443"; ma=86400

{

&nbsp; "userId": 1,

&nbsp; "id": 5,

&nbsp; "title": "laboriosam mollitia et enim quasi adipisci quia provident illum",

&nbsp; "completed": false

}

//**200** → The request was successful.

// Content-Type application/json; charset=utf-8 means the server returned JSON data, encoded in UTF‑8 for universal character support.

C:\\CampusEats>curl -i <https://jsonplaceholder.typicode.com/posts/99999>

HTTP/2 404

date: Sat, 15 Aug 2026 09:46:54 GMT

content-type: application/json; charset=utf-8

content-length: 2

access-control-allow-credentials: true

cache-control: max-age=43200

etag: W/"2-vyGp6PvFo4RvsFtPoIWeCReyIC8"

expires: -1

nel: {"report_to":"heroku-nel","response_headers":\["Via"\],"max_age":3600,"success_fraction":0.01,"failure_fraction":0.1}

pragma: no-cache

report-to: {"group":"heroku-nel","endpoints":\[{"url":"<https://nel.heroku.com/reports?s=ghI7tF7I%2F76Vmc6Miw66%2BEdEvdJwMKKj7ViHaFiGYEY%3D\\u0026sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d\\u0026ts=1786766337"}\],"max_age":3600}>

reporting-endpoints: heroku-nel="<https://nel.heroku.com/reports?s=ghI7tF7I%2F76Vmc6Miw66%2BEdEvdJwMKKj7ViHaFiGYEY%3D&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&ts=1786766337>"

server: cloudflare

vary: Origin, Accept-Encoding

via: 2.0 heroku-router

x-content-type-options: nosniff

x-powered-by: Express

x-ratelimit-limit: 1000

x-ratelimit-remaining: 999

x-ratelimit-reset: 1786766350

age: 20876

cf-cache-status: HIT

cf-ray: a2b7465afae2c887-SIN

alt-svc: h3=":443"; ma=86400

{}

//**404 Not Found** → The resource does not exist.x

// Content-Type application/json; charset=utf-8 means the server returned JSON data encoded in UTF‑8.