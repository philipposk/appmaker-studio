const Groq = require('groq-sdk');

/**
 * Model Manager - Handles model fetching and fallback logic
 * Automatically fetches available models and provides fallback on failure
 */
class ModelManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.client = apiKey ? new Groq({ apiKey }) : null;
    this.availableModels = null;
    this.lastFetched = null;
    this.cacheDuration = 60 * 60 * 1000; // 1 hour cache (same as praiser)
  }

  /**
   * Get available models from Groq API
   * Falls back to a default list if API call fails
   */
  async getAvailableModels() {
    // Return cached models if still valid
    if (this.availableModels && this.lastFetched) {
      const age = Date.now() - this.lastFetched;
      if (age < this.cacheDuration) {
        return this.availableModels;
      }
    }

    if (!this.apiKey) {
      return this.getDefaultModels();
    }

    try {
      // Use direct fetch like praiser app (more reliable than SDK)
      // Node 18+ has built-in fetch, Node 25 definitely has it
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models = data.data || [];

      // Define model priority order based on praiser app logic
      // Production Models (prioritize larger models first for better quality)
      const productionModelOrder = [
        'openai/gpt-oss-120b', // 120B - best quality
        'llama-3.3-70b-versatile', // 70B - excellent quality
        'openai/gpt-oss-20b', // 20B - good quality
        'llama-3.1-8b-instant', // 8B - faster but smaller
        'llama-3.3-8b-instant', // 8B - faster but smaller
      ];

      // Preview Models (backup options)
      const previewModelOrder = [
        'qwen/qwen3-32b', // 32B - good multilingual support
        'openai/gpt-oss-safeguard-20b', // 20B - safeguard version
        'meta-llama/llama-4-maverick-17b-128e-instruct', // 17B
        'meta-llama/llama-4-scout-17b-16e-instruct', // 17B
        'moonshotai/kimi-k2-instruct-0905', // Chinese-focused
      ];

      // Create sets for quick lookup
      const productionModelSet = new Set(productionModelOrder.map(id => id.toLowerCase()));
      const previewModelSet = new Set(previewModelOrder.map(id => id.toLowerCase()));

      // Filter and categorize models (like praiser)
      const availableModelsMap = new Map();
      models.forEach((model) => {
        const id = model.id.toLowerCase();
        // Skip TTS models (except for transcription), systems, and decommissioned models
        if (id.includes('tts') && !id.includes('whisper')) return;
        if (id.includes('groq/compound')) return; // Skip systems
        if (id.includes('llama-3.1-70b-versatile')) return; // Skip decommissioned
        if (id.includes('whisper')) return; // Skip audio transcription only
        
        availableModelsMap.set(id, model.id);
      });

      // Build ordered list: Production Models first, then Preview Models
      const orderedModels = [];
      
      // Add production models in order
      for (const modelId of productionModelOrder) {
        const lowerId = modelId.toLowerCase();
        if (availableModelsMap.has(lowerId)) {
          orderedModels.push(availableModelsMap.get(lowerId));
          availableModelsMap.delete(lowerId);
        }
      }

      // Add preview models in order
      for (const modelId of previewModelOrder) {
        const lowerId = modelId.toLowerCase();
        if (availableModelsMap.has(lowerId)) {
          orderedModels.push(availableModelsMap.get(lowerId));
          availableModelsMap.delete(lowerId);
        }
      }

      // Add any remaining models that weren't in our priority lists (fallback)
      const remainingModels = Array.from(availableModelsMap.values())
        .filter(id => {
          const lowerId = id.toLowerCase();
          // Only include text generation models
          return !lowerId.includes('tts') && 
                 !lowerId.includes('compound') &&
                 !lowerId.includes('whisper');
        })
        .sort();

      // Add fallback models if not already included
      const fallbackModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.3-8b-instant'];
      for (const fallbackModel of fallbackModels) {
        if (!orderedModels.includes(fallbackModel) && !remainingModels.includes(fallbackModel)) {
          remainingModels.push(fallbackModel);
        }
      }

      const finalModels = [...orderedModels, ...remainingModels];
      
      // If no models found, use default list
      const finalList = finalModels.length > 0 ? finalModels : this.getDefaultModels();

      this.availableModels = finalList;
      this.lastFetched = Date.now();

      console.log(`✅ Fetched ${finalList.length} available models from Groq API`);
      return finalList;
    } catch (error) {
      console.warn('⚠️ Failed to fetch models from Groq API, using defaults:', error.message);
      return this.getDefaultModels();
    }
  }

  /**
   * Get default fallback models (used if API fetch fails)
   */
  getDefaultModels() {
    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3-32b',
      'groq/compound',
      'groq/compound-mini'
    ];
  }

  /**
   * Get next model in fallback chain
   * Forces refresh of available models when a failure occurs
   */
  async getNextModel(currentModel = null, failedModels = [], forceRefresh = false) {
    // Force refresh if a model failed (get fresh list from Groq API)
    if (forceRefresh || failedModels.length > 0) {
      console.log(`🔄 Model failed, fetching fresh list from Groq API...`);
      this.clearCache(); // Clear cache to force refresh
      const freshModels = await this.getAvailableModels();
      console.log(`✅ Got ${freshModels.length} fresh models from Groq API`);
    }
    
    const availableModels = await this.getAvailableModels();
    
    // Filter out failed models
    const workingModels = availableModels.filter(model => !failedModels.includes(model));
    
    if (workingModels.length === 0) {
      console.error('⚠️ All available models have failed');
      return availableModels[0] || 'llama-3.1-8b-instant';
    }
    
    // If no current model, return first available that hasn't failed
    if (!currentModel) {
      return workingModels[0];
    }

    // Find current model index in working models
    const currentIndex = workingModels.indexOf(currentModel);
    
    // Return next working model after current
    if (currentIndex >= 0 && currentIndex < workingModels.length - 1) {
      return workingModels[currentIndex + 1];
    }
    
    // If current not found or is last, return first working model
    return workingModels[0];
  }

  /**
   * Check if error indicates model failure (decommissioned, rate limit, etc.)
   */
  shouldRetryWithDifferentModel(error) {
    const errorMessage = String(error.message || '');
    const errorCode = error.code || '';
    const errorType = error.type || '';
    const errorStatus = error.status || 429;

    // Check for over capacity (503) - like praiser app
    const isOverCapacity =
      errorStatus === 503 ||
      errorMessage.toLowerCase().includes('over capacity') ||
      errorMessage.toLowerCase().includes('currently over capacity');

    // Check for request too large (413) - like praiser app
    const isRequestTooLarge =
      errorStatus === 413 ||
      (errorCode === 'rate_limit_exceeded' &&
        errorMessage.toLowerCase().includes('request too large'));

    // Model decommissioned
    const isModelError =
      errorCode === 'model_decommissioned' ||
      errorCode === 'model_not_found' ||
      errorMessage.toLowerCase().includes('decommissioned') ||
      errorMessage.toLowerCase().includes('model not found') ||
      (errorMessage.includes('no longer supported'));

    // Rate limit on specific model (check if error message mentions a specific model)
    const isRateLimit =
      errorStatus === 429 ||
      errorCode === 'rate_limit_exceeded' ||
      errorType === 'tokens' ||
      errorMessage.toLowerCase().includes('rate limit');

    // Check if the error message mentions a specific model (model-specific rate limit)
    const hasModelInMessage =
      errorMessage.includes('for model') ||
      errorMessage.includes('model `') ||
      errorMessage.includes('model ') ||
      errorMessage.match(/model\s+`?[\w\-\/]+`?/i);

    // Invalid model error
    const isInvalidModel =
      errorCode === 'invalid_request_error' && errorMessage.toLowerCase().includes('model');

    // Retry with different model if:
    // - Over capacity (503)
    // - Request too large (413)
    // - Model-specific rate limit (429 with model in message)
    // - Model decommissioned/not found
    // - Invalid model error
    if (isOverCapacity || isRequestTooLarge || isModelError || isInvalidModel) {
      console.log(`🔍 Detected error requiring model switch:`, {
        overCapacity: isOverCapacity,
        requestTooLarge: isRequestTooLarge,
        modelError: isModelError,
        invalidModel: isInvalidModel,
        message: errorMessage.substring(0, 150),
      });
      return true;
    }

    // Rate limit with model-specific message
    if (isRateLimit && hasModelInMessage) {
      console.log(`🔍 Detected model-specific rate limit (${errorCode}), will retry with different model`);
      console.log(`   Error message: ${errorMessage.substring(0, 150)}`);
      return true;
    }

    return false;
  }

  /**
   * Clear cache (force refresh on next request)
   */
  clearCache() {
    this.availableModels = null;
    this.lastFetched = null;
  }

  static create(apiKey) {
    return new ModelManager(apiKey);
  }
}

module.exports = ModelManager;

