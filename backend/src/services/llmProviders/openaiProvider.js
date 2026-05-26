const axios = require('axios');
const BaseProvider = require('./baseProvider');

/**
 * Generic OpenAI-compatible provider.
 *
 * Works for: OpenAI, OpenRouter, OpenAI-compatible self-hosted servers,
 * Together, Mistral La Plateforme, Anyscale, etc. — anything that
 * exposes /chat/completions with the OpenAI shape.
 */
class OpenAICompatibleProvider extends BaseProvider {
  constructor({ apiKey, baseURL, defaultModel, name = 'openai', extraHeaders = {} }) {
    super({ apiKey, baseURL, defaultModel, name });
    this.extraHeaders = extraHeaders;
  }

  _headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...this.extraHeaders,
    };
  }

  async listModels() {
    const res = await axios.get(`${this.baseURL}/models`, { headers: this._headers() });
    return (res.data?.data || []).map((m) => m.id);
  }

  _buildRequest(messages, opts) {
    const req = {
      messages,
      model: opts.model || this.defaultModel,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.maxTokens && opts.maxTokens > 0) req.max_tokens = opts.maxTokens;
    if (opts.topP != null) req.top_p = opts.topP;
    if (opts.stop) req.stop = opts.stop;
    if (opts.jsonMode) req.response_format = { type: 'json_object' };
    return req;
  }

  async chatCompletion(messages, opts = {}) {
    const req = this._buildRequest(messages, opts);
    const res = await axios.post(`${this.baseURL}/chat/completions`, req, { headers: this._headers() });
    return {
      success: true,
      content: res.data?.choices?.[0]?.message?.content || '',
      usage: res.data?.usage,
      model: res.data?.model || req.model,
    };
  }

  async streamChatCompletion(messages, opts = {}, onDelta = () => {}) {
    const req = { ...this._buildRequest(messages, opts), stream: true };
    const res = await axios.post(`${this.baseURL}/chat/completions`, req, {
      headers: this._headers(),
      responseType: 'stream',
    });
    let content = '';
    let usage = null;
    let model = req.model;
    let buffer = '';
    return await new Promise((resolve, reject) => {
      res.data.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const raw of lines) {
          const line = raw.trim();
          if (!line || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              content += delta;
              onDelta(delta);
            }
            if (json.usage) usage = json.usage;
            if (json.model) model = json.model;
          } catch (_) {
            /* ignore malformed SSE line */
          }
        }
      });
      res.data.on('end', () => resolve({ success: true, content, usage, model }));
      res.data.on('error', reject);
    });
  }
}

module.exports = OpenAICompatibleProvider;
