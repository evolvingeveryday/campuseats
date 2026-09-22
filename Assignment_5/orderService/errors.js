// errors.js
function problem(res, { type, title, status, detail }) {
  res.setHeader('Content-Type', 'application/problem+json');
  return res.status(status).json({
    type: type || "about:blank",
    title,
    status,
    detail
  });
}

module.exports = { problem };