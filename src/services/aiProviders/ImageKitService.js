// imageKitService.js - Fixed Implementation
const FormData = require("form-data");
const ImageKit = require("imagekit"); // Official ImageKit SDK

class ImageKitService {
  constructor(config = {}) {
    this.privateKey = "private_7FvMlT2fS22xR+lxJbYiZj4y/l4=";
    this.publicKey =  "public_6grZ6zga/cjdowZgqCjQuyaAd48=";
    this.urlEndpoint = "https://ik.imagekit.io/f7ivzsyxj"
    this.defaultFolder =  "jomobit-uploads";


    if (!this.privateKey || !this.publicKey || !this.urlEndpoint) {
      throw new Error("ImageKit private key, public key, and URL endpoint are required");
    }

    // Initialize ImageKit SDK
    this.imagekit = new ImageKit({
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      urlEndpoint: this.urlEndpoint
    });

    // Alternative: Manual upload URL for direct API calls
    this.uploadUrl = "https://upload.imagekit.io/api/v1/files/upload";
    this.authToken = Buffer.from(`${this.privateKey}:`).toString('base64');
  }

  /**
   * Upload image using official ImageKit SDK (Recommended)
   * @param {Buffer|string} imageData - Image data (buffer or base64)
   * @param {string} fileName - File name
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage(imageData, fileName) {
    try {
      console.log(`Starting ImageKit upload for: ${fileName}`);
      
      let uploadData;
      
      if (Buffer.isBuffer(imageData)) {
        // Upload buffer directly
        uploadData = {
          file: imageData,
          fileName: fileName,
          folder: this.defaultFolder,
          useUniqueFileName: true
        };
      } else if (typeof imageData === 'string') {
        if (imageData.startsWith('http')) {
          // Upload from URL
          uploadData = {
            file: imageData,
            fileName: fileName,
            folder: this.defaultFolder,
            useUniqueFileName: true
          };
        } else {
          // Upload base64
          const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, "");
          uploadData = {
            file: cleanBase64,
            fileName: fileName,
            folder: this.defaultFolder,
            useUniqueFileName: true
          };
        }
      } else {
        throw new Error("Invalid image data format");
      }

      // Upload with timeout handling
      const uploadPromise = this.imagekit.upload(uploadData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out after 45 seconds')), 45000)
      );

      const result = await Promise.race([uploadPromise, timeoutPromise]);
      
      console.log(`✅ ImageKit upload successful: ${result.url}`);
      
      return {
        url: result.url,
        thumbnailUrl: result.thumbnailUrl || result.url,
        fileId: result.fileId,
        name: result.name
      };

    } catch (error) {
      console.error(`❌ ImageKit upload failed: ${error.message}`);
      throw new Error(`ImageKit upload failed: ${error.message}`);
    }
  }

  /**
   * Upload using direct API (fallback method)
   * @param {string} base64Data - Base64 image data
   * @param {string} fileName - File name
   * @returns {Promise<Object>} Upload result
   */
  async uploadImageDirect(base64Data, fileName) {
    try {
      console.log(`Starting direct ImageKit upload for: ${fileName}`);
      
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
      
      const requestBody = {
        file: cleanBase64,
        fileName: fileName,
        folder: this.defaultFolder,
        useUniqueFileName: true
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

      const response = await fetch(this.uploadUrl, {
        method: "POST",
        headers: {
          'Authorization': `Basic ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      
      console.log(`✅ Direct ImageKit upload successful: ${result.url}`);
      
      return {
        url: result.url,
        thumbnailUrl: result.thumbnailUrl || result.url,
        fileId: result.fileId,
        name: result.name
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Upload timed out after 45 seconds');
      }
      console.error(`❌ Direct ImageKit upload failed: ${error.message}`);
      throw new Error(`Direct ImageKit upload failed: ${error.message}`);
    }
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
        console.log(`📤 Upload attempt ${attempt}/${maxRetries} for ${fileName}`);
        
        if (attempt <= 2) {
          // First two attempts: Use official SDK
          return await this.uploadImage(imageData, fileName);
        } else {
          // Last attempt: Use direct API (base64 only)
          let base64Data;
          if (typeof imageData === 'string' && !imageData.startsWith('http')) {
            base64Data = imageData;
          } else if (Buffer.isBuffer(imageData)) {
            base64Data = imageData.toString('base64');
          } else {
            throw lastError; // Can't convert URL to base64 easily
          }
          
          return await this.uploadImageDirect(base64Data, fileName);
        }
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Upload attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          throw new Error(`All ${maxRetries} upload attempts failed. Last error: ${error.message}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Get upload authentication parameters (for client-side uploads)
   * @param {string} fileName - File name
   * @returns {Object} Authentication parameters
   */
  getAuthenticationParameters(fileName) {
    const token = this.imagekit.getAuthenticationParameters();
    return {
      ...token,
      fileName: fileName,
      folder: this.defaultFolder
    };
  }
}

module.exports = ImageKitService;
