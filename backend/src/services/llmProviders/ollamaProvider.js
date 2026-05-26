const axios = require('axios');
const BaseProvider = require('./baseProvider');

/**
 * Ollama local provider. No API key required (server runs on user's
 * machine), but `baseURL` defaults to http://localhost:11434.
 */
class OllamaProvider extends BaseProvider {
  constructor({ baseURL = 'http://localhost:11434' } = {}) {
    super({
      apiKey: 'ollama',
      baseURL,
      defaultModel: 'llama3.1',
      name: 'ollama',
    });
  }

  async listModels() {
    const res = await axios.get(`${this.baseURL}/api/tags`);
    return (res.data?.models || []).map((m) => m.name);
  }

  _toOllamaMessages(messages) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  _buildRequest(messages, opts, stream) {
    const req = {
      model: opts.model || this.defaultModel,
      messages: this._toOllamaMessages(messages),
      stream,
      options: {
        temperature: opts.temperature ?? 0.7,
      },
    };
    if (opts.maxTokens) req.options.num_predict = opts.maxTokens;
    if (opts.topP != null) req.options.top_p = opts.topP;
    if (opts.jsonMode) req.format = 'json';
    return req;
  }

  async chatCompletion(messages, opts = {}) {
    const req = this._buildRequest(messages, opts, false);
    const res = await axios.post(`${this.baseURL}/api/chat`, req);
    return {
      success: true,
      content: res.data?.message?.content || '',
      usage: { total_tokens: res.data?.eval_count },
      model: res.data?.model || req.model,
    };
  }

  async streamChatCompletion(messages, opts = {}, onDelta = () => {}) {
    const req = this._buildRequest(messages, opts, true);
    const res = await axios.post(`${this.baseURL}/api/chat`, req, { responseType: 'stream' });
    let content = '';
    let model = req.model;
    let usage = null;
    let buffer = '';
    return await new Promise((resolve, reject) => {
      res.data.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          try {
            const json = JSON.parse(line);
            const delta = json.message?.content || '';
            if (delta) {
              content += delta;
              onDelta(delta);
            }
            if (json.model) model = json.model;
            if (json.done && json.eval_count) usage = { total_tokens: json.eval_count };
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

module.exports = OllamaProvider;
