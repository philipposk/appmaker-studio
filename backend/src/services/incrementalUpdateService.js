const GroqService = require('./groqService');
const v0Prompts = require('./v0SystemPrompts');

/**
 * Service for incremental code updates (refining specific parts instead of full regeneration)
 * This is similar to how Lovable and v0 handle iterative refinement
 */
class IncrementalUpdateService {
  constructor(apiKey) {
    this.groqService = GroqService.create(apiKey);
  }

  static create(apiKey) {
    return new IncrementalUpdateService(apiKey);
  }

  /**
   * Refine a specific component based on user feedback
   */
  async refineComponent(componentCode, componentName, refinementPrompt, appContext) {
    const systemPrompt = `You are an expert React developer. Your task is to refine an existing component based on user feedback.

CRITICAL RULES:
1. Preserve the existing component structure unless explicitly asked to change it
2. Only modify what the user requests
3. Maintain all existing functionality
4. Keep the same component interface (props, exports)
5. Preserve styling unless asked to change
6. Return ONLY the complete updated component code
7. No explanations, no markdown unless requested`;

    const userPrompt = `Component Name: ${componentName}

Existing Component Code:
\`\`\`jsx
${componentCode}
\`\`\`

App Context:
${JSON.stringify(appContext, null, 2)}

User Refinement Request: ${refinementPrompt}

Refine this component according to the user's request. Return ONLY the complete updated component code.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], null, { maxTokens: 2048, temperature: 0.3 }); // Reduced from 4096 to 2048 - like praiser

    let code = response.content;
    const codeMatch = code.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }

  /**
   * Add a new feature to existing code
   */
  async addFeature(existingCode, featureDescription, appContext) {
    const systemPrompt = `${v0Prompts.componentSystemPrompt}

CRITICAL: You are extending existing code. You must:
1. Integrate the new feature seamlessly
2. Maintain all existing functionality
3. Follow the existing code style and patterns
4. Add the feature without breaking anything
5. Return ONLY the complete updated code`;

    const userPrompt = `Add this feature to the existing code:

Feature: ${featureDescription}

Existing Code:
\`\`\`jsx
${existingCode}
\`\`\`

App Context:
${JSON.stringify(appContext, null, 2)}

Return ONLY the complete updated code with the new feature integrated.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], null, { maxTokens: 2048, temperature: 0.3 }); // Reduced from 4096 to 2048 - like praiser

    let code = response.content;
    const codeMatch = code.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }

  /**
   * Fix a bug or issue in existing code
   */
  async fixBug(componentCode, componentName, bugDescription, appContext) {
    const systemPrompt = `You are an expert React developer debugging code. Fix the described bug.

RULES:
1. Identify and fix ONLY the reported bug
2. Don't change unrelated code
3. Maintain the component's interface
4. Preserve all existing functionality
5. Add comments explaining the fix if needed
6. Return ONLY the fixed component code`;

    const userPrompt = `Component: ${componentName}

Bug Description: ${bugDescription}

Component Code:
\`\`\`jsx
${componentCode}
\`\`\`

App Context:
${JSON.stringify(appContext, null, 2)}

Fix the bug and return ONLY the complete fixed component code.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], null, { maxTokens: 4096, temperature: 0.2 }); // null = use default with auto-fallback

    let code = response.content;
    const codeMatch = code.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }

  /**
   * Update styling of a component
   */
  async updateStyling(componentCode, componentName, stylingRequest, appContext) {
    const systemPrompt = `You are an expert React/CSS developer. Update component styling.

RULES:
1. Only modify styling-related code
2. Maintain component structure and functionality
3. Use Tailwind CSS or CSS Modules as appropriate
4. Ensure responsive design
5. Follow design system principles
6. Return ONLY the complete updated component code`;

    const userPrompt = `Component: ${componentName}

Styling Request: ${stylingRequest}

Component Code:
\`\`\`jsx
${componentCode}
\`\`\`

App Context:
${JSON.stringify(appContext, null, 2)}

Update the styling and return ONLY the complete updated component code.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], null, { maxTokens: 2048, temperature: 0.3 }); // Reduced from 4096 to 2048 - like praiser

    let code = response.content;
    const codeMatch = code.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }
}

module.exports = IncrementalUpdateService;

