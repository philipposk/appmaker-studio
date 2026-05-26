const Groq = require('groq-sdk');
const BaseProvider = require('./baseProvider');

class GroqProvider extends BaseProvider {
  constructor({ apiKey }) {
    super({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      name: 'groq',
    });
    this.client = apiKey ? new Groq({ apiKey }) : null;
  }

  async listModels() {
    if (!this.client) throw new Error('Groq API key not configured');
    const res = await this.client.models.list();
    return (res?.data || []).map((m) => m.id);
  }

  _buildRequest(messages, opts) {
    const req = {
      messages,
      model: opts.model || this.defaultModel,
      temperature: opts.temperature ?? 0.7,
    };
    if (opts.maxTokens && opts.maxTokens > 0 && opts.maxTokens <= 4096) {
      req.max_completion_tokens = opts.maxTokens;
    }
    if (opts.topP != null) req.top_p = opts.topP;
    if (opts.stop) req.stop = opts.stop;
    if (opts.jsonMode) req.response_format = { type: 'json_object' };
    return req;
  }

  async chatCompletion(messages, opts = {}) {
    if (!this.client) throw new Error('Groq API key not configured');
    const req = this._buildRequest(messages, opts);
    const response = await this.client.chat.completions.create(req);
    return {
      success: true,
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
      model: response.model || req.model,
    };
  }

  async streamChatCompletion(messages, opts = {}, onDelta = () => {}) {
    if (!this.client) throw new Error('Groq API key not configured');
    const req = { ...this._buildRequest(messages, opts), stream: true };
    const stream = await this.client.chat.completions.create(req);
    let content = '';
    let usage = null;
    let model = req.model;
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        content += delta;
        onDelta(delta);
      }
      if (chunk.usage) usage = chunk.usage;
      if (chunk.model) model = chunk.model;
    }
    return { success: true, content, usage, model };
  }
}

module.exports = GroqProvider;
