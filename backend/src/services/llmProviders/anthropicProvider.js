const axios = require('axios');
const BaseProvider = require('./baseProvider');

/**
 * Anthropic Messages API provider.
 *
 * Converts standard chat messages (role: system|user|assistant) into
 * Anthropic's split system + messages format.
 */
class AnthropicProvider extends BaseProvider {
  constructor({ apiKey }) {
    super({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-sonnet-4-5',
      name: 'anthropic',
    });
  }

  _headers() {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    };
  }

  async listModels() {
    // Anthropic API exposes /v1/models in newer versions.
    try {
      const res = await axios.get(`${this.baseURL}/models`, { headers: this._headers() });
      return (res.data?.data || []).map((m) => m.id);
    } catch (_) {
      // Fallback to known IDs if endpoint not available.
      return ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'];
    }
  }

  _split(messages) {
    const systemParts = [];
    const rest = [];
    for (const m of messages) {
      if (m.role === 'system') systemParts.push(m.content);
      else rest.push({ role: m.role, content: m.content });
    }
    return { system: systemParts.join('\n\n'), messages: rest };
  }

  _buildRequest(messages, opts) {
    const { system, messages: msgs } = this._split(messages);
    const req = {
      model: opts.model || this.defaultModel,
      system: system || undefined,
      messages: msgs,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.topP != null) req.top_p = opts.topP;
    if (opts.stop) req.stop_sequences = Array.isArray(opts.stop) ? opts.stop : [opts.stop];
    return req;
  }

  async chatCompletion(messages, opts = {}) {
    const req = this._buildRequest(messages, opts);
    const res = await axios.post(`${this.baseURL}/messages`, req, { headers: this._headers() });
    const content = (res.data?.content || []).map((b) => b.text || '').join('');
    return {
      success: true,
      content,
      usage: res.data?.usage,
      model: res.data?.model || req.model,
    };
  }

  async streamChatCompletion(messages, opts = {}, onDelta = () => {}) {
    const req = { ...this._buildRequest(messages, opts), stream: true };
    const res = await axios.post(`${this.baseURL}/messages`, req, {
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
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              content += json.delta.text;
              onDelta(json.delta.text);
            }
            if (json.type === 'message_delta' && json.usage) usage = json.usage;
            if (json.message?.model) model = json.message.model;
          } catch (_) {
            /* ignore */
          }
        }
      });
      res.data.on('end', () => resolve({ success: true, content, usage, model }));
      res.data.on('error', reject);
    });
  }
}

module.exports = AnthropicProvider;
