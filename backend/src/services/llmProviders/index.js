/**
 * Provider registry / factory.
 *
 * Usage:
 *   const { getProvider, listProviders } = require('./llmProviders');
 *   const llm = getProvider('groq');                 // env-keyed
 *   const llm2 = getProvider('openai', { apiKey });  // explicit key
 *
 * Cross-provider fallback:
 *   const { runWithFallback } = require('./llmProviders');
 *   await runWithFallback({ providers: ['groq','openrouter','openai'], messages, opts });
 */
const GroqProvider = require('./groqProvider');
const OpenAICompatibleProvider = require('./openaiProvider');
const AnthropicProvider = require('./anthropicProvider');
const OllamaProvider = require('./ollamaProvider');

const REGISTRY = {
  groq: ({ apiKey } = {}) => new GroqProvider({ apiKey: apiKey || process.env.GROQ_API_KEY }),

  openai: ({ apiKey } = {}) =>
    new OpenAICompatibleProvider({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
      name: 'openai',
    }),

  openrouter: ({ apiKey } = {}) =>
    new OpenAICompatibleProvider({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.5',
      name: 'openrouter',
      extraHeaders: {
        'HTTP-Referer': process.env.PUBLIC_URL || 'https://appmaker.local',
        'X-Title': 'AppMaker',
      },
    }),

  together: ({ apiKey } = {}) =>
    new OpenAICompatibleProvider({
      apiKey: apiKey || process.env.TOGETHER_API_KEY,
      baseURL: 'https://api.together.xyz/v1',
      defaultModel: process.env.TOGETHER_DEFAULT_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      name: 'together',
    }),

  mistral: ({ apiKey } = {}) =>
    new OpenAICompatibleProvider({
      apiKey: apiKey || process.env.MISTRAL_API_KEY,
      baseURL: 'https://api.mistral.ai/v1',
      defaultModel: process.env.MISTRAL_DEFAULT_MODEL || 'mistral-large-latest',
      name: 'mistral',
    }),

  anthropic: ({ apiKey } = {}) =>
    new AnthropicProvider({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY }),

  ollama: () => new OllamaProvider({ baseURL: process.env.OLLAMA_BASE_URL }),
};

function listProviders() {
  return Object.keys(REGISTRY);
}

function getProvider(name, opts = {}) {
  const key = String(name || '').toLowerCase();
  const make = REGISTRY[key];
  if (!make) throw new Error(`Unknown LLM provider: ${name}. Available: ${listProviders().join(', ')}`);
  return make(opts);
}

function listAvailableProviders() {
  return listProviders().filter((name) => {
    try {
      return getProvider(name).isAvailable();
    } catch (_) {
      return false;
    }
  });
}

/**
 * Try `providers` in order. On error, fall back to the next.
 * Returns whatever the first successful provider returns.
 */
async function runWithFallback({ providers, messages, opts = {}, stream = false, onDelta }) {
  const order = providers && providers.length ? providers : listAvailableProviders();
  let lastErr = null;
  for (const name of order) {
    try {
      const provider = getProvider(name);
      if (!provider.isAvailable()) continue;
      if (stream) return await provider.streamChatCompletion(messages, opts, onDelta || (() => {}));
      return await provider.chatCompletion(messages, opts);
    } catch (err) {
      console.warn(`[llmProviders] ${name} failed: ${err.message}. Falling back.`);
      lastErr = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastErr?.message || 'none configured'}`);
}

module.exports = {
  getProvider,
  listProviders,
  listAvailableProviders,
  runWithFallback,
};
