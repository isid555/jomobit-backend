// Contains all the configurations and the parameters supported by the diffusion providers

class DiffusionModelConfigs {
  constructor() {
    // Supported diffusion models
    this.supportedDiffusionModels = [
      "nano_banana",
      "nano_banana_pro",
      "seeddream_4_5",
      "gpt_1_5_image",
      "midjourney",
    ];

    this.supportedProviders = ["fal-ai", "legnext"];
    this.modelProviderMapping = {
        "nano_banana": "fal-ai",
        "nano_banana_pro": "fal-ai",
        "seeddream_4_5": "fal-ai",
        "gpt_1_5_image": "fal-ai",
        "midjourney": "legnext",
    };
  }

  _nanoBananaConfig() {
    const configs = {
      supportedAspectRatio: [
        "auto",
        "1:1",
        "21:9",
        "16:9",
        "3:2",
        "4:3",
        "5:4",
        "4:5",
        "3:4",
        "2:3",
        "9:16",
      ],
      maxNumberOfImages: 4,
      supportedOutputImageFormat: ["jpeg", "png", "webp"],
    };
    return configs;
  }

  _nanoBananaProConfig() {
    const configs = {
      supportedAspectRatio: [
        "auto",
        "1:1",
        "21:9",
        "16:9",
        "3:2",
        "4:3",
        "5:4",
        "4:5",
        "3:4",
        "2:3",
        "9:16",
      ],
      maxNumberOfImages: 4,
      supportedOutputImageFormat: ["jpeg", "png", "webp"],
      supportedResolution: ["1K", "2K", "4K"],
    };
    return configs;
  }

  _seedDreamConfig() {
    const configs = {
      supportedAspectRatio: [
        "square_hd",
        "square",
        "portrait_4_3",
        "portrait_16_9",
        "landscape_4_3",
        "landscape_16_9",
        "auto_2K",
        "auto_4K",
        "custom_width_height",
      ],
      maxNumberOfImages: 4,
    };
    return configs;
  }

  _gpt1_5ImageConfig() {
    const configs = {
      supportedAspectRatio: ["auto", "1024x1024", "1536x1024", "1024x1536"],
      maxNumberOfImages: 4,
      supportedBackground: ["auto", "transparent", "opaque"],
      supportedQuality: ["low", "medium", "high"],
      supportedOutputImageFormat: ["jpeg", "png", "webp"],
    };
    return configs;
  }

  _midjourneyConfig() {
    const configs = {
      supportedAspectRatio: ["1:1", "16:9", "4:3", "2:3", "9:16"],
      supportedQuality: [0.25, 0.5, 1, 2],
    };
    return configs;
  }

  _validateMidjourneyConfig(config) {
    const supportedConfigs = this._midjourneyConfig();

    if (
      "aspectRatio" in config &&
      !supportedConfigs.supportedAspectRatio.includes(config.aspectRatio)
    ) {
      config.aspectRatio = "1:1";
    }
    if (
      "quality" in config &&
      !supportedConfigs.supportedQuality.includes(config.quality)
    ) {
      config.quality = 1;
    }
    return config;
  }

  _validateNanoBananaConfig(config) {
    const supportedConfigs = this._nanoBananaConfig();

    if (
      "aspectRatio" in config &&
      !supportedConfigs.supportedAspectRatio.includes(config.aspectRatio)
    ) {
      config.aspectRatio = "1:1";
    }
    if (
      "outputImageFormat" in config &&
      !supportedConfigs.supportedOutputImageFormat.includes(
        config.outputImageFormat
      )
    ) {
      config.outputImageFormat = "jpeg";
    }
    return config;
  }

  _validateNanoBananaProConfig(config) {
    const supportedConfigs = this._nanoBananaProConfig();

    if (
      "aspectRatio" in config &&
      !supportedConfigs.supportedAspectRatio.includes(config.aspectRatio)
    ) {
      config.aspectRatio = "1:1";
    }
    if (
      "outputImageFormat" in config &&
      !supportedConfigs.supportedOutputImageFormat.includes(
        config.outputImageFormat
      )
    ) {
      config.outputImageFormat = "jpeg";
    }
    if (
      "resolution" in config &&
      !supportedConfigs.supportedResolution.includes(config.resolution)
    ) {
      config.resolution = "1K";
    }
    return config;
  }

  _validateSeedDreamConfig(config) {
    const supportedConfigs = this._seedDreamConfig();

    if (
      "aspectRatio" in config &&
      !supportedConfigs.supportedAspectRatio.includes(config.aspectRatio)
    ) {
      config.aspectRatio = "square";
    }
    return config;
  }

  _validateGpt1_5ImageConfig(config) {
    const supportedConfigs = this._gpt1_5ImageConfig();

    if (
      "aspectRatio" in config &&
      !supportedConfigs.supportedAspectRatio.includes(config.aspectRatio)
    ) {
      config.aspectRatio = "1024x1024";
    }
    if (
      "background" in config &&
      !supportedConfigs.supportedBackground.includes(config.background)
    ) {
      config.background = "auto";
    }
    if (
      "quality" in config &&
      !supportedConfigs.supportedQuality.includes(config.quality)
    ) {
      config.quality = "medium";
    }
    if (
      "outputImageFormat" in config &&
      !supportedConfigs.supportedOutputImageFormat.includes(
        config.outputImageFormat
      )
    ) {
      config.outputImageFormat = "jpeg";
    }
    return config;
  }

  getSupportedDiffusionModels() {
    return this.supportedDiffusionModels;
  }

  validateDiffusionModel(model) {
    return this.supportedDiffusionModels.includes(model);
  }

  getSupportedProviders() {
    return this.supportedProviders;
  }

  getProviderForModel(model) {
    return this.modelProviderMapping[model];
  }

  getDiffusionModelConfig(model) {
    switch (model) {
      case "nano_banana":
        return this._nanoBananaConfig();
      case "nano_banana_pro":
        return this._nanoBananaProConfig();
      case "seeddream_4_5":
        return this._seedDreamConfig();
      case "gpt_1_5_image":
        return this._gpt1_5ImageConfig();
      case "midjourney":
        return this._midjourneyConfig();
      default:
        return null;
    }
  }

  validateModelConfig(model, config) {
    switch (model) {
      case "nano_banana":
        return this._validateNanoBananaConfig(config);
      case "nano_banana_pro":
        return this._validateNanoBananaProConfig(config);
      case "seeddream_4_5":
        return this._validateSeedDreamConfig(config);
      case "gpt_1_5_image":
        return this._validateGpt1_5ImageConfig(config);
      case "midjourney":
        return this._validateMidjourneyConfig(config);
      default:
        return null;
    }
  }
}

module.exports = DiffusionModelConfigs;