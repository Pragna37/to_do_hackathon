import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from "node-cron";
import { Server } from "socket.io";
import http from 'http';
import { handleAiSuggest, handleAiReminder, handleAiTips } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'tasks.json');

app.use(cors());
app.use(bodyParser.json());

// ---------- Helper functions ----------
function loadTasks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

// ================== CRUD Endpoints ==================
app.get('/api/tasks', (req, res) => {
  res.json(loadTasks());
});

app.post('/api/tasks', (req, res) => {
  const { title, description, duration, deadline, urgent } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const task = {
    id: uuidv4(),
    title,
    description: description || '',
    duration: duration || 0,
    deadline: deadline || null,
    urgent: !!urgent,
    completed: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks[idx] = { ...tasks[idx], ...req.body, updatedAt: Date.now() };
  saveTasks(tasks);
  res.json(tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const deleted = tasks[idx];
  tasks = tasks.filter(t => t.id !== req.params.id);
  saveTasks(tasks);
  res.json(deleted);
});

// ================== AI Routes ==================
app.post('/api/ai/suggest', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const aiResult = await handleAiSuggest(title);
    res.json(aiResult);
  } catch (err) {
    console.error('AI error', err);
    res.status(500).json({ error: 'AI suggestion failed' });
  }
});

app.post('/api/ai/reminder', async (req, res) => {
  const { title, deadline } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const reminders = await handleAiReminder(title, deadline);
    res.json(reminders);
  } catch (err) {
    console.error('AI reminder error', err);
    res.status(500).json({ error: 'AI reminder failed' });
  }
});

app.post('/api/ai/tips', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const tips = await handleAiTips(title);
    res.json(tips);
  } catch (err) {
    console.error('AI tips error', err);
    res.status(500).json({ error: 'AI tips failed' });
  }
});

// ================== CRON / Push Reminders ==================
cron.schedule("* * * * *", async () => {
  const tasks = loadTasks();
  const now = Date.now();

  for (const task of tasks) {
    if (!task.deadline) continue;

    const deadline = new Date(task.deadline).getTime();
    const timeLeft = deadline - now;

    // Only send overdue reminders for incomplete tasks
    if (timeLeft < 0 && !task.completed) {
      const ai = await handleAiReminder(task.title, task.deadline);
      io.emit("reminder", { task: task.title, ai });
    }
  }
});

// ================== Socket.IO Connection ==================
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
});

// ================== Start Server ==================
server.listen(PORT, () => console.log(`✅ Backend running at http://localhost:${PORT}`));
