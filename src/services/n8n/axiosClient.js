const axios = require("axios");
const { getValidN8nToken } = require("../../utils/n8nTokenManager");

const axiosClient = axios.create({
  baseURL: process.env.N8N_WEBHOOK_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

/**
 * Attach cached JWT before every request
 */
axiosClient.interceptors.request.use(
  (config) => {
    const token = getValidN8nToken();
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Normalize responses & auto-retry if token is rejected
 */
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token rejected by n8n → force regeneration
      console.warn("JWT rejected, regenerating token...");
      cachedToken = null;
      tokenExpiresAt = null;
    }

    if (error.response) {
      console.error("n8n error:", {
        status: error.response.status,
        data: error.response.data,
      });
    }

    return Promise.reject(error);
  }
);

module.exports = axiosClient;
