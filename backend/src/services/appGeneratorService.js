const GroqService = require('./groqService');
const v0Prompts = require('./v0SystemPrompts');
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

class AppGeneratorService {
  constructor(apiKey) {
    this.groqService = GroqService.create(apiKey);
  }

  /**
   * Generate a complete app from a natural language prompt
   */
  async generateApp(prompt, appType = 'web', options = {}) {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 STARTING APP GENERATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   📝 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
      console.log('   📱 App Type:', appType);
      console.log('');
      
      // Step 1: Generate app structure and plan
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 STEP 1: GENERATING APP PLAN (BLUEPRINT/INSTRUCTIONS)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   This creates the technical blueprint/instructions with:');
      console.log('   - App structure (pages, components)');
      console.log('   - API endpoints and data models');
      console.log('   - Dependencies and tech stack');
      console.log('   - Feature list and requirements');
      console.log('');
      
      const appPlan = await this.generateAppPlan(prompt, appType);
      
      console.log('✅ App plan (BLUEPRINT) generated successfully!');
      console.log('   📛 App Name:', appPlan.appName || 'N/A');
      console.log('   📄 Pages:', appPlan.pages?.length || 0, appPlan.pages?.map(p => p.name || p).join(', ') || 'none');
      console.log('   🧩 Components:', appPlan.components?.length || 0, appPlan.components?.map(c => c.name || c).join(', ') || 'none');
      console.log('   🔌 API Endpoints:', appPlan.apiEndpoints?.length || 0);
      console.log('   💾 Data Models:', appPlan.dataModels?.map(m => m.name).join(', ') || 'none');
      console.log('   ⭐ Features:', appPlan.features?.join(', ') || 'none');
      console.log('');
      
          // Step 2: Generate frontend code
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🎨 STEP 2: GENERATING FRONTEND CODE');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('   Generating React components based on the plan:');
          console.log('   - App.jsx (main component with routing)');
          if (appPlan.pages?.length > 0) {
            console.log(`   - ${appPlan.pages.length} page(s): ${appPlan.pages.map(p => p.name || p).join(', ')}`);
          }
          if (appPlan.components?.length > 0) {
            console.log(`   - ${appPlan.components.length} component(s): ${appPlan.components.map(c => c.name || c).join(', ')}`);
          }
          console.log('');
          
          const frontendCode = await this.generateFrontend(appPlan, options);
          
          console.log('✅ Frontend code generated');
          console.log('   📁 Files created:', frontendCode.structure?.length || 0);
          frontendCode.structure?.forEach(file => {
            console.log(`      - ${file.path} (${file.type}, ${file.content?.length || 0} chars)`);
          });
          console.log('');
      
          // Step 3: Generate backend code
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('⚙️  STEP 3: GENERATING BACKEND CODE');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('   Generating Express.js backend based on the plan:');
          if (appPlan.apiEndpoints?.length > 0) {
            console.log(`   - ${appPlan.apiEndpoints.length} API endpoint(s)`);
            appPlan.apiEndpoints.forEach(ep => {
              console.log(`     * ${ep.method || 'GET'} ${ep.path} - ${ep.description || ''}`);
            });
          }
          if (appPlan.dataModels?.length > 0) {
            console.log(`   - ${appPlan.dataModels.length} data model(s): ${appPlan.dataModels.map(m => m.name).join(', ')}`);
          }
          console.log('');
          
          const backendCode = await this.generateBackend(appPlan, options);
          
          console.log('✅ Backend code generated');
          console.log('   📁 Files created:', backendCode.structure?.length || 0);
          backendCode.structure?.forEach(file => {
            console.log(`      - ${file.path} (${file.type}, ${file.content?.length || 0} chars)`);
          });
          console.log('');
      
          // Step 4: Generate tests
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🧪 STEP 4: GENERATING TESTS');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('   Generating Jest tests:');
          console.log(`   - Unit tests for ${frontendCode.structure?.filter(f => f.type === 'component' || f.type === 'page').length || 0} component(s)`);
          console.log(`   - Integration tests for ${appPlan.apiEndpoints?.length || 0} API endpoint(s)`);
          console.log('');
          
          const tests = await this.generateTests(appPlan, frontendCode, backendCode);
          
          console.log('✅ Tests generated');
          console.log('   📝 Unit tests:', tests.unitTests?.length || 0);
          console.log('   🔗 Integration tests:', tests.integrationTests?.length || 0);
          console.log('');
          
          // Step 5: Generate configuration files
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('⚙️  STEP 5: GENERATING CONFIGURATION FILES');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('   Generating package.json, .env, etc.');
          console.log('');
          
          const config = await this.generateConfig(appPlan, appType);
          
          console.log('✅ Configuration files generated');
          console.log('');

      // Final validation - ensure structures are arrays
      if (!Array.isArray(frontendCode.structure)) {
        console.error('❌ ERROR: Frontend structure is not an array! Type:', typeof frontendCode.structure);
        console.error('   Value:', JSON.stringify(frontendCode.structure).substring(0, 200));
        frontendCode.structure = [];
      } else {
        console.log('✅ Frontend structure is valid array with', frontendCode.structure.length, 'items');
      }
      
      if (!Array.isArray(backendCode.structure)) {
        console.error('❌ ERROR: Backend structure is not an array! Type:', typeof backendCode.structure);
        console.error('   Value:', JSON.stringify(backendCode.structure).substring(0, 200));
        backendCode.structure = [];
      } else {
        console.log('✅ Backend structure is valid array with', backendCode.structure.length, 'items');
      }

      // Check if structures are empty
      if (frontendCode.structure.length === 0 && backendCode.structure.length === 0) {
        console.error('❌ CRITICAL: Both frontend and backend structures are empty!');
        throw new Error('No code was generated. Groq API may have returned empty responses or hit rate limits.');
      }

          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('🎉 GENERATION COMPLETED SUCCESSFULLY!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   📦 Total files generated: ${frontendCode.structure.length + backendCode.structure.length}`);
          console.log(`   🎨 Frontend files: ${frontendCode.structure.length}`);
          console.log(`   ⚙️  Backend files: ${backendCode.structure.length}`);
          console.log(`   🧪 Tests: ${(tests.unitTests?.length || 0) + (tests.integrationTests?.length || 0)}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');

      return {
        success: true,
        appPlan,
        frontend: frontendCode,
        backend: backendCode,
        tests,
        config,
        prompt
      };
    } catch (error) {
      console.error('❌ App generation failed:', error.message);
      console.error('   Stack:', error.stack);
      throw new Error(`App generation failed: ${error.message}`);
    }
  }

  /**
   * Generate app plan and structure
   */
  async generateAppPlan(prompt, appType) {
      console.log('   🔄 Calling Groq API to generate app plan...');
      console.log('   📤 Request: JSON structure with app blueprint');
      console.log('   ⏳ Waiting for Groq response...');
    
    const systemPrompt = `${v0Prompts.appPlanSystemPrompt}

App Type: ${appType}
User Request: ${prompt}

Analyze this request and provide the JSON plan.`;

    try {
      const response = await this.groqService.chatCompletion([
        { role: 'system', content: v0Prompts.appPlanSystemPrompt },
        { role: 'user', content: `App Type: ${appType}\nUser Request: ${prompt}\n\nCreate a detailed technical plan following the JSON structure provided.` }
      ], null, { maxTokens: 2048, temperature: 0.2 }); // Reduced from 4096 to 2048 - like praiser

      console.log('   ✅ Received response from Groq API');
      console.log('   🤖 Model used:', response.model || 'unknown');
      console.log('   📊 Response size:', response.content?.length || 0, 'characters');
      console.log('   📈 Tokens used:', response.usage?.total_tokens || 'unknown');
      console.log('   🔍 Parsing JSON blueprint...');

      try {
        // Extract JSON from response (handles markdown code blocks)
        let jsonStr = response.content || '';
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        
        const parsed = JSON.parse(jsonStr.trim());
        console.log('   ✅ Successfully parsed app plan JSON');
        return parsed;
      } catch (parseError) {
        console.error('   ❌ Failed to parse app plan JSON:', parseError.message);
        console.error('   Response snippet:', response.content?.substring(0, 200));
        // Fallback: try to parse as-is
        try {
          return JSON.parse(response.content);
        } catch (e) {
          throw new Error(`Failed to parse app plan: ${e.message}. Response: ${response.content?.substring(0, 200)}`);
        }
      }
    } catch (error) {
      console.error('   ❌ Failed to generate app plan:', error.message);
      throw error;
    }
  }

  /**
   * Generate frontend code structure
   */
  async generateFrontend(appPlan, options = {}) {
    const structure = [];
    const dependencies = appPlan.dependencies?.frontend || {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.20.0'
    };

    console.log('   Generating frontend components...');
    console.log('   Pages to generate:', appPlan.pages?.length || 0);
    console.log('   Components to generate:', appPlan.components?.length || 0);

    // Generate main App component
    console.log('   Generating App component...');
    let appComponent = null;
    try {
      appComponent = await this.generateComponent({
        name: 'App',
        type: 'main',
        description: 'Main app component with routing',
        plan: appPlan
      });

      if (appComponent && appComponent.trim()) {
        structure.push({
          path: 'src/App.jsx',
          content: appComponent,
          type: 'component'
        });
        console.log('   ✅ App component generated');
      } else {
        console.error('   ❌ App component is empty!');
        throw new Error('App component generation returned empty content');
      }
    } catch (error) {
      console.error('   ❌ Failed to generate App component:', error.message);
      throw error;
    }

    // Generate pages
    for (const page of appPlan.pages || []) {
      console.log(`   Generating page: ${page.name || page}...`);
      try {
        const pageCode = await this.generateComponent({
          name: page.name || page,
          type: 'page',
          description: page.description || `Page: ${page}`,
          plan: appPlan
        });

        if (pageCode && pageCode.trim()) {
          structure.push({
            path: `src/pages/${page.name || page}.jsx`,
            content: pageCode,
            type: 'page'
          });
          console.log(`   ✅ Page ${page.name || page} generated`);
        } else {
          console.error(`   ❌ Page ${page.name || page} is empty!`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to generate page ${page.name || page}:`, error.message);
        // Continue with other pages
      }
    }

    // Generate components
    for (const component of appPlan.components || []) {
            console.log(`   🔄 Generating component: ${component.name || component}...`);
            console.log(`      📤 Calling Groq API with component prompt...`);
      try {
        const componentCode = await this.generateComponent({
          name: component.name || component,
          type: 'component',
          description: component.description || `Component: ${component}`,
          plan: appPlan
        });

        if (componentCode && componentCode.trim()) {
          structure.push({
            path: `src/components/${component.name || component}.jsx`,
            content: componentCode,
            type: 'component'
          });
              console.log(`      ✅ Component ${component.name || component} generated (${componentCode.length} chars)`);
        } else {
          console.error(`   ❌ Component ${component.name || component} is empty!`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to generate component ${component.name || component}:`, error.message);
        // Continue with other components
      }
    }

    // Generate index file
    const indexCode = this.generateIndexFile(appPlan);
    structure.push({
      path: 'src/index.jsx',
      content: indexCode,
      type: 'entry'
    });

    // Generate package.json
    const packageJson = {
      name: appPlan.appName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      private: true,
      dependencies: dependencies,
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject'
      }
    };

    return {
      code: appComponent, // Main entry point
      structure,
      dependencies
    };
  }

  /**
   * Generate individual component with automatic model fallback
   */
  async generateComponent({ name, type, description, plan }) {
    const userPrompt = `Generate a React ${type} component named "${name}".

App Context:
- App Name: ${plan.appName}
- Features: ${JSON.stringify(plan.features || [])}
- Description: ${description}
- Related Components: ${JSON.stringify(plan.components?.filter(c => c.name !== name).map(c => c.name) || [])}

Requirements:
1. Make it production-ready with proper error handling
2. Include loading states if needed
3. Use Tailwind CSS for styling (if applicable)
4. Make it accessible (ARIA labels, keyboard navigation)
5. Include proper TypeScript types or PropTypes
6. Add meaningful comments for complex logic

Return ONLY the complete, executable component code. No markdown, no explanations.`;

    // Retry with different models if we get empty responses
    let failedModels = [];
    const maxModelRetries = 5; // Try up to 5 different models
    let lastError = null;

    for (let modelAttempt = 0; modelAttempt < maxModelRetries; modelAttempt++) {
      try {
        console.log(`   Attempting with model (attempt ${modelAttempt + 1}/${maxModelRetries})...`);
        
        // Pass failedModels so GroqService knows which models to avoid
        const response = await this.groqService.chatCompletion([
          { role: 'system', content: v0Prompts.componentSystemPrompt },
          { role: 'user', content: userPrompt }
        ], null, { 
          maxTokens: 2048, // Reduced from 4096 to avoid rate limits 
          temperature: 0.4,
          failedModels: failedModels, // Tell GroqService which models failed
          maxRetries: 3 // Retry 3 times per model
        });

        // Extract code from markdown if present
        let code = response.content || '';
        const codeMatch = code.match(/```(?:jsx|javascript|js)?\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          code = codeMatch[1];
        }

        code = code.trim();

        // Check if code is actually empty or too short (likely an error)
        if (!code || code.length < 50) {
          console.warn(`   ⚠️ Model ${response.model || 'unknown'} returned empty/too short code (${code.length} chars), trying next model...`);
          failedModels.push(response.model || 'unknown');
          lastError = new Error(`Empty response from model ${response.model || 'unknown'}`);
          continue; // Try next model
        }

        console.log(`   ✅ Got valid code from model ${response.model || 'unknown'} (${code.length} chars)`);
        return code;
      } catch (error) {
        lastError = error;
        console.error(`   ❌ Model attempt ${modelAttempt + 1} failed:`, error.message.substring(0, 100));
        
        // If it's a model-specific error, add to failed models
        const errorMessage = String(error.message || '');
        if (errorMessage.includes('model') || errorMessage.includes('rate limit')) {
          // Try to extract model name from error
          const modelMatch = errorMessage.match(/model\s+[`']?([\w\-\/]+)[`']?/i);
          if (modelMatch && !failedModels.includes(modelMatch[1])) {
            failedModels.push(modelMatch[1]);
          }
        }

        // Continue to next model attempt
        if (modelAttempt < maxModelRetries - 1) {
          console.log(`   🔄 Trying next available model...`);
          // Small delay before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }

    // All models failed
    throw new Error(`Failed to generate component "${name}" after trying ${maxModelRetries} models. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Generate backend code
   */
  async generateBackend(appPlan, options = {}) {
    const structure = [];
    const dependencies = appPlan.dependencies?.backend || {
      'express': '^4.18.2',
      'mongoose': '^7.5.0',
      'cors': '^2.8.5',
      'dotenv': '^16.3.1'
    };

    // Generate server.js
    const serverCode = await this.generateServerCode(appPlan);
    structure.push({
      path: 'server.js',
      content: serverCode,
      type: 'entry'
    });

    // Generate models
    for (const model of appPlan.dataModels || []) {
      const modelCode = await this.generateModelCode(model, appPlan);
      structure.push({
        path: `models/${model.name}.js`,
        content: modelCode,
        type: 'model'
      });
    }

    // Generate routes
    const routesCode = await this.generateRoutesCode(appPlan);
    structure.push({
      path: 'routes/index.js',
      content: routesCode,
      type: 'route'
    });

    // Generate controllers
    for (const endpoint of appPlan.apiEndpoints || []) {
      const controllerCode = await this.generateControllerCode(endpoint, appPlan);
      structure.push({
        path: `controllers/${endpoint.name || endpoint.path}.js`,
        content: controllerCode,
        type: 'controller'
      });
    }

    // Generate package.json
    const packageJson = {
      name: `${appPlan.appName.toLowerCase().replace(/\s+/g, '-')}-backend`,
      version: '1.0.0',
      main: 'server.js',
      dependencies: dependencies,
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js'
      }
    };

    return {
      code: serverCode,
      structure,
      dependencies
    };
  }

  /**
   * Helper method to extract code with validation and model fallback
   */
  async generateCodeWithFallback(systemPrompt, userPrompt, options = {}) {
    const failedModels = [];
    const maxModelRetries = 5;
    const minCodeLength = options.minLength || 50;
    
    for (let attempt = 0; attempt < maxModelRetries; attempt++) {
      try {
        const response = await this.groqService.chatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], null, { 
          maxTokens: options.maxTokens || 2048, // Reduced default from 4096 to 2048
          temperature: options.temperature || 0.4,
          failedModels,
          maxRetries: 3
        });

        let code = response.content || '';
        const codeMatch = code.match(/```(?:javascript|js|jsx)?\s*([\s\S]*?)\s*```/);
        if (codeMatch) {
          code = codeMatch[1];
        }

        code = code.trim();

        if (code && code.length >= minCodeLength) {
          return code;
        }

        // Empty response, try next model
        console.warn(`   ⚠️ Model ${response.model || 'unknown'} returned empty code, trying next model...`);
        if (response.model) {
          failedModels.push(response.model);
        }
      } catch (error) {
        console.error(`   ❌ Model attempt ${attempt + 1} failed:`, error.message.substring(0, 100));
        const errorMessage = String(error.message || '');
        if (errorMessage.match(/model\s+[`']?([\w\-\/]+)[`']?/i)) {
          const modelMatch = errorMessage.match(/model\s+[`']?([\w\-\/]+)[`']?/i);
          if (modelMatch && !failedModels.includes(modelMatch[1])) {
            failedModels.push(modelMatch[1]);
          }
        }
        if (attempt < maxModelRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw new Error(`Failed to generate code after ${maxModelRetries} model attempts`);
  }

  /**
   * Generate server.js code
   */
  async generateServerCode(appPlan) {
    const userPrompt = `Generate a complete, production-ready Express.js server.

App Name: ${appPlan.appName}
API Endpoints: ${JSON.stringify(appPlan.apiEndpoints || [])}
Data Models: ${JSON.stringify(appPlan.dataModels?.map(m => m.name) || [])}

Requirements:
1. Include proper error handling middleware
2. Add request validation
3. Include CORS configuration
4. Add MongoDB connection with error handling
5. Include all route imports
6. Add environment variable support
7. Include proper logging
8. Add security best practices

Return ONLY the complete server.js code. No explanations.`;

    return await this.generateCodeWithFallback(
      v0Prompts.apiSystemPrompt,
      userPrompt,
      { maxTokens: 2048, temperature: 0.4, minLength: 100 } // Reduced from 3072
    );
  }

  /**
   * Generate model code
   */
  async generateModelCode(model, appPlan) {
    const prompt = `Generate a Mongoose model for: ${model.name}

Fields: ${JSON.stringify(model.fields || [])}
App Context: ${appPlan.appName}

Include validation, indexes if needed. Return ONLY the Mongoose model code.`;

    return await this.generateCodeWithFallback(
      'You are an expert MongoDB/Mongoose developer.',
      prompt,
      { maxTokens: 1024, temperature: 0.5, minLength: 50 }
    );
  }

  /**
   * Generate routes code
   */
  async generateRoutesCode(appPlan) {
    const endpoints = appPlan.apiEndpoints || [];
    let routesCode = `const express = require('express');\nconst router = express.Router();\n\n`;

    for (const endpoint of endpoints) {
      const method = (endpoint.method || 'get').toLowerCase();
      const path = endpoint.path || endpoint;
      routesCode += `router.${method}('${path}', async (req, res) => {\n  // TODO: Implement\n  res.json({ message: '${path} endpoint' });\n});\n\n`;
    }

    routesCode += `module.exports = router;`;
    return routesCode;
  }

  /**
   * Generate controller code
   */
  async generateControllerCode(endpoint, appPlan) {
    const prompt = `Generate an Express controller for:

Method: ${endpoint.method || 'GET'}
Path: ${endpoint.path}
Description: ${endpoint.description || 'API endpoint'}

Include error handling and proper responses. Return ONLY the controller code.`;

    return await this.generateCodeWithFallback(
      'You are an expert Express.js developer.',
      prompt,
      { maxTokens: 2048, temperature: 0.4, minLength: 50 }
    );
  }

  /**
   * Generate tests
   */
  async generateTests(appPlan, frontendCode, backendCode) {
    const unitTests = [];
    const integrationTests = [];

    // Generate frontend tests
    for (const component of appPlan.components || []) {
      const testCode = await this.generateComponentTest(component, appPlan);
      unitTests.push({
        path: `src/components/__tests__/${component.name || component}.test.js`,
        content: testCode,
        status: 'pending'
      });
    }

    // Generate backend tests
    for (const endpoint of appPlan.apiEndpoints || []) {
      const testCode = await this.generateAPITest(endpoint, appPlan);
      integrationTests.push({
        path: `tests/api/${endpoint.name || endpoint.path}.test.js`,
        content: testCode,
        status: 'pending'
      });
    }

    return {
      unitTests,
      integrationTests
    };
  }

  /**
   * Generate component test
   */
  async generateComponentTest(component, appPlan) {
    const userPrompt = `Generate comprehensive Jest/React Testing Library tests for component: ${component.name || component}

Component Context:
- App: ${appPlan.appName}
- Component Type: ${component.type || 'component'}
- Description: ${component.description || 'React component'}

Test Requirements:
1. Test component renders correctly
2. Test user interactions (clicks, inputs, etc.)
3. Test props handling
4. Test error states if applicable
5. Test loading states if applicable
6. Test accessibility features
7. Test edge cases

Return ONLY the complete test code. No explanations.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: v0Prompts.testSystemPrompt },
      { role: 'user', content: userPrompt }
    ], null, { maxTokens: 1024, temperature: 0.4 }); // Reduced from 2048 to 1024 for tests

    let code = response.content;
    const codeMatch = code.match(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }

  /**
   * Generate API test
   */
  async generateAPITest(endpoint, appPlan) {
    const prompt = `Generate a Jest/Supertest test for API endpoint:

Method: ${endpoint.method || 'GET'}
Path: ${endpoint.path}

Include tests for success cases and error cases. Return ONLY the test code.`;

    const response = await this.groqService.chatCompletion([
      { role: 'system', content: 'You are an expert in API testing.' },
      { role: 'user', content: prompt }
    ], null, { maxTokens: 1024, temperature: 0.5 }); // null = use default with auto-fallback

    let code = response.content;
    const codeMatch = code.match(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      code = codeMatch[1];
    }

    return code.trim();
  }

  /**
   * Generate config files
   */
  async generateConfig(appPlan, appType) {
    return {
      packageJson: {
        frontend: {
          name: appPlan.appName.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0'
        },
        backend: {
          name: `${appPlan.appName.toLowerCase().replace(/\s+/g, '-')}-backend`,
          version: '1.0.0'
        }
      },
      buildConfig: {
        reactScripts: true,
        type: appType
      }
    };
  }

  /**
   * Generate index.jsx file
   */
  generateIndexFile(appPlan) {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  /**
   * Create zip file of generated app
   */
  async createAppZip(generatedApp, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve(outputPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add frontend files
      if (generatedApp.frontend?.structure) {
        for (const file of generatedApp.frontend.structure) {
          archive.append(file.content, { name: `frontend/${file.path}` });
        }
      }

      // Add backend files
      if (generatedApp.backend?.structure) {
        for (const file of generatedApp.backend.structure) {
          archive.append(file.content, { name: `backend/${file.path}` });
        }
      }

      // Add package.json files
      if (generatedApp.frontend?.dependencies) {
        archive.append(JSON.stringify({
          name: generatedApp.appPlan.appName.toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          private: true,
          dependencies: generatedApp.frontend.dependencies,
          scripts: {
            start: 'react-scripts start',
            build: 'react-scripts build',
            test: 'react-scripts test'
          }
        }, null, 2), { name: 'frontend/package.json' });
      }

      if (generatedApp.backend?.dependencies) {
        archive.append(JSON.stringify({
          name: `${generatedApp.appPlan.appName.toLowerCase().replace(/\s+/g, '-')}-backend`,
          version: '1.0.0',
          main: 'server.js',
          dependencies: generatedApp.backend.dependencies,
          scripts: {
            start: 'node server.js',
            dev: 'nodemon server.js'
          }
        }, null, 2), { name: 'backend/package.json' });
      }

      archive.finalize();
    });
  }

  static create(apiKey) {
    return new AppGeneratorService(apiKey);
  }
}

module.exports = AppGeneratorService;

