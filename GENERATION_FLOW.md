# App Generation Flow & Logs

## Where to See Logs

### 1. Backend Terminal (PRIMARY LOCATION)
The backend terminal is a **separate Terminal/command prompt window** (not in browser).

**How to find it:**
- Look for a terminal window showing: `🚀 Vibecoders API server running on port 8000`
- On macOS: Check your Dock for Terminal/iTerm
- Press `Cmd+Tab` to cycle through windows

**What you'll see:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 STARTING APP GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📝 Prompt: Create a todo app
   📱 App Type: web

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STEP 1: GENERATING APP PLAN (BLUEPRINT/INSTRUCTIONS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   This creates the technical blueprint/instructions with:
   - App structure (pages, components)
   - API endpoints and data models
   - Dependencies and tech stack
   - Feature list and requirements

   🔄 Calling Groq API to generate app plan...
   📤 Request: JSON structure with app blueprint
   ⏳ Waiting for Groq response...
   ✅ Received response from Groq API
   🤖 Model used: llama-3.3-70b-versatile
   📊 Response size: 1234 characters
   📈 Tokens used: 456
   🔍 Parsing JSON blueprint...
```

### 2. Log File (if enabled)
- Location: `backend/logs.txt`
- View: `tail -f backend/logs.txt`

---

## Generation Flow Explained

### STEP 1: App Plan (Blueprint/Instructions) ⭐ THIS IS THE BLUEPRINT
**What happens:**
1. User enters a prompt (e.g., "Create a todo app")
2. System calls Groq API with system prompt asking for a JSON blueprint
3. Groq returns a structured JSON plan with:
   - `appName`: Name of the app
   - `features`: List of main features
   - `components`: Array of React components needed
   - `pages`: Array of pages/routes
   - `apiEndpoints`: Array of API endpoints (GET, POST, etc.)
   - `dataModels`: Array of database models
   - `dependencies`: NPM packages needed
   - `techStack`: Technologies to use

**This is the INSTRUCTIONS/BLUEPRINT that guides all subsequent generation.**

**Logs show:**
- Which Groq model was used
- Token usage
- Parsed blueprint details (pages, components, APIs)

---

### STEP 2: Frontend Code Generation
**What happens:**
1. System uses the plan from Step 1
2. For each component/page in the plan:
   - Calls Groq API with component-specific prompt
   - Generates React component code
   - Adds to structure array: `{path, content, type}`

**Generated files:**
- `src/App.jsx` - Main app component with routing
- `src/pages/PageName.jsx` - Individual pages
- `src/components/ComponentName.jsx` - Reusable components
- `src/index.jsx` - Entry point

**Logs show:**
- Which components are being generated
- Groq API calls for each component
- File paths and sizes

---

### STEP 3: Backend Code Generation
**What happens:**
1. System uses API endpoints and data models from Step 1 plan
2. Generates:
   - `server.js` - Express server setup
   - `models/ModelName.js` - Mongoose models
   - `routes/routeName.js` - API routes
   - `controllers/controllerName.js` - Route handlers

**Logs show:**
- API endpoints being generated
- Data models being created
- File paths and sizes

---

### STEP 4: Tests Generation
**What happens:**
1. Generates Jest unit tests for each React component
2. Generates Jest integration tests for each API endpoint

**Logs show:**
- Number of unit tests
- Number of integration tests

---

### STEP 5: Configuration Files
**What happens:**
1. Generates `package.json` for frontend and backend
2. Generates `.env` files with environment variables
3. Sets up dependencies from Step 1 plan

---

## What Gets "Regenerated" (Refinement)

When you click "✨ Refine App", the system can:

1. **Full Regeneration** (default):
   - Regenerates Step 1 (plan) - creates NEW blueprint
   - Regenerates Steps 2-5 based on NEW plan
   - **This is why you see "refining"** - it's recreating everything with your new prompt

2. **Targeted Refinement** (if you select a specific component):
   - Only regenerates that specific component
   - Keeps everything else the same

---

## Understanding the Logs

### Groq API Communication
Every time you see:
```
🔄 Calling Groq API...
📤 Request: ...
⏳ Waiting for Groq response...
✅ Received response from Groq API
🤖 Model used: llama-3.3-70b-versatile
📈 Tokens used: 456
```

This is **one Groq API call**. The generation process makes **multiple calls**:
- 1 call for app plan (Step 1)
- 1 call per component/page (Step 2)
- 1 call per API endpoint/model (Step 3)
- 1 call per test file (Step 4)

### Model Switching
If you see:
```
❌ Model llama-3.3-70b-versatile failed
🔄 Switching from llama-3.3-70b-versatile to llama-3.1-8b-instant
```

The system is automatically trying different models when one fails (rate limits, errors, etc.).

---

## Troubleshooting

If you see empty responses:
- Check the backend terminal for detailed error messages
- Look for rate limit errors
- Check which models were tried and why they failed

If generation fails:
- The logs will show exactly which step failed
- Check Groq API key validity
- Check Groq API quota/limits

