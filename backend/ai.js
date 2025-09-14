import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ================= Suggest Subtasks =================
export async function handleAiSuggest(title) {
  const res = await fetch("http://localhost:8000/ai/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });

  const text = await res.text();
  return safeJson(text, { subtasks: [], estimated_duration: null, priority: null });
}


// ================= Reminder Suggestions =================
export async function handleAiReminder(title, deadline) {
  try {
    const currentTime = new Date().toISOString();
    const deadlineTime = deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h from now if no deadline
    
    const prompt = `
    TASK: "${title}"
    DEADLINE: "${deadlineTime}"
    CURRENT TIME: "${currentTime}"
    
    Create 3 helpful reminders with specific times. Format each as "Reminder X: [message] by [YYYY-MM-DDTHH:MM]"
    
    Respond ONLY with JSON:
    { 
      "reminders": [
        "Reminder 1: Start preparing by ${new Date(new Date(deadlineTime).getTime() - 60*60*1000).toISOString().slice(0,16)}",
        "Reminder 2: Begin task by ${new Date(new Date(deadlineTime).getTime() - 30*60*1000).toISOString().slice(0,16)}",
        "Reminder 3: Final reminder by ${new Date(new Date(deadlineTime).getTime() - 5*60*1000).toISOString().slice(0,16)}"
      ]
    }
    `;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return safeJson(text, { reminders: [] });
  } catch (err) {
    console.error("Gemini Reminder Error:", err);
    return { reminders: [] };
  }
}

// ================= Productivity Tips =================
const tipsCache = {}; // store tips by task title

export async function handleAiTips(title) {
  // Return cached tips if available
  if (tipsCache[title]) {
    return tipsCache[title];
  }

  const prompt = `You are a productivity coach.
Given the task: "${title}", suggest 3 short productivity tips.

Respond ONLY with JSON:
{ "tips": ["...", "...", "..."] }`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = safeJson(text, { tips: [] });

    // Cache tips for this title
    tipsCache[title] = parsed;
    return parsed;
  } catch (err) {
    console.error("Gemini Tips Error:", err);
    return { tips: [] };
  }
}


// ================= Safe JSON Parser =================
function safeJson(text, fallback) {
  try {
    // Direct parse attempt
    return JSON.parse(text);
  } catch {
    // Extract the first valid JSON block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}
