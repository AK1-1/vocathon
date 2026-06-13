const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Optional shared-secret guard for the endpoints Bolna calls (tools + webhook).
// Only enforced when API_TOKEN is set, so local/demo use stays zero-config.
// Bolna sends the secret in the `Authorization` header (see bolna-tools.md).
const requireApiToken = (req, res, next) => {
  const expected = process.env.API_TOKEN;
  if (!expected) return next();

  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (provided === expected) return next();

  return res.status(401).json({ error: 'Unauthorized' });
};

// Broadcast helpers
const broadcastGroceries = () => io.emit('groceries_updated', db.getGroceries());
const broadcastChores = () => io.emit('chores_updated', db.getChores());
const broadcastInstructions = () => io.emit('instructions_updated', db.getInstructions());
const broadcastReminders = () => io.emit('reminders_updated', db.getReminders());
const broadcastCalls = () => io.emit('calls_updated', db.getCalls());

// ==========================================
// 1. BOLNA CUSTOM TOOLS API (AI Agent Actions)
// ==========================================

// Add grocery item
app.post('/api/groceries', requireApiToken, (req, res) => {
  const { item, quantity, category } = req.body;
  if (!item) {
    return res.status(400).json({ error: "Item name is required" });
  }
  const newItem = db.addGroceryItem(item, quantity || "1", category || "Pantry");
  broadcastGroceries();
  res.json({ status: "success", message: `Added ${newItem.quantity} of ${newItem.item}`, item: newItem });
});

// Mark grocery as bought (either by name or id)
app.post('/api/groceries/bought', requireApiToken, (req, res) => {
  const { id, item } = req.body;
  let updated = null;

  if (id) {
    updated = db.toggleGroceryBought(id);
  } else if (item) {
    updated = db.markGroceryBoughtByName(item);
  }

  if (updated) {
    broadcastGroceries();
    return res.json({ status: "success", message: `Marked ${updated.item} as bought`, item: updated });
  }
  res.status(404).json({ error: "Grocery item not found or already bought" });
});

// Assign chore
app.post('/api/chores', requireApiToken, (req, res) => {
  const { title, assignee, priority, notes } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Chore title is required" });
  }
  const newChore = db.addChore(title, assignee || "Family", priority || "medium", notes || "");
  broadcastChores();
  res.json({ status: "success", message: `Assigned chore "${newChore.title}" to ${newChore.assignee}`, chore: newChore });
});

// Log instruction for domestic help
app.post('/api/instructions', requireApiToken, (req, res) => {
  const { instruction, recipient, priority } = req.body;
  if (!instruction) {
    return res.status(400).json({ error: "Instruction details are required" });
  }
  const newInst = db.addInstruction(instruction, recipient || "Help", priority || "medium");
  broadcastInstructions();
  res.json({ status: "success", message: `Logged instruction for ${newInst.recipient}`, instruction: newInst });
});

// Add a reminder (medication, birthday, event, festival prep, travel checklist)
app.post('/api/reminders', requireApiToken, (req, res) => {
  const { title, date, type, notes } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Reminder title is required" });
  }
  const newReminder = db.addReminder(title, date || "", type || "Event", notes || "");
  broadcastReminders();
  res.json({ status: "success", message: `Added reminder "${newReminder.title}"`, reminder: newReminder });
});

// Household status summary (Called by Bolna to fetch info to speak back to the caller)
app.get('/api/summary', requireApiToken, (req, res) => {
  const summary = db.getHouseholdSummary();
  res.json(summary);
});


// ==========================================
// 2. BOLNA CALL COMPLETED WEBHOOK
// ==========================================
app.post('/api/webhook/call-ended', requireApiToken, (req, res) => {
  const payload = req.body || {};

  // Bolna may deliver the transcript as a plain string, an array of turns,
  // or a structured object. Normalize any of these to readable text so the
  // downstream string operations below never throw on a non-string value.
  const toText = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value
        .map((turn) => {
          if (typeof turn === 'string') return turn;
          if (turn && typeof turn === 'object') {
            const speaker = turn.role || turn.speaker || '';
            const text = turn.content || turn.text || turn.message || '';
            return speaker ? `${speaker}: ${text}` : String(text);
          }
          return String(turn);
        })
        .filter(Boolean)
        .join('\n');
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  // Extracting details from standard Bolna call payload
  const callId = payload.id || payload.call_id || `call-${Date.now()}`;
  const transcript = toText(payload.transcript) || "No transcript available";
  const duration = payload.conversation_duration || payload.duration || 0;

  // Create a clean summary from transcript if not provided by Bolna extraction
  let summary = toText(payload.summary);
  if (!summary && transcript) {
    if (transcript.length < 120) {
      summary = transcript;
    } else {
      // Create a sensible default summary snippet
      summary = transcript.substring(0, 120) + "...";
    }
  }

  // Bolna's "custom analysis" / extraction feature returns structured variables
  // for the call (e.g. detected language, caller intent, items mentioned).
  // Capture whatever the configured extraction schema produced so it can be
  // surfaced on the dashboard. Accepts an object or a JSON string, and ignores
  // anything that is not a flat set of key/value insights.
  const normalizeInsights = (raw) => {
    let data = raw;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return {}; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === '') continue;
      out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    return out;
  };

  const extractedData = normalizeInsights(
    payload.extracted_data ||
    payload.extraction ||
    payload.custom_analysis ||
    payload.analysis ||
    {}
  );

  const newCall = db.addCall(callId, transcript, summary, duration, extractedData);
  broadcastCalls();
  
  // Also push a live call ended alert to the dashboard
  io.emit('call_ended_alert', {
    message: `New call processed successfully! Duration: ${duration}s.`,
    call: newCall
  });

  res.json({ status: "received", callId });
});


// ==========================================
// 3. DASHBOARD MANUAL ACTIONS (Web Interface)
// ==========================================

// Get initial state
app.get('/api/dashboard', (req, res) => {
  res.json({
    groceries: db.getGroceries(),
    chores: db.getChores(),
    instructions: db.getInstructions(),
    reminders: db.getReminders(),
    calls: db.getCalls()
  });
});

// Manual Groceries CRUD
app.post('/api/manual/grocery', (req, res) => {
  const { item, quantity, category } = req.body;
  if (!item) return res.status(400).json({ error: "Item name is required" });
  const added = db.addGroceryItem(item, quantity, category);
  broadcastGroceries();
  res.json(added);
});

app.post('/api/manual/grocery/toggle', (req, res) => {
  const { id } = req.body;
  const updated = db.toggleGroceryBought(id);
  if (updated) {
    broadcastGroceries();
    res.json(updated);
  } else {
    res.status(404).json({ error: "Item not found" });
  }
});

app.post('/api/manual/grocery/delete', (req, res) => {
  const { id } = req.body;
  const removed = db.deleteGroceryItem(id);
  if (removed) {
    broadcastGroceries();
    res.json(removed);
  } else {
    res.status(404).json({ error: "Item not found" });
  }
});

// Manual Chores CRUD
app.post('/api/manual/chore', (req, res) => {
  const { title, assignee, priority, notes } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const added = db.addChore(title, assignee, priority, notes);
  broadcastChores();
  res.json(added);
});

app.post('/api/manual/chore/toggle', (req, res) => {
  const { id } = req.body;
  const updated = db.toggleChoreCompleted(id);
  if (updated) {
    broadcastChores();
    res.json(updated);
  } else {
    res.status(404).json({ error: "Chore not found" });
  }
});

app.post('/api/manual/chore/delete', (req, res) => {
  const { id } = req.body;
  const removed = db.deleteChore(id);
  if (removed) {
    broadcastChores();
    res.json(removed);
  } else {
    res.status(404).json({ error: "Chore not found" });
  }
});

// Manual Instructions CRUD
app.post('/api/manual/instruction', (req, res) => {
  const { instruction, recipient, priority } = req.body;
  if (!instruction) return res.status(400).json({ error: "Instruction text is required" });
  const added = db.addInstruction(instruction, recipient, priority);
  broadcastInstructions();
  res.json(added);
});

app.post('/api/manual/instruction/delete', (req, res) => {
  const { id } = req.body;
  const removed = db.deleteInstruction(id);
  if (removed) {
    broadcastInstructions();
    res.json(removed);
  } else {
    res.status(404).json({ error: "Instruction not found" });
  }
});

// Manual Reminders CRUD
app.post('/api/manual/reminder', (req, res) => {
  const { title, date, type, notes } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const added = db.addReminder(title, date, type, notes);
  broadcastReminders();
  res.json(added);
});

app.post('/api/manual/reminder/toggle', (req, res) => {
  const { id } = req.body;
  const updated = db.toggleReminderDone(id);
  if (updated) {
    broadcastReminders();
    res.json(updated);
  } else {
    res.status(404).json({ error: "Reminder not found" });
  }
});

app.post('/api/manual/reminder/delete', (req, res) => {
  const { id } = req.body;
  const removed = db.deleteReminder(id);
  if (removed) {
    broadcastReminders();
    res.json(removed);
  } else {
    res.status(404).json({ error: "Reminder not found" });
  }
});


// Centralized error handler — keeps malformed JSON bodies and unexpected
// failures from leaking stack traces, returning clean JSON instead.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket connection log
io.on('connection', (socket) => {
  console.log(`[Socket] New client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(` NestFlow Local Backend running at: http://localhost:${PORT}`);
  console.log(` Socket.io is active and listening for live events.`);
  console.log(`========================================================`);
});
