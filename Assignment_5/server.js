// server.js
const app = require('./orders-service/app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`CampusEats Orders Service listening on http://localhost:${PORT}`);
});
