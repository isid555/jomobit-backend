const axiosClient = require('./axiosClient');

const webhookTriggerApi = {
  /**
   * Triggers the N8N generation webhook for a given job ID.
   * @param {string} jobId - Unique generation job identifier.
   * @returns {Promise<void>} - A promise that resolves when the webhook is triggered successfully.
   * @throws {Error} - If there is an error triggering the webhook.
   */
  triggerGenerationWebhook: async (jobId) => {
    try {
      const response = await axiosClient.post("v4/generate/poster", { jobId });
      return response;
    } catch (error) {
      console.error("Error triggering webhook:", error);
      throw error;
    }
  },

  triggerEnhancementWebhook: async (jobId) => {
    try {
      const response = await axiosClient.post("v1/enhance/poster", { jobId });
      return response;
    } catch (error) {
      console.error("Error triggering webhook:", error);
      throw error;
    }
  }
};

module.exports = webhookTriggerApi;