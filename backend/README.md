QuickTasks AI — Fullstack (vanilla frontend + Node backend with AI)
------------------------------------------------------------------

How to run backend:
1. In backend/ directory, set environment variable OPENAI_API_KEY to your OpenAI API key.
   - Windows PowerShell: $env:OPENAI_API_KEY='sk-...'
   - macOS / Linux: export OPENAI_API_KEY='sk-...'

2. Install dependencies and start server:
   npm install
   npm start
   Server runs at http://localhost:5000

API endpoints:
- GET    /api/tasks
- POST   /api/tasks
- PUT    /api/tasks/:id
- DELETE /api/tasks/:id
- POST   /api/ai/suggest   body: { title: "task title" }  -> returns { subtasks, estimated_duration, priority }

Frontend:
- Open frontend/index.html via a static server (recommended) or use `npx serve .` in frontend/ and open http://localhost:3000
- Frontend communicates with backend at http://localhost:5000