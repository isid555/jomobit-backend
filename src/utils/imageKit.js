const imageKit = require("imagekit");
const { v4: uuidv4 } = require("uuid");

class ImageKit {
  constructor(config = {}) {
    this.privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    this.publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    this.urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    this.defaultFolder = "jomobit-uploads";

    if (!this.privateKey || !this.publicKey || !this.urlEndpoint) {
      throw new Error(
        "ImageKit private key, public key, and URL endpoint are required"
      );
    }

    // Initialize ImageKit SDK
    this.imagekit = new imageKit({
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      urlEndpoint: this.urlEndpoint,
    });
  }

  /**
   * Upload with retry logic and multiple methods
   * @param {Buffer|string} imageData - Image data
   * @param {string} fileName - File name
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<Object>} Upload result
   */
  async uploadWithRetry(imageData, fileName, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📤 Upload attempt ${attempt}/${maxRetries} for ${fileName}`
        );

        if (attempt <= 2) {
          // First two attempts: Use official SDK
          return await this.uploadImage(imageData, fileName);
        } else {
          // Last attempt: Use direct API (base64 only)
          let base64Data;
          if (typeof imageData === "string" && !imageData.startsWith("http")) {
            base64Data = imageData;
          } else if (Buffer.isBuffer(imageData)) {
            base64Data = imageData.toString("base64");
          } else {
            throw lastError; // Can't convert URL to base64 easily
          }

          return await this.uploadImageDirect(base64Data, fileName);
        }
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Upload attempt ${attempt} failed: ${error.message}`);

        if (attempt === maxRetries) {
          throw new Error(
            `All ${maxRetries} upload attempts failed. Last error: ${error.message}`
          );
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Upload image using official ImageKit SDK (Recommended)
   * @param {Buffer|string} imageData - Image data (buffer or base64)
   * @param {string} fileName - File name
   * @param {string} [folder] - Folder name (optional, defaults to this.defaultFolder)
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(imageData, fileName, folder) {
    try {
      // Use provided folder or fall back to defaultFolder
      const targetFolder = folder || this.defaultFolder;

      console.log(`Starting ImageKit upload for: ${fileName} to folder: ${targetFolder}`);

      let uploadData;

      if (Buffer.isBuffer(imageData)) {
        // Upload buffer directly
        uploadData = {
          file: imageData,
          fileName: fileName,
          folder: targetFolder,
          useUniqueFileName: true,
        };
      } else if (typeof imageData === "string") {
        if (imageData.startsWith("http")) {
          // Upload from URL
          uploadData = {
            file: imageData,
            fileName: fileName,
            folder: targetFolder,
            useUniqueFileName: true,
          };
        } else {
          // Upload base64
          const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, "");
          uploadData = {
            file: cleanBase64,
            fileName: fileName,
            folder: targetFolder,
            useUniqueFileName: true,
          };
        }
      } else {
        throw new Error("Invalid image data format");
      }

      // Upload with timeout handling
      const uploadPromise = this.imagekit.upload(uploadData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Upload timed out after 45 seconds")),
          45000
        )
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]);

      console.log(`✅ ImageKit upload successful: ${result.url}`);

      return {
        url: result.url,
        thumbnailUrl: result.thumbnailUrl || result.url,
        fileId: result.fileId,
        name: result.name,
      };
    } catch (error) {
      console.error(`❌ ImageKit upload failed: ${error.message}`);
      throw new Error(`ImageKit upload failed: ${error.message}`);
    }
  }

  /**
   * @returns {Promise<Object>} Authentication parameters
   * @description Get upload authentication parameters (for client-side uploads)
   * @example
   * const { token, expire, signature, publicKey } = await imageKit.getAuthParams();
   */
  async getAuthParams() {
    try {
      // Generate a unique token
      const uuidToken = uuidv4();
      const { token, expire, signature } =
        this.imagekit.getAuthenticationParameters(uuidToken, { expires: 3600 });

      return {
        token,
        expire,
        signature,
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      };
    } catch (err) {
      console.error("Error fetching imagekit auth params:", err);
      throw new Error("Failed to fetch imagekit auth params");
    }
  }
}

module.exports = ImageKit;
