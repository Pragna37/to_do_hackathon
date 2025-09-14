// Connect to server
const socket = io("http://localhost:5000");

// Listen for AI reminders in real-time
socket.on("reminder", ({ task, ai }) => {
  const remindersList = ai.reminders?.reminders || ai.reminders || [];
  remindersList.forEach(r => {
    let msg = typeof r === "string" ? r : r.message || JSON.stringify(r);
    alert(`⚠️ Reminder for "${task}": ${msg}`);
  });
});


document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = "http://localhost:5000/api";
  const TASKS_URL = API_BASE + "/tasks";
  const AI_SUGGEST_URL = API_BASE + "/ai/suggest";
  const AI_REMINDER_URL = API_BASE + "/ai/reminder";
  const AI_TIPS_URL = API_BASE + "/ai/tips";

  const form = document.getElementById('taskForm');
  const title = document.getElementById('title');
  const description = document.getElementById('description');
  const duration = document.getElementById('duration');
  const deadlineInput = document.getElementById('deadline');
  const deadlineTimeInput = document.getElementById('deadlineTime');
  const urgent = document.getElementById('urgent');
  const taskList = document.getElementById('taskList');
  const taskIdField = document.getElementById('taskId');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const search = document.getElementById('search');
  const filterStatus = document.getElementById('filterStatus');
  const toast = document.getElementById('toast');
  const aiOutput = document.getElementById('aiOutput');
  const aiSuggestBtn = document.getElementById('aiSuggestBtn');
  const aiReminderBtn = document.getElementById('aiReminderBtn');
  const aiTipsBtn = document.getElementById('aiTipsBtn');
  const suggestBtn = document.getElementById('suggestBtn');
  const resetSuggestBtn = document.getElementById('resetSuggest');

  let tasks = [];
  let remindingTasks = new Set();
  let showingSuggested = false;

  // --- API helpers ---
  const apiGet = async () => (await fetch(TASKS_URL)).json();
  const apiPost = async (body) => (await fetch(TASKS_URL, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)})).json();
  const apiPut = async (id, body) => (await fetch(`${TASKS_URL}/${id}`, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)})).json();
  const apiDelete = async (id) => (await fetch(`${TASKS_URL}/${id}`, {method:"DELETE"})).json();
  const apiAiSuggest = async (t) => (await fetch(AI_SUGGEST_URL,{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:t})})).json();
  const apiAiReminder = async (t,d) => (await fetch(AI_REMINDER_URL,{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:t, deadline:d})})).json();
  const apiAiTips = async (t) => (await fetch(AI_TIPS_URL,{method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:t})})).json();

  // --- Utility functions ---
  const escapeHtml = s => s ? s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') : '';
  const daysUntil = d => !d ? Infinity : Math.ceil((new Date(d+"T00:00:00") - new Date())/(1000*60*60*24));

  const showToast = msg => {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(()=>toast.classList.add('hidden'), 2500);
  };

  // Enhanced toast for reminders (longer duration)
  const showReminderToast = msg => {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    // Longer duration for reminders so users don't miss them
    setTimeout(()=>toast.classList.add('hidden'), 5000);
  };

  const sortTasks = arr => arr.slice().sort((a,b)=>{
    const aD = a.deadline || '9999-12-31';
    const bD = b.deadline || '9999-12-31';
    if(aD !== bD) return new Date(aD)-new Date(bD);
    if(a.urgent !== b.urgent) return a.urgent?-1:1;
    if(a.completed !== b.completed) return a.completed?1:-1;
    return new Date(a.createdAt)-new Date(b.createdAt);
  });

  // --- Render ---
  const renderTasks = () => {
    let list = tasks.slice();
    const q = search.value.trim().toLowerCase();
    const status = filterStatus.value;
    if(status==='active') list = list.filter(t=>!t.completed);
    if(status==='completed') list = list.filter(t=>t.completed);
    if(q) list = list.filter(t=>(t.title+' '+(t.description||'')).toLowerCase().includes(q));
    list = sortTasks(list);
    taskList.innerHTML = '';
    if(list.length===0){ taskList.innerHTML='<li>No tasks found</li>'; return; }
    list.forEach(task=>{
      const li=document.createElement('li'); 
      li.className='task-item'+(task.completed?' completed':'');
      li.dataset.id=task.id;
      li.innerHTML=`
        <div>
          <input type="checkbox" class="toggle" ${task.completed?'checked':''}> ${escapeHtml(task.title)}
          ${task.duration?`<span class="badge">${task.duration}m</span>`:''}
          ${task.urgent?`<span class="badge">URGENT</span>`:''}
          <br>
          ${task.description?escapeHtml(task.description)+' · ':''}
          ${task.deadline?`Due: ${task.deadline}`:''}
        </div>
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      `;
      li.querySelector('.toggle').addEventListener('change',()=>toggleComplete(task));
      li.querySelector('.delete').addEventListener('click',()=>deleteTask(task.id));
      li.querySelector('.edit').addEventListener('click',()=>loadForEdit(task));
      taskList.appendChild(li);
    });
  };

  // --- CRUD ---
  const loadTasks = async () => { tasks = await apiGet(); renderTasks(); };

  const addOrUpdateTask = async e => {
    e.preventDefault();
    const id = taskIdField.value;
    const deadlineVal = deadlineInput.value ? deadlineInput.value + (deadlineTimeInput.value ? 'T'+deadlineTimeInput.value:'') : null;
    const data = {
      title: title.value.trim(),
      description: description.value.trim(),
      duration: Number(duration.value)||0,
      deadline: deadlineVal,
      urgent: urgent.checked
    };
    if(!data.title) return showToast('Title required');
    if(id){ await apiPut(id,data); showToast('Task updated'); } 
    else { await apiPost(data); showToast('Task added'); }
    resetForm(); loadTasks();
  };

  const resetForm = () => { taskIdField.value=''; form.reset(); saveBtn.textContent='Add Task'; aiOutput.innerHTML=''; showingSuggested=false; resetSuggestBtn.classList.add('hidden'); };
  const loadForEdit = t => {
    taskIdField.value=t.id;
    title.value=t.title;
    description.value=t.description||'';
    duration.value=t.duration||'';
    deadlineInput.value=t.deadline? t.deadline.split("T")[0]:'';
    deadlineTimeInput.value=t.deadline && t.deadline.includes("T") ? t.deadline.split("T")[1]:'';
    urgent.checked=!!t.urgent;
    saveBtn.textContent='Save Changes';
  };
  const deleteTask = async id => { if(!confirm('Delete this task?')) return; await apiDelete(id); loadTasks(); showToast('Task deleted'); };
  const toggleComplete = async t => { await apiPut(t.id,{completed:!t.completed}); loadTasks(); };

  // --- AI ---
  const aiSuggest = async () => {
    const t = title.value.trim(); if(!t) return showToast('Enter a title for AI suggestion');
    showToast('Asking AI...');
    try{
      const res = await apiAiSuggest(t);
      if(res.error) return showToast(res.error);
      let lines=[];
      if(res.subtasks && Array.isArray(res.subtasks)) res.subtasks.forEach((s,i)=>lines.push(`${i+1}. ${s}`));
      if(res.estimated_duration) duration.value=res.estimated_duration;
      if(res.priority){ const note=`AI-priority: ${res.priority}`; description.value = description.value ? description.value+"\n"+note : note; }
      if(lines.length) description.value = description.value ? description.value+"\nSubtasks:\n"+lines.join("\n") : "Subtasks:\n"+lines.join("\n");
      showToast('AI suggestions inserted');
    }catch(e){ console.error(e); showToast('AI failed'); }
  };

  const aiTips = async () => {
    const t = title.value.trim(); if(!t) return showToast('Enter a title for AI tips');
    showToast('Asking AI...');
    try{
      const res = await apiAiTips(t);
      if(res.error) return showToast(res.error);
      if(res.tips && res.tips.length) aiOutput.innerHTML="<ul>"+res.tips.map(t=>`<li>${t}</li>`).join("")+"</ul>";
      else aiOutput.innerHTML="<p>No tips suggested.</p>";
    }catch(e){ console.error(e); showToast('AI tips failed'); }
  };

  const aiReminder = async () => {
    const t = title.value.trim(); 
    if (!t) return showToast('Enter a title for AI reminders');

    const d = deadlineInput.value 
      ? deadlineInput.value + (deadlineTimeInput.value ? 'T' + deadlineTimeInput.value : '') 
      : null;
    
    showToast('Asking AI...');
    try {
      const res = await apiAiReminder(t, d);
      if (res.error) return showToast(res.error);

      // Handle nested reminders structure
      const remindersList = res.reminders?.reminders || res.reminders || [];

      if (remindersList && remindersList.length) {
        remindersList.forEach(r => {
          let msg, time = null;

          if (typeof r === "string") {
            // Parse string format like "Reminder 1: Start preparing your meal by 2025-09-14T15:07"
            const cleanMsg = r.replace(/^Reminder \d+:\s*/, ''); // Remove "Reminder X: " prefix
            
            // Try to extract time from the message
            const timeMatch = cleanMsg.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
            if (timeMatch) {
              time = new Date(timeMatch[1]);
              msg = cleanMsg.replace(timeMatch[0], '').replace(/\s*by\s*$/, '').trim();
            } else {
              msg = cleanMsg;
            }

            if (time && time > new Date()) {
              // Schedule toast for that future time
              const delay = time - new Date();
              setTimeout(() => {
                showReminderToast(`⏰ Scheduled Reminder: ${msg}`);
              }, delay);
              showToast(`Reminder scheduled for ${time.toLocaleTimeString()}`);
            } else {
              // Show immediately
              showReminderToast(`⏰ Reminder: ${msg}`);
            }
          } else if (typeof r === "object" && r.message) {
            msg = r.message;
            time = r.time ? new Date(r.time) : null;

            if (time && time > new Date()) {
              const delay = time - new Date();
              setTimeout(() => {
                showReminderToast(`⏰ Scheduled Reminder: ${msg}`);
              }, delay);
              showToast(`Reminder scheduled for ${time.toLocaleTimeString()}`);
            } else {
              showReminderToast(`⏰ Reminder: ${msg}`);
            }
          } else {
            msg = JSON.stringify(r);
            showReminderToast(`⏰ Reminder: ${msg}`);
          }
        });
        showToast(`Set ${remindersList.length} AI reminders`);
      } else {
        showToast('No AI reminders suggested');
      }
    } catch (e) {
      console.error(e);
      showToast('AI reminder failed');
    }
  };

  // --- Short Task Suggestions ---
  const suggestShortTasks = () => {
    showingSuggested = true;
    resetSuggestBtn.classList.remove('hidden');

    const list = tasks.filter(t => {
      if (t.completed) return false;
      const dur = Number(t.duration) || 0; 
      return dur <= 30;
    });

    taskList.innerHTML = '';
    if (list.length === 0) {
      taskList.innerHTML = '<li>No short tasks found.</li>';
      return;
    }

    list.forEach(t => {
      const li = document.createElement('li'); 
      li.className = 'task-item' + (t.completed ? ' completed' : '');
      li.innerHTML = `
        <div>
          ${escapeHtml(t.title)} (${t.duration || 0}m)
          ${t.urgent ? `<span class="badge">URGENT</span>` : ''}
        </div>
      `;
      taskList.appendChild(li);
    });
  };

  const resetSuggestions = () => { showingSuggested=false; resetSuggestBtn.classList.add('hidden'); renderTasks(); };

  const fetchAiReminder = async (task) => {
    try {
      const res = await fetch(AI_REMINDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: task.title, deadline: task.deadline })
      });
      const data = await res.json();

      if (data.reminders && data.reminders.length) {
        data.reminders.forEach(r => {
          let msg;
          if (typeof r === "string") {
            msg = r;
          } else if (typeof r === "object" && r.message) {
            msg = `${r.message} (at ${r.time || "unspecified"})`;
          } else {
            msg = JSON.stringify(r);
          }
          showReminderToast(`⚠️ Reminder for "${task.title}": ${msg}`);
        });
      }
    } catch (err) {
      console.error("AI reminder fetch failed:", err);
    }
  };

  // --- Reminders ---
  const startReminderChecker = () => {
    setInterval(() => {
      const now = new Date();

      tasks.forEach(task => {
        if (task.completed || !task.deadline) return;

        const tDeadline = new Date(task.deadline);
        const diff = tDeadline - now;

        // 10-minute warning
        if (diff <= 10*60*1000 && diff > 0 && !remindingTasks.has(task.id + "-10min")) {
          showReminderToast(`⏰ Only 10 minutes left for "${task.title}"!`);
          remindingTasks.add(task.id + "-10min");
        }

        // Missed task
        if (diff < 0 && !remindingTasks.has(task.id + "-missed")) {
          showReminderToast(`⚠️ You missed "${task.title}"!`);
          remindingTasks.add(task.id + "-missed");
        }

        // AI reminders (call once per task)
        if (!remindingTasks.has(task.id + "-ai")) {
          fetchAiReminder(task);
          remindingTasks.add(task.id + "-ai");
        }
      });
    }, 60000);
  };

  // --- Events ---
  form.addEventListener('submit', addOrUpdateTask);
  clearBtn.addEventListener('click', resetForm);
  search.addEventListener('input', renderTasks);
  filterStatus.addEventListener('change', renderTasks);
  aiTipsBtn.addEventListener('click', aiTips);
  // aiReminderBtn removed - using automatic reminders instead
  suggestBtn.addEventListener('click', suggestShortTasks);
  resetSuggestBtn.addEventListener('click', resetSuggestions);

  // --- Init ---
  loadTasks().then(() => startReminderChecker());
});


