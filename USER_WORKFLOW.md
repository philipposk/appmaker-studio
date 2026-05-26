# User Workflow & System Timeline

## Complete User Journey

### Step 1: Create App (Frontend)
**User Action:**
- Navigates to `/apps/create` or clicks "Create App" from Dashboard
- Fills out form:
  - App Name (e.g., "My Todo App")
  - Description (e.g., "A todo app with drag-and-drop")
  - App Type (Web, Mobile, API, Integration)
  - Optional: Groq API Key

**Frontend Timeline:**
```
User submits form
  ↓
dispatch(createApp(appData))
  ↓
POST /api/apps → Backend
  ↓
Receives app object with _id
  ↓
Navigate to /apps/{app._id}/builder
```

**Backend Timeline:**
```
POST /api/apps
  ↓
Auth middleware checks JWT token
  ↓
Creates App document in MongoDB:
  - name, description, type
  - owner: user._id
  - status: 'draft'
  - generatedCode: null (not generated yet)
  ↓
Returns app object to frontend
```

**Result:** Empty app record created. User is now in App Builder.

---

### Step 2: Generate App Code (AI Prompt Tab)
**User Action:**
- In App Builder, on "AI Prompt" tab
- Enters natural language description:
  ```
  "Create a todo app with:
  - User authentication
  - Drag-and-drop reordering
  - Calendar view
  - Search functionality
  - Dark mode toggle"
  ```
- Clicks "Generate App"

**Frontend Timeline:**
```
User clicks "Generate App"
  ↓
dispatch(generateApp({ prompt, appType, groqAPIKey }))
  ↓
POST /api/generate/generate
  ↓
Shows loading spinner: "Generating..."
  ↓
Waits for response (can take 30-60 seconds)
  ↓
On success:
  - Navigate to /apps/{app._id}/builder
  - All tabs become available (Visual, Workflow, Code, Tests, Preview, Deploy)
```

**Backend Timeline:**
```
POST /api/generate/generate
  ↓
Auth middleware checks JWT
  ↓
Creates AppGeneratorService instance with Groq API key
  ↓
Step 1: Generate App Plan (AI)
  - Calls Groq API with system prompt
  - Gets JSON structure: { appName, features, components, pages, apiEndpoints, dataModels, dependencies }
  ↓
Step 2: Generate Frontend Code (AI)
  - For each component/page:
    - Generates React component code
    - Includes proper imports, hooks, styling
    - Adds error handling, loading states
  - Creates file structure array
  ↓
Step 3: Generate Backend Code (AI)
  - Generates Express server code
  - Creates Mongoose models
  - Creates routes and controllers
  - Generates API endpoints
  ↓
Step 4: Generate Tests (AI)
  - Unit tests for components (Jest + React Testing Library)
  - Integration tests for API (Jest + Supertest)
  - Test files stored in structure
  ↓
Step 5: Generate Config Files
  - package.json files
  - Build configuration
  ↓
Creates/Updates App document in MongoDB:
  - generatedCode: {
      frontend: { structure: [...], dependencies: {...} },
      backend: { structure: [...], dependencies: {...} },
      config: {...}
    }
  - tests: {
      unitTests: [...],
      integrationTests: [...]
    }
  - generation: {
      prompt: "...",
      iterations: [{ prompt, generatedAt }],
      lastGenerated: new Date(),
      model: 'mixtral-8x7b-32768'
    }
  - status: 'draft'
  ↓
Returns app object to frontend
```

**Result:** Complete app code generated and stored. User can now:
- Edit visually (Visual Editor)
- View workflow (Workflow Editor)
- Edit code (Code Editor)
- Run tests (Test Runner)
- Preview app (Live Preview)
- Deploy app (Deployment Panel)

---

### Step 3: Refine/Iterate (Optional)
**User Action:**
- Goes back to "AI Prompt" tab
- Chooses refinement type:
  - Full App Regeneration (regenerates everything)
  - Update Specific Component (incremental)
  - Update Styling (incremental)
  - Fix Bug (incremental)
  - Add Feature (incremental)
- If incremental, enters target component name (e.g., "TodoList")
- Enters refinement prompt: "Add a delete button to each todo item"
- Clicks "Refine App"

**Frontend Timeline:**
```
User clicks "Refine App"
  ↓
dispatch(refineApp({
  id: app._id,
  prompt: "...",
  targetType: "feature", // or "component", "styling", "bug"
  targetComponent: "TodoList"
}))
  ↓
POST /api/generate/refine/{app._id}
  ↓
Shows loading: "Refining..."
  ↓
On success:
  - Refreshes app data
  - Updates all editors with new code
```

**Backend Timeline:**
```
POST /api/generate/refine/{app._id}
  ↓
Loads app from database
  ↓
Checks if incremental update:
  - If targetComponent provided:
    ↓
    Creates IncrementalUpdateService instance
    ↓
    Finds component in app.generatedCode.frontend.structure
    ↓
    Calls Groq API with:
      - Existing component code
      - Refinement request
      - App context
    ↓
    Gets updated component code
    ↓
    Updates ONLY that component file
    ↓
    Preserves all other code
  - If full regeneration:
    ↓
    Calls AppGeneratorService.generateApp()
    ↓
    Regenerates entire app
    ↓
    Updates all code
  ↓
Adds new iteration to generation.iterations array
  ↓
Updates app in MongoDB
  ↓
Returns updated app
```

**Result:** Code updated. Other tabs refresh with new code.

---

### Step 4: Run Tests (Optional)
**User Action:**
- Goes to "Tests" tab
- Clicks "Run Tests" button
- Selects test type: All, Unit Tests, or Integration Tests

**Frontend Timeline:**
```
User clicks "Run Tests"
  ↓
dispatch(runTests({ appId, testType: 'all' }))
  ↓
POST /api/apps/{app._id}/tests/run
  ↓
Shows loading: "Running tests..."
  ↓
Waits for response
  ↓
Displays results:
  - Total: 15
  - Passed: 12
  - Failed: 3
  - Skipped: 0
  - Failed test details with error messages
```

**Backend Timeline:**
```
POST /api/apps/{app._id}/tests/run
  ↓
Loads app from database
  ↓
Creates TestRunnerService instance
  ↓
Creates temporary directory: backend/temp/{app._id}
  ↓
Writes all test files to temp directory:
  - Unit tests: src/__tests__/components/*.test.jsx
  - Integration tests: src/__tests__/api/*.test.js
  ↓
Writes package.json with Jest configuration
  ↓
Executes: cd temp/{app._id} && npm install && npm test -- --json
  ↓
Parses Jest JSON output:
  - Extracts test results
  - Identifies passed/failed/skipped tests
  - Captures error messages
  ↓
Cleans up temp directory
  ↓
Returns structured results:
  {
    success: true,
    total: 15,
    passed: 12,
    failed: 3,
    skipped: 0,
    tests: [
      { name: "TodoList renders correctly", status: "passed" },
      { name: "Add todo works", status: "failed", error: "..." }
    ]
  }
```

**Result:** User sees test results. Can fix issues and regenerate.

---

### Step 5: Preview (Optional)
**User Action:**
- Goes to "Preview" tab
- Sees live preview of the generated app

**Frontend Timeline:**
```
User clicks "Preview" tab
  ↓
LivePreview component renders
  ↓
Reads app.generatedCode.frontend.structure
  ↓
Renders components in iframe or embedded preview
  ↓
User can interact with preview
```

**Backend Timeline:**
```
(None - preview is client-side rendering)
```

**Result:** User sees how app looks/works before deploying.

---

### Step 6: Deploy or Download

#### Option A: Download ZIP
**User Action:**
- Goes to "Deploy" tab
- Clicks "Download ZIP" button

**Frontend Timeline:**
```
User clicks "Download ZIP"
  ↓
dispatch(downloadApp(app._id))
  ↓
GET /api/generate/{app._id}/download
  ↓
Response is a blob (ZIP file)
  ↓
Creates temporary download link
  ↓
Triggers browser download
  ↓
ZIP file downloads to user's computer
```

**Backend Timeline:**
```
GET /api/generate/{app._id}/download
  ↓
Loads app from database
  ↓
Creates AppGeneratorService instance
  ↓
Calls createAppZip(appData, zipPath)
  ↓
Creates ZIP archive with structure:
  frontend/
    src/
      App.jsx
      components/
        TodoList.jsx
        Header.jsx
        ...
      __tests__/
        TodoList.test.jsx
        ...
    package.json
    public/
      index.html
  backend/
    server.js
    models/
      Todo.js
    routes/
      todos.js
    package.json
  README.md
  ↓
Creates download response
  ↓
Sends ZIP file to frontend
  ↓
After download, deletes temp ZIP file
```

**What User Does With ZIP:**
1. **Extract ZIP** to a folder
2. **Open terminal** in extracted folder
3. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   cd ../backend
   npm install
   ```
4. **Set up environment:**
   - Create `.env` file in backend
   - Add MongoDB URI, JWT secret, etc.
5. **Run locally:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start
   
   # Terminal 2 - Frontend
   cd frontend
   npm start
   ```
6. **Use it:**
   - Own the code completely
   - Modify as needed
   - Deploy to own server
   - Put on GitHub
   - Share with team

#### Option B: Deploy to Vercel/Netlify
**User Action:**
- Goes to "Deploy" tab
- Selects platform: Vercel or Netlify
- If Vercel:
  - Enters Vercel API token (prompted)
  - Clicks "Deploy"
- If Netlify:
  - Enters Netlify API token (prompted)
  - Enters Netlify Site ID (prompted)
  - Clicks "Deploy"

**Frontend Timeline:**
```
User clicks "Deploy"
  ↓
Prompts for API token (Vercel) or token + site ID (Netlify)
  ↓
dispatch(deployApp({
  appId: app._id,
  platform: 'vercel',
  vercelToken: '...'
}))
  ↓
POST /api/apps/{app._id}/deploy
  ↓
Shows loading: "Deploying..."
  ↓
Waits for response
  ↓
On success:
  - Shows deployment URL
  - Updates app deployment status
```

**Backend Timeline:**
```
POST /api/apps/{app._id}/deploy
  ↓
Loads app from database
  ↓
Updates app.deployment.status = 'building'
  ↓
Creates DeploymentService instance
  ↓
Calls createDeploymentPackage(app):
  - Creates ZIP file with frontend + backend code
  - Adds package.json files
  - Adds README.md
  ↓
If Vercel:
  - Reads ZIP file buffer
  - Creates FormData with ZIP
  - POST to https://api.vercel.com/v13/deployments
  - Includes project settings
  - Sends Authorization: Bearer {token}
  ↓
If Netlify:
  - Reads ZIP file buffer
  - POST to https://api.netlify.com/api/v1/sites/{siteId}/deploys
  - Sends ZIP as binary
  - Sends Authorization: Bearer {token}
  ↓
Receives deployment response:
  - deploymentId
  - URL (e.g., https://my-todo-app.vercel.app)
  ↓
Updates app in MongoDB:
  - deployment.status = 'deployed'
  - deployment.url = 'https://...'
  - deployment.buildId = 'deployment-id'
  - deployment.platform = 'vercel' or 'netlify'
  - deployment.deployedAt = new Date()
  ↓
Cleans up temp ZIP file
  ↓
Returns deployment info to frontend
```

**Result:** App is live on Vercel/Netlify. User gets a URL they can share.

---

## Complete Timeline Diagram

```
USER                            FRONTEND                              BACKEND                              DATABASE
 │                                │                                      │                                      │
 ├─ Create App                    │                                      │                                      │
 │  (fill form)                   │                                      │                                      │
 │                                ├─ POST /api/apps                     ├─ Auth check                         │
 │                                │                                      ├─ Create App document                │
 │                                │                                      │                                      ├─ Insert app
 │                                │                                      ├─ Return app object                  │
 │                                ├─ Navigate to /apps/{id}/builder      │                                      │
 │                                │                                      │                                      │
 ├─ Generate Code                 │                                      │                                      │
 │  (enter prompt)                │                                      │                                      │
 │                                ├─ POST /api/generate/generate         ├─ Create AppGeneratorService         │
 │                                │                                      ├─ Generate App Plan (AI)            │
 │                                │                                      ├─ Generate Frontend (AI)            │
 │                                │                                      ├─ Generate Backend (AI)             │
 │                                │                                      ├─ Generate Tests (AI)               │
 │                                │                                      ├─ Update App document                │
 │                                │                                      │                                      ├─ Update app with code
 │                                ├─ Receive app with code               │                                      │
 │                                ├─ Enable all tabs                     │                                      │
 │                                │                                      │                                      │
 ├─ Refine Code (optional)        │                                      │                                      │
 │  (incremental update)          │                                      │                                      │
 │                                ├─ POST /api/generate/refine/{id}      ├─ Load app                           │
 │                                │                                      ├─ IncrementalUpdateService          │
 │                                │                                      │  (update one component)             │
 │                                │                                      ├─ Update App document                │
 │                                │                                      │                                      ├─ Update app.code
 │                                ├─ Receive updated app                 │                                      │
 │                                │                                      │                                      │
 ├─ Run Tests (optional)          │                                      │                                      │
 │  (click Run Tests)             │                                      │                                      │
 │                                ├─ POST /api/apps/{id}/tests/run       ├─ Load app                           │
 │                                │                                      ├─ Create temp directory              │
 │                                │                                      ├─ Write test files                   │
 │                                │                                      ├─ Execute: npm test                  │
 │                                │                                      ├─ Parse Jest output                  │
 │                                │                                      ├─ Cleanup temp files                │
 │                                ├─ Display test results                │                                      │
 │                                │                                      │                                      │
 ├─ Preview (optional)            │                                      │                                      │
 │  (view in Preview tab)         ├─ Render in iframe                    │                                      │
 │                                │  (client-side)                       │                                      │
 │                                │                                      │                                      │
 ├─ Download ZIP                  │                                      │                                      │
 │  (click Download)              │                                      │                                      │
 │                                ├─ GET /api/generate/{id}/download     ├─ Load app                           │
 │                                │                                      ├─ CreateAppZip()                     │
 │                                │                                      │  (frontend + backend files)          │
 │                                ├─ Download ZIP file                   ├─ Send ZIP file                      │
 │                                │                                      ├─ Delete temp file                   │
 │                                │                                      │                                      │
 │  Extract ZIP →                 │                                      │                                      │
 │  npm install →                 │                                      │                                      │
 │  npm start                     │                                      │                                      │
 │                                │                                      │                                      │
 ├─ Deploy to Vercel              │                                      │                                      │
 │  (enter token, click Deploy)   │                                      │                                      │
 │                                ├─ POST /api/apps/{id}/deploy          ├─ Load app                           │
 │                                │                                      ├─ CreateDeploymentPackage()          │
 │                                │                                      ├─ POST to Vercel API                 │
 │                                │                                      │  (upload ZIP)                       │
 │                                │                                      ├─ Update app.deployment              │
 │                                │                                      │                                      ├─ Update deployment status
 │                                ├─ Receive deployment URL              │                                      │
 │                                │                                      │                                      │
 └─ App is LIVE!                  │                                      │                                      │
    (share URL)                   │                                      │                                      │
```

---

## ZIP File Contents

When user downloads the ZIP, they get a complete, standalone application:

```
my-todo-app.zip
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 (Main app component)
│   │   ├── index.jsx               (Entry point)
│   │   ├── index.css               (Styles)
│   │   ├── components/
│   │   │   ├── TodoList.jsx
│   │   │   ├── TodoItem.jsx
│   │   │   ├── Header.jsx
│   │   │   └── Calendar.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── Profile.jsx
│   │   ├── services/
│   │   │   └── api.js              (API calls)
│   │   └── __tests__/
│   │       ├── TodoList.test.jsx
│   │       └── TodoItem.test.jsx
│   ├── public/
│   │   └── index.html
│   └── package.json                (Dependencies: react, axios, etc.)
│
├── backend/
│   ├── server.js                   (Express server)
│   ├── models/
│   │   ├── Todo.js                 (Mongoose models)
│   │   └── User.js
│   ├── routes/
│   │   ├── todos.js
│   │   └── auth.js
│   ├── controllers/
│   │   ├── todoController.js
│   │   └── authController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── __tests__/
│   │   └── todos.test.js
│   ├── .env.example                (Environment variables template)
│   └── package.json                (Dependencies: express, mongoose, etc.)
│
└── README.md                        (Setup instructions)
```

**User can:**
- Unzip it
- Install dependencies (`npm install` in frontend and backend)
- Set up `.env` file
- Run `npm start` in both folders
- Have a fully working app on their machine
- Modify any code
- Deploy to their own infrastructure
- Put on GitHub
- Use as a starting point for their own project

---

## Key Points

1. **Everything is stored in MongoDB** - All generated code, tests, deployment info
2. **AI generation happens server-side** - Frontend just sends prompts
3. **Incremental updates are faster** - Only regenerate specific components
4. **Tests run server-side** - In isolated temp directories
5. **ZIP is standalone** - Users own it completely
6. **Deployment uses platform APIs** - Real deployments to Vercel/Netlify
7. **Users can iterate** - Generate → Refine → Test → Deploy → Repeat

