// imageDownloader.js
const https = require("https");

class ImageDownloader {
  /**
   * Download image from URL and return as base64
   * @param {string} url - Image URL
   * @returns {Promise<string>} Base64 string
   */
  static async downloadAsBase64(url) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download image: ${response.statusCode}`)
            );
            return;
          }

          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString("base64");
            resolve(base64);
          });
          response.on("error", reject);
        })
        .on("error", reject);
    });
  }
}

module.exports = ImageDownloader;
