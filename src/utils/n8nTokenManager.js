const jwt = require("jsonwebtoken");

let cachedToken = null;
let tokenExpiresAt = null;

const SECRET = process.env.N8N_JWT_SECRET;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Create a new JWT for n8n
 */
function createN8nToken() {
  const token = jwt.sign(
    {
      iss: "jomobit-backend",
      aud: "n8n",
      scope: "webhook:trigger",
    },
    SECRET,
    {
      expiresIn: TOKEN_TTL_SECONDS,
    }
  );

  // Decode to get exp (no verification needed here)
  const decoded = jwt.decode(token);

  cachedToken = token;
  tokenExpiresAt = decoded.exp * 1000; // convert to ms

  return token;
}

/**
 * Returns a valid JWT (cached or newly created)
 */
function getValidN8nToken() {
  if (!cachedToken || !tokenExpiresAt) {
    return createN8nToken();
  }

  const now = Date.now();

  // Optional safety buffer (e.g., refresh 1 minute early)
  const SAFETY_BUFFER_MS = 60 * 1000;

  if (now >= tokenExpiresAt - SAFETY_BUFFER_MS) {
    return createN8nToken();
  }

  return cachedToken;
}

/**
 * Optional explicit validation (rarely needed client-side)
 */
function validateToken(token) {
  return jwt.verify(token, SECRET);
}


module.exports = {
  getValidN8nToken,
  validateToken,
};
