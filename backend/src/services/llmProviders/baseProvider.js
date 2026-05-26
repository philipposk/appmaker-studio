/**
 * BaseProvider - abstract LLM provider contract.
 *
 * Subclasses implement:
 *   - listModels(): Promise<string[]>
 *   - chatCompletion(messages, opts): Promise<{ content, model, usage }>
 *   - streamChatCompletion(messages, opts, onDelta): Promise<{ content, model, usage }>
 *
 * Options shape (provider-agnostic):
 *   { model?, temperature?, maxTokens?, topP?, stop?, jsonMode? }
 *
 * onDelta(deltaString) is called with each streamed text chunk.
 */
class BaseProvider {
  constructor({ apiKey, baseURL, defaultModel, name }) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.defaultModel = defaultModel;
    this.name = name;
  }

  async listModels() {
    throw new Error(`${this.name}: listModels() not implemented`);
  }

  async chatCompletion(messages, opts = {}) {
    throw new Error(`${this.name}: chatCompletion() not implemented`);
  }

  async streamChatCompletion(messages, opts = {}, onDelta = () => {}) {
    // Default: fall back to non-streaming and emit single delta.
    const res = await this.chatCompletion(messages, opts);
    if (res?.content) onDelta(res.content);
    return res;
  }

  isAvailable() {
    return Boolean(this.apiKey) || this.name === 'ollama';
  }
}

module.exports = BaseProvider;
