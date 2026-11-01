const STORAGE_KEY = "personalTrackerData";

const defaultData = {
  logs: [],
  trackers: []
};

let data = loadData();
let activeFilter = "all";
let editingTrackerId = null;
let activeTrackerId = null;
let editingObjectiveId = null;

const balanceAmount = document.getElementById("balanceAmount");
const logList = document.getElementById("logList");
const logFormPanel = document.getElementById("logFormPanel");
const trackerFormPanel = document.getElementById("trackerFormPanel");
const trackerList = document.getElementById("trackerList");
const objectiveModal = document.getElementById("objectiveModal");
const editObjectiveModal = document.getElementById("editObjectiveModal");

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);

    const parsed = JSON.parse(saved);
    return {
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      trackers: Array.isArray(parsed.trackers) ? parsed.trackers : []
    };
  } catch (error) {
    console.error("Could not load saved data:", error);
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatPHP(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    const isActive = page.id === pageId;
    page.hidden = !isActive;
    page.classList.toggle("active", isActive);
  });

  document.querySelectorAll(".nav-button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  logFormPanel.hidden = true;
  trackerFormPanel.hidden = true;
}

document.querySelectorAll(".nav-button").forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

// MONEY: balance and transaction logs
function renderMoney() {
  const balance = data.logs.reduce((total, log) => total + Number(log.amount), 0);
  balanceAmount.textContent = formatPHP(balance);

  const filteredLogs = data.logs.filter(log => {
    if (activeFilter === "gain") return Number(log.amount) > 0;
    if (activeFilter === "loss") return Number(log.amount) < 0;
    return true;
  });

  if (filteredLogs.length === 0) {
    const message = data.logs.length === 0
      ? "No updates yet. Add your first money log."
      : "No logs match this filter.";
    logList.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  logList.innerHTML = filteredLogs.map(log => {
    const amount = Number(log.amount);
    const type = amount > 0 ? "gain" : "loss";
    const sign = amount > 0 ? "+" : "";
    return `
      <article class="log-item">
        <div>
          <p class="log-description">${escapeHTML(log.description)}</p>
          <p class="log-date">${formatDate(log.createdAt)}</p>
        </div>
        <span class="log-amount ${type}">${sign}${formatPHP(amount)}</span>
      </article>
    `;
  }).join("");
}

document.getElementById("openLogForm").addEventListener("click", () => {
  logFormPanel.hidden = false;
  document.getElementById("logAmount").focus();
});

document.getElementById("closeLogForm").addEventListener("click", () => {
  logFormPanel.hidden = true;
});

document.getElementById("logForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number(document.getElementById("logAmount").value);
  const description = document.getElementById("logDescription").value.trim();

  if (!Number.isFinite(amount) || amount === 0 || !description) {
    alert("Enter a non-zero amount and a description.");
    return;
  }

  data.logs.unshift({
    id: createId(),
    amount,
    description,
    createdAt: new Date().toISOString()
  });

  saveData();
  renderMoney();
  event.target.reset();
  logFormPanel.hidden = true;
});

document.querySelectorAll(".filter-button").forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });
    renderMoney();
  });
});

// OBJECTIVE TRACKERS
function renderTrackers() {
  if (data.trackers.length === 0) {
    trackerList.innerHTML = '<div class="empty-state">No trackers yet. Create one to get started.</div>';
    return;
  }

  trackerList.innerHTML = data.trackers.map(tracker => {
    const objectives = Array.isArray(tracker.objectives) ? tracker.objectives : [];
    const completedCount = objectives.filter(objective => objective.completed).length;

    const objectiveHTML = objectives.length
      ? objectives.map((objective, index) => {
          const isUnlocked = index === 0 || objectives[index - 1].completed;
          const isCompleted = Boolean(objective.completed);
          let status = "";

          if (isCompleted) status = "Completed";
          else if (!isUnlocked) status = "Locked — complete the previous objective first";

          return `
            <div class="objective-item ${isCompleted ? "completed" : ""} ${!isUnlocked ? "locked" : ""}">
              <input
                class="objective-check"
                type="checkbox"
                data-action="toggle-objective"
                data-tracker-id="${tracker.id}"
                data-objective-id="${objective.id}"
                ${isCompleted ? "checked" : ""}
                ${!isUnlocked && !isCompleted ? "disabled" : ""}
                aria-label="Mark ${escapeHTML(objective.name)} as complete"
              >
              <div>
                <p class="objective-name">${escapeHTML(objective.name)}</p>
                ${objective.description ? `<p class="objective-description">${escapeHTML(objective.description)}</p>` : ""}
                ${status ? `<span class="objective-status">${status}</span>` : ""}
              </div>
              <div class="objective-actions">
                <button class="small-button" data-action="edit-objective" data-tracker-id="${tracker.id}" data-objective-id="${objective.id}" type="button">Edit</button>
                <button class="small-button" data-action="move-up" data-tracker-id="${tracker.id}" data-objective-id="${objective.id}" type="button" ${index === 0 ? "disabled" : ""}>Up</button>
                <button class="small-button" data-action="move-down" data-tracker-id="${tracker.id}" data-objective-id="${objective.id}" type="button" ${index === objectives.length - 1 ? "disabled" : ""}>Down</button>
                <button class="small-button" data-action="delete-objective" data-tracker-id="${tracker.id}" data-objective-id="${objective.id}" type="button">Delete</button>
              </div>
            </div>
          `;
        }).join("")
      : '<div class="empty-state">This tracker has no objectives yet.</div>';

    return `
      <article class="tracker-card">
        <div class="tracker-card-header">
          <h2 class="tracker-title">${escapeHTML(tracker.name)}</h2>
          <div class="tracker-actions">
            <button class="small-button" data-action="rename-tracker" data-tracker-id="${tracker.id}" type="button">Rename</button>
            <button class="small-button" data-action="delete-tracker" data-tracker-id="${tracker.id}" type="button">Delete</button>
          </div>
        </div>
        <p class="tracker-progress">${completedCount} of ${objectives.length} objectives completed</p>
        <div class="objective-list">${objectiveHTML}</div>
        <button class="add-objective-button" data-action="add-objective" data-tracker-id="${tracker.id}" type="button">+ Add Objective</button>
      </article>
    `;
  }).join("");
}

document.getElementById("addTrackerButton").addEventListener("click", () => {
  editingTrackerId = null;
  document.getElementById("trackerFormTitle").textContent = "New Tracker";
  document.getElementById("trackerName").value = "";
  trackerFormPanel.hidden = false;
  document.getElementById("trackerName").focus();
});

document.getElementById("closeTrackerForm").addEventListener("click", () => {
  trackerFormPanel.hidden = true;
});

document.getElementById("trackerForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = document.getElementById("trackerName").value.trim();
  if (!name) return;

  if (editingTrackerId) {
    const tracker = data.trackers.find(item => item.id === editingTrackerId);
    if (tracker) tracker.name = name;
  } else {
    data.trackers.push({
      id: createId(),
      name,
      objectives: []
    });
  }

  saveData();
  renderTrackers();
  event.target.reset();
  trackerFormPanel.hidden = true;
  editingTrackerId = null;
});

function openObjectiveModal(trackerId) {
  activeTrackerId = trackerId;
  document.getElementById("objectiveForm").reset();
  document.getElementById("objectiveModalTitle").textContent = "New Objective";
  objectiveModal.hidden = false;
  document.getElementById("objectiveName").focus();
}

document.getElementById("closeObjectiveModal").addEventListener("click", () => {
  objectiveModal.hidden = true;
});

document.getElementById("objectiveForm").addEventListener("submit", event => {
  event.preventDefault();
  const tracker = data.trackers.find(item => item.id === activeTrackerId);
  const name = document.getElementById("objectiveName").value.trim();
  const description = document.getElementById("objectiveDescription").value.trim();

  if (!tracker || !name) return;

  tracker.objectives.push({
    id: createId(),
    name,
    description,
    completed: false
  });

  saveData();
  renderTrackers();
  objectiveModal.hidden = true;
});

function openEditObjectiveModal(trackerId, objectiveId) {
  const tracker = data.trackers.find(item => item.id === trackerId);
  const objective = tracker?.objectives.find(item => item.id === objectiveId);
  if (!objective) return;

  activeTrackerId = trackerId;
  editingObjectiveId = objectiveId;
  document.getElementById("editObjectiveName").value = objective.name;
  document.getElementById("editObjectiveDescription").value = objective.description || "";
  editObjectiveModal.hidden = false;
  document.getElementById("editObjectiveName").focus();
}

document.getElementById("closeEditObjectiveModal").addEventListener("click", () => {
  editObjectiveModal.hidden = true;
});

document.getElementById("editObjectiveForm").addEventListener("submit", event => {
  event.preventDefault();
  const tracker = data.trackers.find(item => item.id === activeTrackerId);
  const objective = tracker?.objectives.find(item => item.id === editingObjectiveId);
  if (!objective) return;

  const name = document.getElementById("editObjectiveName").value.trim();
  if (!name) return;

  objective.name = name;
  objective.description = document.getElementById("editObjectiveDescription").value.trim();

  saveData();
  renderTrackers();
  editObjectiveModal.hidden = true;
});

trackerList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const trackerId = button.dataset.trackerId;
  const objectiveId = button.dataset.objectiveId;
  const tracker = data.trackers.find(item => item.id === trackerId);
  if (!tracker) return;

  if (action === "rename-tracker") {
    editingTrackerId = trackerId;
    document.getElementById("trackerFormTitle").textContent = "Rename Tracker";
    document.getElementById("trackerName").value = tracker.name;
    trackerFormPanel.hidden = false;
    document.getElementById("trackerName").focus();
    return;
  }

  if (action === "delete-tracker") {
    if (!confirm(`Delete the tracker "${tracker.name}" and all its objectives?`)) return;
    data.trackers = data.trackers.filter(item => item.id !== trackerId);
  }

  if (action === "add-objective") {
    openObjectiveModal(trackerId);
    return;
  }

  if (action === "edit-objective") {
    openEditObjectiveModal(trackerId, objectiveId);
    return;
  }

  if (action === "delete-objective") {
    const objective = tracker.objectives.find(item => item.id === objectiveId);
    if (!objective || !confirm(`Delete "${objective.name}"?`)) return;
    tracker.objectives = tracker.objectives.filter(item => item.id !== objectiveId);
  }

  if (action === "move-up" || action === "move-down") {
    const index = tracker.objectives.findIndex(item => item.id === objectiveId);
    const nextIndex = action === "move-up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= tracker.objectives.length) return;

    [tracker.objectives[index], tracker.objectives[nextIndex]] =
      [tracker.objectives[nextIndex], tracker.objectives[index]];
  }

  saveData();
  renderTrackers();
});

trackerList.addEventListener("change", event => {
  const checkbox = event.target.closest('input[data-action="toggle-objective"]');
  if (!checkbox) return;

  const tracker = data.trackers.find(item => item.id === checkbox.dataset.trackerId);
  if (!tracker) return;

  const index = tracker.objectives.findIndex(item => item.id === checkbox.dataset.objectiveId);
  if (index < 0) return;

  // A task can only be completed when it is first or the previous task is complete.
  if (checkbox.checked && index > 0 && !tracker.objectives[index - 1].completed) {
    checkbox.checked = false;
    return;
  }

  tracker.objectives[index].completed = checkbox.checked;

  // If an objective is unchecked, every later objective is reset to preserve the sequence.
  if (!checkbox.checked) {
    for (let i = index + 1; i < tracker.objectives.length; i++) {
      tracker.objectives[i].completed = false;
    }
  }

  saveData();
  renderTrackers();
});

// Close modal when clicking the shaded backdrop.
[objectiveModal, editObjectiveModal].forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.hidden = true;
  });
});

let negativeButton = document.getElementById("negativeButton");
negativeButton.addEventListener("click", () => {
  let logAmountInput = document.getElementById("logAmount");
  let currentValue = logAmountInput.value;

  if (currentValue.startsWith("-")) {
    logAmountInput.value = currentValue.slice(1);
  } else {
    logAmountInput.value = "-" + currentValue;
  }
});

// Initial render
renderMoney();
renderTrackers();
