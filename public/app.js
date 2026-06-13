// Establish Socket.io Connection
const socket = io();

// UI Elements
const statusIndicator = document.getElementById('connection-status');
const statGroceries = document.getElementById('stat-groceries');
const statChores = document.getElementById('stat-chores');
const statReminders = document.getElementById('stat-reminders');
const statCalls = document.getElementById('stat-calls');

const groceryList = document.getElementById('grocery-list');
const groceryEmpty = document.getElementById('grocery-empty');
const choreList = document.getElementById('chore-list');
const choreEmpty = document.getElementById('chore-empty');
const instructionList = document.getElementById('instruction-list');
const instructionEmpty = document.getElementById('instruction-empty');
const reminderList = document.getElementById('reminder-list');
const reminderEmpty = document.getElementById('reminder-empty');
const callsList = document.getElementById('calls-list');
const callsEmpty = document.getElementById('calls-empty');

const toastContainer = document.getElementById('toast-container');

// State management
let currentGroceries = [];
let currentChores = [];
let currentInstructions = [];
let currentReminders = [];
let currentCalls = [];

// ==========================================
// 1. SOCKET CONNECTION HANDLERS
// ==========================================
socket.on('connect', () => {
  console.log('Connected to server!');
  statusIndicator.className = 'status-indicator online';
  statusIndicator.querySelector('.status-label').textContent = 'Live Dashboard Connected';
  showToast('System Connected', 'Live household updates synced.', 'info');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  statusIndicator.className = 'status-indicator offline';
  statusIndicator.querySelector('.status-label').textContent = 'Server Offline';
  showToast('System Disconnected', 'Changes will not sync automatically.', 'error');
});

// Socket update events
socket.on('groceries_updated', (groceries) => {
  // Detect voice adds for notifications
  const beforeCount = currentGroceries.filter(g => !g.bought).length;
  const afterCount = groceries.filter(g => !g.bought).length;
  if (afterCount > beforeCount) {
    // Check if added item was via API (no matching local form trigger)
    const voiceItem = groceries.find(g => !currentGroceries.some(cg => cg.id === g.id));
    if (voiceItem) {
      showToast('Grocery Logged via Voice', `"${voiceItem.item}" (${voiceItem.quantity}) added.`, 'success');
    }
  }
  
  currentGroceries = groceries;
  renderGroceries();
});

socket.on('chores_updated', (chores) => {
  const voiceChore = chores.find(c => !currentChores.some(cc => cc.id === c.id));
  if (voiceChore) {
    showToast('Chore Assigned via Voice', `"${voiceChore.title}" assigned to ${voiceChore.assignee}.`, 'success');
  }
  
  // Detect completions
  chores.forEach(c => {
    const prev = currentChores.find(pc => pc.id === c.id);
    if (prev && !prev.completed && c.completed) {
      showToast('Chore Completed', `"${c.title}" is finished!`, 'info');
    }
  });

  currentChores = chores;
  renderChores();
});

socket.on('instructions_updated', (instructions) => {
  const voiceInst = instructions.find(i => !currentInstructions.some(ci => ci.id === i.id));
  if (voiceInst) {
    showToast('Instruction Logged via Voice', `For ${voiceInst.recipient}: "${voiceInst.instruction}".`, 'success');
  }

  currentInstructions = instructions;
  renderInstructions();
});

socket.on('reminders_updated', (reminders) => {
  const voiceReminder = reminders.find(r => !currentReminders.some(cr => cr.id === r.id));
  if (voiceReminder) {
    showToast('Reminder Added via Voice', `"${voiceReminder.title}" (${voiceReminder.type}) saved.`, 'success');
  }

  // Detect completions
  reminders.forEach(r => {
    const prev = currentReminders.find(pr => pr.id === r.id);
    if (prev && !prev.done && r.done) {
      showToast('Reminder Done', `"${r.title}" marked done.`, 'info');
    }
  });

  currentReminders = reminders;
  renderReminders();
});

socket.on('calls_updated', (calls) => {
  currentCalls = calls;
  renderCalls();
});

socket.on('call_ended_alert', (data) => {
  showToast('Voice Call Logged', data.message, 'voice');
});


// ==========================================
// 2. DATA RENDERING FUNCTIONS
// ==========================================

// Escape user/webhook-supplied text before it is placed into innerHTML.
// Transcripts and item names can originate from external callers (Bolna
// webhook, manual forms), so they must never be treated as trusted markup.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Turn an extraction key like "detected_language" into "Detected Language".
function formatInsightLabel(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function renderGroceries() {
  groceryList.innerHTML = '';
  
  const pending = currentGroceries.filter(g => !g.bought);
  const bought = currentGroceries.filter(g => g.bought);
  const sorted = [...pending, ...bought];
  
  statGroceries.textContent = pending.length;

  if (sorted.length === 0) {
    groceryEmpty.style.display = 'flex';
    return;
  }
  groceryEmpty.style.display = 'none';

  sorted.forEach(g => {
    const li = document.createElement('li');
    li.className = `item-row ${g.bought ? 'completed' : ''}`;
    li.innerHTML = `
      <div class="item-left">
        <label class="checkbox-container">
          <input type="checkbox" ${g.bought ? 'checked' : ''} onchange="toggleGrocery('${escapeHtml(g.id)}')">
          <span class="checkmark"></span>
        </label>
        <div>
          <div class="item-text">${escapeHtml(g.item)}</div>
          <div class="item-meta">${escapeHtml(g.quantity || '1 unit')}</div>
        </div>
      </div>
      <div class="item-right">
        <span class="badge badge-category">${escapeHtml(g.category || 'Other')}</span>
        <button class="btn-delete" onclick="deleteGrocery('${escapeHtml(g.id)}')" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    groceryList.appendChild(li);
  });
}

function renderChores() {
  choreList.innerHTML = '';
  const pending = currentChores.filter(c => !c.completed);
  const completed = currentChores.filter(c => c.completed);
  const sorted = [...pending, ...completed];

  statChores.textContent = pending.length;

  if (sorted.length === 0) {
    choreEmpty.style.display = 'flex';
    return;
  }
  choreEmpty.style.display = 'none';

  sorted.forEach(c => {
    const initial = c.assignee ? c.assignee.charAt(0) : 'F';
    const li = document.createElement('li');
    li.className = `item-row ${c.completed ? 'completed' : ''}`;
    
    // Select priority badge styling
    const prioClass = escapeHtml(`badge-priority-${c.priority || 'medium'}`);
    
    li.innerHTML = `
      <div class="item-left">
        <label class="checkbox-container">
          <input type="checkbox" ${c.completed ? 'checked' : ''} onchange="toggleChore('${escapeHtml(c.id)}')">
          <span class="checkmark"></span>
        </label>
        <div>
          <div class="item-text">${escapeHtml(c.title)}</div>
          <div class="item-meta">${c.notes ? escapeHtml(c.notes) : 'No extra notes'}</div>
        </div>
      </div>
      <div class="item-right">
        <span class="avatar-badge" title="Assigned to ${escapeHtml(c.assignee)}">${escapeHtml(initial)}</span>
        <span class="badge ${prioClass}">${escapeHtml(c.priority)}</span>
        <button class="btn-delete" onclick="deleteChore('${escapeHtml(c.id)}')" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    choreList.appendChild(li);
  });
}

function renderInstructions() {
  instructionList.innerHTML = '';

  if (currentInstructions.length === 0) {
    instructionEmpty.style.display = 'flex';
    return;
  }
  instructionEmpty.style.display = 'none';

  currentInstructions.forEach(i => {
    const li = document.createElement('li');
    li.className = 'item-row';
    const prioClass = escapeHtml(`badge-priority-${i.priority || 'medium'}`);

    li.innerHTML = `
      <div class="item-left">
        <span class="material-symbols-outlined" style="color: var(--warning)">support_agent</span>
        <div>
          <div class="item-text">${escapeHtml(i.instruction)}</div>
          <div class="item-meta">Recipient: ${escapeHtml(i.recipient)}</div>
        </div>
      </div>
      <div class="item-right">
        <span class="badge ${prioClass}">${escapeHtml(i.priority)}</span>
        <button class="btn-delete" onclick="deleteInstruction('${escapeHtml(i.id)}')" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    instructionList.appendChild(li);
  });
}

function renderReminders() {
  reminderList.innerHTML = '';

  const pending = currentReminders.filter(r => !r.done);
  const done = currentReminders.filter(r => r.done);
  const sorted = [...pending, ...done];

  if (statReminders) statReminders.textContent = pending.length;

  if (sorted.length === 0) {
    reminderEmpty.style.display = 'flex';
    return;
  }
  reminderEmpty.style.display = 'none';

  sorted.forEach(r => {
    const li = document.createElement('li');
    li.className = `item-row ${r.done ? 'completed' : ''}`;
    const meta = [r.date, r.notes].filter(Boolean).map(escapeHtml).join(' • ') || 'No date set';

    li.innerHTML = `
      <div class="item-left">
        <label class="checkbox-container">
          <input type="checkbox" ${r.done ? 'checked' : ''} onchange="toggleReminder('${escapeHtml(r.id)}')">
          <span class="checkmark"></span>
        </label>
        <div>
          <div class="item-text">${escapeHtml(r.title)}</div>
          <div class="item-meta">${meta}</div>
        </div>
      </div>
      <div class="item-right">
        <span class="badge badge-category">${escapeHtml(r.type || 'Event')}</span>
        <button class="btn-delete" onclick="deleteReminder('${escapeHtml(r.id)}')" title="Delete">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    reminderList.appendChild(li);
  });
}

function renderCalls() {
  callsList.innerHTML = '';
  statCalls.textContent = currentCalls.length;

  if (currentCalls.length === 0) {
    callsEmpty.style.display = 'flex';
    return;
  }
  callsEmpty.style.display = 'none';

  currentCalls.forEach(c => {
    const callDate = new Date(c.timestamp).toLocaleString();
    const div = document.createElement('div');
    div.className = 'call-row';
    div.id = `call-${c.id}`;

    // Render Bolna custom-analysis variables (e.g. detected language, intent)
    // as labelled chips, only when the extraction actually produced data.
    const insights = c.extractedData && typeof c.extractedData === 'object' ? c.extractedData : {};
    const insightKeys = Object.keys(insights);
    const insightsBlock = insightKeys.length === 0 ? '' : `
        <div class="call-insights-block">
          <h4>Call Insights — Custom Analysis</h4>
          <div class="insight-chips">
            ${insightKeys.map(key => `
              <span class="insight-chip">
                <strong>${escapeHtml(formatInsightLabel(key))}</strong>
                <span>${escapeHtml(insights[key])}</span>
              </span>
            `).join('')}
          </div>
        </div>
    `;

    div.innerHTML = `
      <div class="call-row-header" onclick="toggleCallExpand('${escapeHtml(c.id)}')">
        <div class="call-meta-info">
          <div class="call-title-info">
            <span class="material-symbols-outlined" style="color: var(--success)">phone_in_talk</span>
            <span>AI Voice Call Session</span>
          </div>
          <span class="call-time">${escapeHtml(callDate)}</span>
          <div class="call-stat-pills">
            <span class="call-stat-pill">
              <span class="material-symbols-outlined">hourglass_empty</span>
              ${escapeHtml(c.duration)}s
            </span>
          </div>
        </div>
        <span class="material-symbols-outlined call-expand-icon">expand_more</span>
      </div>
      <div class="call-details">
        <div class="call-summary-block">
          <h4>Call Summary</h4>
          <p>${c.summary ? escapeHtml(c.summary) : 'No summary generated.'}</p>
        </div>
        ${insightsBlock}
        <div class="call-transcript-block">
          <h4>Full Transcript</h4>
          <div class="transcript-content">${c.transcript ? escapeHtml(c.transcript) : 'No transcription.'}</div>
        </div>
      </div>
    `;
    callsList.appendChild(div);
  });
}

// Collapsible helper
function toggleCallExpand(id) {
  const el = document.getElementById(`call-${id}`);
  if (el) {
    el.classList.toggle('expanded');
  }
}


// ==========================================
// 3. API CLIENT TRIGGERS (MANUAL EDITS)
// ==========================================

// Groceries
async function toggleGrocery(id) {
  try {
    const response = await fetch('/api/manual/grocery/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Toggle grocery failed');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not toggle item.', 'error');
  }
}

async function deleteGrocery(id) {
  try {
    const response = await fetch('/api/manual/grocery/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Delete grocery failed');
    showToast('Grocery Deleted', 'Item removed from list.', 'info');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not delete item.', 'error');
  }
}

// Chores
async function toggleChore(id) {
  try {
    const response = await fetch('/api/manual/chore/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Toggle chore failed');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not toggle chore.', 'error');
  }
}

async function deleteChore(id) {
  try {
    const response = await fetch('/api/manual/chore/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Delete chore failed');
    showToast('Chore Removed', 'Chore deleted.', 'info');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not delete chore.', 'error');
  }
}

// Instructions
async function deleteInstruction(id) {
  try {
    const response = await fetch('/api/manual/instruction/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Delete instruction failed');
    showToast('Instruction Removed', 'Instruction cleared.', 'info');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not remove instruction.', 'error');
  }
}

// Reminders
async function toggleReminder(id) {
  try {
    const response = await fetch('/api/manual/reminder/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Toggle reminder failed');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not toggle reminder.', 'error');
  }
}

async function deleteReminder(id) {
  try {
    const response = await fetch('/api/manual/reminder/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('Delete reminder failed');
    showToast('Reminder Removed', 'Reminder cleared.', 'info');
  } catch (err) {
    console.error(err);
    showToast('Action Failed', 'Could not remove reminder.', 'error');
  }
}


// ==========================================
// 4. FORMS SUBMIT AND MODALS
// ==========================================

// Modal management
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Close modals when clicking overlay background
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal(overlay.id);
    }
  });
});

// Grocery Form Submit
document.getElementById('grocery-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = document.getElementById('g-item').value;
  const quantity = document.getElementById('g-quantity').value;
  const category = document.getElementById('g-category').value;
  
  try {
    const response = await fetch('/api/manual/grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, quantity, category })
    });
    
    if (response.ok) {
      closeModal('grocery-modal');
      document.getElementById('grocery-form').reset();
      showToast('Grocery Logged', `"${item}" added to list.`, 'success');
    } else {
      throw new Error('Failed to add grocery manually');
    }
  } catch (err) {
    console.error(err);
    showToast('Error', 'Failed to add grocery item.', 'error');
  }
});

// Chore Form Submit
document.getElementById('chore-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('c-title').value;
  const assignee = document.getElementById('c-assignee').value;
  const priority = document.getElementById('c-priority').value;
  const notes = document.getElementById('c-notes').value;

  try {
    const response = await fetch('/api/manual/chore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, assignee, priority, notes })
    });

    if (response.ok) {
      closeModal('chore-modal');
      document.getElementById('chore-form').reset();
      showToast('Chore Assigned', `"${title}" assigned to ${assignee || 'Family'}.`, 'success');
    } else {
      throw new Error('Failed to add chore manually');
    }
  } catch (err) {
    console.error(err);
    showToast('Error', 'Failed to assign chore.', 'error');
  }
});

// Instruction Form Submit
document.getElementById('instruction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const instruction = document.getElementById('i-instruction').value;
  const recipient = document.getElementById('i-recipient').value;
  const priority = document.getElementById('i-priority').value;

  try {
    const response = await fetch('/api/manual/instruction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, recipient, priority })
    });

    if (response.ok) {
      closeModal('instruction-modal');
      document.getElementById('instruction-form').reset();
      showToast('Instruction Logged', `Saved for ${recipient}.`, 'success');
    } else {
      throw new Error('Failed to add instruction manually');
    }
  } catch (err) {
    console.error(err);
    showToast('Error', 'Failed to save instruction.', 'error');
  }
});

// Reminder Form Submit
document.getElementById('reminder-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('r-title').value;
  const date = document.getElementById('r-date').value;
  const type = document.getElementById('r-type').value;
  const notes = document.getElementById('r-notes').value;

  try {
    const response = await fetch('/api/manual/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, type, notes })
    });

    if (response.ok) {
      closeModal('reminder-modal');
      document.getElementById('reminder-form').reset();
      showToast('Reminder Added', `"${title}" saved.`, 'success');
    } else {
      throw new Error('Failed to add reminder manually');
    }
  } catch (err) {
    console.error(err);
    showToast('Error', 'Failed to add reminder.', 'error');
  }
});


// ==========================================
// 5. TOAST NOTIFICATION HELPERS
// ==========================================
function showToast(title, message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast glassmorphism';
  
  // Icon selector
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  if (type === 'error') icon = 'warning';
  if (type === 'voice') icon = 'record_voice_over';

  toast.innerHTML = `
    <span class="material-symbols-outlined toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;
  
  // Custom theme colors for type of toasts
  if (type === 'success') toast.style.borderColor = 'var(--success)';
  if (type === 'error') toast.style.borderColor = 'var(--danger)';
  if (type === 'voice') toast.style.borderColor = 'var(--success)';
  
  toastContainer.appendChild(toast);

  // Remove toast after 5s
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 5000);
}


// ==========================================
// 6. INITIALIZATION & RE-HYDRATION
// ==========================================
async function initDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('Database rehydration failed');
    const data = await response.json();
    
    currentGroceries = data.groceries || [];
    currentChores = data.chores || [];
    currentInstructions = data.instructions || [];
    currentReminders = data.reminders || [];
    currentCalls = data.calls || [];

    renderGroceries();
    renderChores();
    renderInstructions();
    renderReminders();
    renderCalls();
    
    console.log('Dashboard hydrated successfully!');
  } catch (err) {
    console.error('Error hydrating dashboard:', err);
    showToast('Hydration Error', 'Could not sync latest logs from server.', 'error');
  }
}

// Hydrate on page load
window.addEventListener('DOMContentLoaded', initDashboard);
