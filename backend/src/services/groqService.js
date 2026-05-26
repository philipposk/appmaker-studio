const Groq = require('groq-sdk');
const ModelManager = require('./modelManager');

class GroqService {
  constructor(apiKey) {
    this.client = apiKey ? new Groq({ apiKey }) : null;
    this.modelManager = ModelManager.create(apiKey);
    this.defaultModel = 'llama-3.3-70b-versatile';
  }

  /**
   * Test connection to Groq API with automatic model fallback
   */
  async testConnection(model = null) {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    const testModel = model || this.defaultModel;
    let lastError = null;

    try {
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: 'Hello, test connection'
          }
        ],
        model: testModel,
        max_completion_tokens: 10
      });

      return {
        success: true,
        message: 'Connection successful',
        response: response.choices[0]?.message?.content || 'OK',
        model: testModel
      };
    } catch (error) {
      lastError = error;
      
      // Check if we should try a different model
      if (this.modelManager.shouldRetryWithDifferentModel(error)) {
        const nextModel = await this.modelManager.getNextModel(testModel, [testModel]);
        if (nextModel !== testModel) {
          console.log(`⚠️ Model ${testModel} failed, retrying with ${nextModel}`);
          return this.testConnection(nextModel);
        }
      }

      // Handle rate limit errors specifically
      if (error.status === 429 || error.response?.status === 429) {
        const errorData = error.response?.data?.error || error.error || {};
        const message = errorData.message || error.message || 'Rate limit exceeded';
        const retryAfter = errorData.retry_after || error.response?.headers?.['retry-after'] || '2-3 minutes';
        throw new Error(`Rate limit exceeded: ${message}. Please wait ${retryAfter} and try again, or upgrade your Groq tier at https://console.groq.com/settings/billing`);
      }
      throw new Error(`Groq API error: ${lastError.message || JSON.stringify(lastError.response?.data || lastError)}`);
    }
  }

  /**
   * Send a chat completion request with automatic model fallback
   */
  async chatCompletion(messages, model = null, options = {}) {
    if (!this.client) {
      throw new Error('Groq API key not configured');
    }

    const requestModel = model || this.defaultModel;
    const failedModels = options.failedModels || [];
    const maxRetries = options.maxRetries || 5; // Increased from 3 to 5
    let currentModel = requestModel;
    let attempt = 0;
    let allFailedModels = [...failedModels]; // Track all failed models across retries

    while (attempt < maxRetries) {
      try {
        // Extract maxTokens and convert to max_completion_tokens (Groq API requirement)
        const { maxTokens, failedModels: _, maxRetries: __, ...groqOptions } = options;
        
        // Build request like praiser app - don't specify max_completion_tokens unless explicitly requested
        // Praiser app doesn't specify it, letting Groq use defaults (more reliable)
        const requestOptions = {
          messages,
          model: currentModel,
          temperature: options.temperature || 0.7,
          ...groqOptions
        };
        
        // Only add max_completion_tokens if explicitly provided and reasonable
        // Praiser doesn't specify it - let Groq use defaults for better reliability
        // Only set if explicitly requested and reasonable (max 4096)
        if (maxTokens && maxTokens > 0 && maxTokens <= 4096) {
          requestOptions.max_completion_tokens = maxTokens;
        }
        // If maxTokens > 4096, don't set it and let Groq use model defaults (safer)
        
        const response = await this.client.chat.completions.create(requestOptions);

        return {
          success: true,
          content: response.choices[0]?.message?.content || '',
          usage: response.usage,
          model: response.model || currentModel
        };
      } catch (error) {
        attempt++;
        
        // Try to parse error message if it's a JSON string
        let errorData = {};
        let errorMessage = error.message || '';
        
        // Check if error.message contains JSON (common with Groq SDK)
        try {
          if (typeof errorMessage === 'string' && errorMessage.includes('{')) {
            const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.error) {
                errorData = parsed.error;
                errorMessage = parsed.error.message || errorMessage;
              }
            }
          }
        } catch (e) {
          // Not JSON, continue with original parsing
        }
        
        // Parse error from different possible formats
        if (!errorData.code) {
          errorData = error.response?.data?.error || error.error || errorData || {};
        }
        
        const errorCode = errorData.code || error.code || '';
        const errorType = errorData.type || error.type || '';
        errorMessage = errorData.message || errorMessage;
        const errorStatus = error.status || error.response?.status || 429;

        // Build normalized error object for detection
        const normalizedError = {
          message: String(errorMessage),
          code: String(errorCode),
          type: String(errorType),
          status: errorStatus,
          response: error.response,
          error: error.error || errorData
        };

        // Check if we should try a different model (do this FIRST, before checking general rate limits)
        const shouldRetry = this.modelManager.shouldRetryWithDifferentModel(normalizedError);
        
        console.log(`❌ Model ${currentModel} failed (attempt ${attempt}/${maxRetries}):`, {
          code: errorCode,
          type: errorType,
          message: errorMessage.substring(0, 200),
          shouldRetry,
          failedModels,
          rawError: error.message?.substring(0, 100)
        });

        if (shouldRetry && attempt < maxRetries) {
          // Add current model to failed list if not already there
          if (!allFailedModels.includes(currentModel)) {
            allFailedModels.push(currentModel);
          }
          
          // Force refresh models from Groq API when switching due to failure
          const nextModel = await this.modelManager.getNextModel(currentModel, allFailedModels, true);
          
          if (nextModel && nextModel !== currentModel && !allFailedModels.includes(nextModel)) {
            console.log(`🔄 Switching from ${currentModel} to ${nextModel} (attempt ${attempt + 1}/${maxRetries})`);
            console.log(`   Fetching fresh model list from https://api.groq.com/openai/v1/models`);
            console.log(`   Failed models so far: ${allFailedModels.join(', ')}`);
            currentModel = nextModel;
            attempt++; // Increment attempt counter
            // Small delay before retrying with new model
            await new Promise(resolve => setTimeout(resolve, 500));
            continue; // Retry with next model
          } else {
            console.log(`⚠️ No alternative model available, all models exhausted. Failed: ${allFailedModels.join(', ')}`);
            // Don't increment attempt if no alternative model, break out
            break;
          }
        }

        // Handle rate limit errors specifically (only if we're not retrying with different model)
        if (errorStatus === 429 || errorCode === 'rate_limit_exceeded') {
          const message = errorMessage || 'Rate limit exceeded';
          const retryAfter = errorData.retry_after || error.response?.headers?.['retry-after'] || '2-3 minutes';
          
          // Only throw if it's a general rate limit (not model-specific) or all models exhausted
          if (!shouldRetry || attempt >= maxRetries) {
            console.log(`❌ Rate limit error - shouldRetry: ${shouldRetry}, attempts: ${attempt}/${maxRetries}`);
            throw new Error(`Rate limit exceeded: ${message}. Please wait ${retryAfter} and try again, or upgrade your Groq tier at https://console.groq.com/settings/billing`);
          }
        }

        // Final error - all retries exhausted
        throw new Error(`Groq API error (model: ${currentModel}): ${error.message || JSON.stringify(errorData)}`);
      }
    }

    throw new Error(`All model retry attempts failed. Last model: ${currentModel}`);
  }

  /**
   * Create a new GroqService instance with API key
   */
  static create(apiKey) {
    return new GroqService(apiKey);
  }
}

module.exports = GroqService;

