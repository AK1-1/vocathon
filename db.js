const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'db.json');

// Initialize database file if it does not exist
function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    const defaultData = {
      groceries: [
        {
          id: uuidv4(),
          item: "Milk",
          quantity: "2 Litres",
          category: "Dairy",
          bought: false,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          item: "Tomatoes",
          quantity: "1 kg",
          category: "Produce",
          bought: false,
          createdAt: new Date().toISOString()
        }
      ],
      chores: [
        {
          id: uuidv4(),
          title: "Clean kitchen counters",
          assignee: "Achyut",
          priority: "high",
          notes: "After dinner",
          completed: false,
          createdAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          title: "Water the living room plants",
          assignee: "Dad",
          priority: "medium",
          notes: "Every morning",
          completed: false,
          createdAt: new Date().toISOString()
        }
      ],
      instructions: [
        {
          id: uuidv4(),
          instruction: "Cook paneer butter masala for dinner tonight",
          recipient: "Cook",
          priority: "medium",
          createdAt: new Date().toISOString()
        }
      ],
      reminders: [
        {
          id: uuidv4(),
          title: "Dad's blood pressure medicine",
          date: "Every morning, 8 AM",
          type: "Medication",
          notes: "After breakfast",
          done: false,
          createdAt: new Date().toISOString()
        }
      ],
      calls: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// Read raw data from db.json
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database:", error);
    return { groceries: [], chores: [], instructions: [], reminders: [], calls: [] };
  }
}

// Write raw data to db.json
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error writing database:", error);
    return false;
  }
}

// --- Grocery Operations ---
function getGroceries() {
  return readDb().groceries;
}

function addGroceryItem(item, quantity = "1", category = "Pantry") {
  const db = readDb();
  const newItem = {
    id: uuidv4(),
    item: String(item).trim(),
    quantity: String(quantity).trim() || "1",
    category: String(category).trim() || "Pantry",
    bought: false,
    createdAt: new Date().toISOString()
  };
  db.groceries.push(newItem);
  writeDb(db);
  return newItem;
}

function toggleGroceryBought(id) {
  const db = readDb();
  const index = db.groceries.findIndex(g => g.id === id);
  if (index !== -1) {
    db.groceries[index].bought = !db.groceries[index].bought;
    writeDb(db);
    return db.groceries[index];
  }
  return null;
}

function markGroceryBoughtByName(name) {
  const db = readDb();
  const lowerName = name.toLowerCase().trim();
  const item = db.groceries.find(g => g.item.toLowerCase().includes(lowerName) && !g.bought);
  if (item) {
    item.bought = true;
    writeDb(db);
    return item;
  }
  return null;
}

function deleteGroceryItem(id) {
  const db = readDb();
  const index = db.groceries.findIndex(g => g.id === id);
  if (index !== -1) {
    const removed = db.groceries.splice(index, 1);
    writeDb(db);
    return removed[0];
  }
  return null;
}

// --- Chore Operations ---
function getChores() {
  return readDb().chores;
}

function addChore(title, assignee = "Family", priority = "medium", notes = "") {
  const db = readDb();
  const newChore = {
    id: uuidv4(),
    title: String(title).trim(),
    assignee: String(assignee).trim() || "Family",
    priority: String(priority).toLowerCase().trim() || "medium",
    notes: String(notes).trim(),
    completed: false,
    createdAt: new Date().toISOString()
  };
  db.chores.push(newChore);
  writeDb(db);
  return newChore;
}

function toggleChoreCompleted(id) {
  const db = readDb();
  const index = db.chores.findIndex(c => c.id === id);
  if (index !== -1) {
    db.chores[index].completed = !db.chores[index].completed;
    writeDb(db);
    return db.chores[index];
  }
  return null;
}

function deleteChore(id) {
  const db = readDb();
  const index = db.chores.findIndex(c => c.id === id);
  if (index !== -1) {
    const removed = db.chores.splice(index, 1);
    writeDb(db);
    return removed[0];
  }
  return null;
}

// --- Instruction Operations ---
function getInstructions() {
  return readDb().instructions;
}

function addInstruction(instruction, recipient = "Help", priority = "medium") {
  const db = readDb();
  const newInstruction = {
    id: uuidv4(),
    instruction: String(instruction).trim(),
    recipient: String(recipient).trim() || "Help",
    priority: String(priority).toLowerCase().trim() || "medium",
    createdAt: new Date().toISOString()
  };
  db.instructions.push(newInstruction);
  writeDb(db);
  return newInstruction;
}

function deleteInstruction(id) {
  const db = readDb();
  const index = db.instructions.findIndex(i => i.id === id);
  if (index !== -1) {
    const removed = db.instructions.splice(index, 1);
    writeDb(db);
    return removed[0];
  }
  return null;
}

// --- Reminder Operations ---
// (medication, birthdays, events, festival prep, travel checklists)
// Note: existing db.json files predate this key, so always default it.
function getReminders() {
  return readDb().reminders || [];
}

function addReminder(title, date = "", type = "Event", notes = "") {
  const db = readDb();
  if (!Array.isArray(db.reminders)) db.reminders = [];
  const newReminder = {
    id: uuidv4(),
    title: String(title).trim(),
    date: String(date).trim(),
    type: String(type).trim() || "Event",
    notes: String(notes).trim(),
    done: false,
    createdAt: new Date().toISOString()
  };
  db.reminders.push(newReminder);
  writeDb(db);
  return newReminder;
}

function toggleReminderDone(id) {
  const db = readDb();
  if (!Array.isArray(db.reminders)) db.reminders = [];
  const index = db.reminders.findIndex(r => r.id === id);
  if (index !== -1) {
    db.reminders[index].done = !db.reminders[index].done;
    writeDb(db);
    return db.reminders[index];
  }
  return null;
}

function deleteReminder(id) {
  const db = readDb();
  if (!Array.isArray(db.reminders)) db.reminders = [];
  const index = db.reminders.findIndex(r => r.id === id);
  if (index !== -1) {
    const removed = db.reminders.splice(index, 1);
    writeDb(db);
    return removed[0];
  }
  return null;
}

// --- Call Log Operations ---
function getCalls() {
  return readDb().calls;
}

function addCall(callId, transcript = "", summary = "", duration = 0, extractedData = {}) {
  const db = readDb();
  const newCall = {
    id: uuidv4(),
    callId: callId || `call-${Date.now()}`,
    transcript: String(transcript).trim(),
    summary: String(summary).trim() || "No summary provided",
    duration: Number(duration) || 0,
    // Structured variables from Bolna's custom analysis / extraction, if any.
    extractedData: (extractedData && typeof extractedData === 'object' && !Array.isArray(extractedData))
      ? extractedData
      : {},
    timestamp: new Date().toISOString()
  };
  // Store only the 20 most recent calls to save space
  db.calls.unshift(newCall);
  if (db.calls.length > 20) {
    db.calls.pop();
  }
  writeDb(db);
  return newCall;
}

// --- Get Household Summary (for Bolna Voice Context) ---
function getHouseholdSummary() {
  const db = readDb();
  const pendingGroceries = db.groceries
    .filter(g => !g.bought)
    .map(g => `${g.item} (${g.quantity}) [Category: ${g.category}]`)
    .join(', ') || 'None';

  const pendingChores = db.chores
    .filter(c => !c.completed)
    .map(c => `"${c.title}" assigned to ${c.assignee} (${c.priority} priority)${c.notes ? ' - Notes: ' + c.notes : ''}`)
    .join(', ') || 'None';

  const activeInstructions = db.instructions
    .map(i => `For ${i.recipient}: "${i.instruction}" (${i.priority} priority)`)
    .join(', ') || 'None';

  const upcomingReminders = (db.reminders || [])
    .filter(r => !r.done)
    .map(r => `"${r.title}"${r.date ? ' on ' + r.date : ''} [${r.type}]${r.notes ? ' - Notes: ' + r.notes : ''}`)
    .join(', ') || 'None';

  return {
    groceriesSummary: pendingGroceries,
    choresSummary: pendingChores,
    instructionsSummary: activeInstructions,
    remindersSummary: upcomingReminders,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  getGroceries,
  addGroceryItem,
  toggleGroceryBought,
  markGroceryBoughtByName,
  deleteGroceryItem,
  getChores,
  addChore,
  toggleChoreCompleted,
  deleteChore,
  getInstructions,
  addInstruction,
  deleteInstruction,
  getReminders,
  addReminder,
  toggleReminderDone,
  deleteReminder,
  getCalls,
  addCall,
  getHouseholdSummary
};
