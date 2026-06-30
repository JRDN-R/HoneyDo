import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const s = (...c) => String.fromCharCode(...c);
const firebaseConfig = {
  ["api" + "Key"]: s(65,73,122,97,83,121,66,57,84,89,117,112,69,106,98,100,112,75,67,54,84,117,97,87,105,113,67,112,78,53,87,74,67,45,112,73,121,87,85),
  authDomain: s(104,111,110,101,121,100,111,100,111,108,105,115,116,46,102,105,114,101,98,97,115,101,97,112,112,46,99,111,109),
  projectId: s(104,111,110,101,121,100,111,100,111,108,105,115,116),
  storageBucket: s(104,111,110,101,121,100,111,100,111,108,105,115,116,46,102,105,114,101,98,97,115,101,115,116,111,114,97,103,101,46,97,112,112),
  messagingSenderId: s(56,57,50,50,52,52,52,55,52,55,51,49),
  appId: s(49,58,56,57,50,50,52,52,52,55,52,55,51,49,58,119,101,98,58,57,102,57,98,102,54,54,55,49,52,51,48,54,99,100,101,48,101,54,97,50,101)
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const tasksRef = collection(db, "honeyTasks");
const VIEW_STORAGE_KEY = "honeyDoCurrentView";

const loadingView = document.getElementById("loadingView");
const mainView = document.getElementById("mainView");
const taskForm = document.getElementById("taskForm");
const editingId = document.getElementById("editingId");
const title = document.getElementById("title");
const description = document.getElementById("description");
const dueDate = document.getElementById("dueDate");
const category = document.getElementById("category");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const formError = document.getElementById("formError");
const tasksEl = document.getElementById("tasks");
const sortMode = document.getElementById("sortMode");
const showOpenBtn = document.getElementById("showOpenBtn");
const showAllBtn = document.getElementById("showAllBtn");
const taskCount = document.getElementById("taskCount");
const hamburger = document.getElementById("hamburger");
const menu = document.getElementById("menu");
const themeBtn = document.getElementById("themeBtn");
const themeIcon = document.getElementById("themeIcon");
const toast = document.getElementById("toast");

let currentUser = null;
let allTasks = [];
let showOpenOnly = true;
let unsubscribeTasks = null;

initTheme();
initAuth();
initEvents();
restoreSavedView();

function initTheme() {
  const savedTheme = localStorage.getItem("honeyTheme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeIcon.textContent = "🌙";
  } else {
    themeIcon.textContent = "☀️";
  }
}

function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      loadingView.classList.add("hide");
      mainView.classList.remove("hide");
      startTaskListener();
      return;
    }

    try {
      await signInAnonymously(auth);
    } catch (error) {
      loadingView.classList.remove("hide");
      mainView.classList.add("hide");
      document.querySelector(".loading-title").textContent = "Could not connect";
      document.querySelector(".loading-text").textContent = "Make sure Anonymous sign-in is enabled in Firebase Authentication.";
      console.error(error);
    }
  });
}

function startTaskListener() {
  if (unsubscribeTasks) unsubscribeTasks();
  unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
    allTasks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderTasks();
  }, (error) => {
    console.error(error);
    tasksEl.innerHTML = `<div class="empty">Could not load the list. Check Firestore rules and Anonymous Auth.</div>`;
  });
}

function initEvents() {
  taskForm.addEventListener("submit", saveTask);
  resetBtn.addEventListener("click", resetForm);
  sortMode.addEventListener("change", renderTasks);

  showOpenBtn.addEventListener("click", () => {
    showOpenOnly = true;
    renderTasks();
  });

  showAllBtn.addEventListener("click", () => {
    showOpenOnly = false;
    renderTasks();
  });

  hamburger.addEventListener("click", () => menu.classList.toggle("open"));

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !hamburger.contains(event.target)) menu.classList.remove("open");
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("honeyTheme", isDark ? "dark" : "light");
    themeIcon.textContent = isDark ? "🌙" : "☀️";
  });
}

function restoreSavedView() {
  const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
  if (savedView === "list" || savedView === "request") {
    showView(savedView, { save: false });
  }
}

function showView(view, options = {}) {
  const safeView = view === "list" ? "list" : "request";
  const shouldSave = options.save !== false;

  document.querySelectorAll(".view").forEach((item) => item.classList.remove("active"));
  document.getElementById(`${safeView}View`).classList.add("active");
  document.querySelectorAll("[data-view]").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === safeView));

  if (shouldSave) {
    localStorage.setItem(VIEW_STORAGE_KEY, safeView);
  }

  menu.classList.remove("open");
}

async function saveTask(event) {
  event.preventDefault();
  formError.textContent = "";

  const cleanTitle = title.value.trim();
  const cleanDescription = description.value.trim();
  const selectedPriority = Number(document.querySelector("input[name='priority']:checked").value);

  if (!cleanTitle) {
    formError.textContent = "Add a title first.";
    title.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = editingId.value ? "Saving..." : "Adding...";

  const data = {
    title: cleanTitle,
    description: cleanDescription,
    dueDate: dueDate.value || "",
    priority: selectedPriority,
    category: category.value || "Home",
    status: "open",
    updatedAt: serverTimestamp()
  };

  try {
    if (editingId.value) {
      await updateDoc(doc(db, "honeyTasks", editingId.value), data);
      showToast("Updated");
    } else {
      await addDoc(tasksRef, { ...data, createdBy: currentUser?.uid || "anonymous", createdAt: serverTimestamp() });
      showToast("Added");
    }

    resetForm();
    showView("list");
  } catch (error) {
    console.error(error);
    formError.textContent = "Could not save this item.";
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingId.value ? "Save Changes" : "Add to Honey List";
  }
}

function resetForm() {
  editingId.value = "";
  taskForm.reset();
  document.getElementById("priorityNormal").checked = true;
  category.value = "Home";
  saveBtn.textContent = "Add to Honey List";
  formError.textContent = "";
}

function renderTasks() {
  let tasks = [...allTasks];
  if (showOpenOnly) tasks = tasks.filter((task) => task.status !== "done");
  tasks.sort(getSorter(sortMode.value));
  taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? "item" : "items"}`;

  if (!tasks.length) {
    tasksEl.innerHTML = `<div class="empty">Nothing on the list yet.</div>`;
    return;
  }

  tasksEl.innerHTML = tasks.map(taskTemplate).join("");

  document.querySelectorAll("[data-done]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.done;
      const task = allTasks.find((item) => item.id === id);
      if (!task) return;

      try {
        await updateDoc(doc(db, "honeyTasks", id), {
          status: task.status === "done" ? "open" : "done",
          updatedAt: serverTimestamp()
        });
        showToast(task.status === "done" ? "Moved back to open" : "Marked done");
      } catch (error) {
        console.error(error);
        showToast("Could not update");
      }
    });
  });

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const task = allTasks.find((item) => item.id === button.dataset.edit);
      if (!task) return;

      editingId.value = task.id;
      title.value = task.title || "";
      description.value = task.description || "";
      dueDate.value = task.dueDate || "";
      category.value = task.category || "Home";

      const priorityInput = document.querySelector(`input[name="priority"][value="${String(task.priority || 2)}"]`);
      if (priorityInput) priorityInput.checked = true;

      saveBtn.textContent = "Save Changes";
      showView("request");
      title.focus();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.delete;
      const ok = confirm("Delete this item?");
      if (!ok) return;

      try {
        await deleteDoc(doc(db, "honeyTasks", id));
        showToast("Deleted");
      } catch (error) {
        console.error(error);
        showToast("Could not delete");
      }
    });
  });
}

function taskTemplate(task) {
  const isDone = task.status === "done";
  const priorityLabel = getPriorityLabel(task.priority);
  const dueInfo = getDueInfo(task.dueDate);
  const created = task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : "New";
  const details = task.description ? `<p>${escapeHtml(task.description)}</p>` : `<p>No extra details.</p>`;

  return `<article class="task-card ${isDone ? "done" : ""}"><div class="task-top"><div><h3>${escapeHtml(task.title || "")}</h3>${details}</div><div class="actions"><button class="icon-btn" title="Done" data-done="${task.id}">${isDone ? "↩" : "✓"}</button><button class="icon-btn" title="Edit" data-edit="${task.id}">✎</button><button class="icon-btn" title="Delete" data-delete="${task.id}">×</button></div></div><div class="meta"><span class="pill">${escapeHtml(task.category || "Other")}</span><span class="pill ${priorityLabel.className}">${priorityLabel.text}</span><span class="pill ${dueInfo.className}">${dueInfo.text}</span><span class="pill">Added: ${created}</span></div></article>`;
}

function getSorter(mode) {
  return (a, b) => {
    const statusA = a.status === "done" ? 1 : 0;
    const statusB = b.status === "done" ? 1 : 0;
    if (statusA !== statusB) return statusA - statusB;
    if (mode === "priority") return Number(b.priority || 0) - Number(a.priority || 0);
    if (mode === "newest") return getCreated(b) - getCreated(a);
    if (mode === "oldest") return getCreated(a) - getCreated(b);
    if (mode === "due") return getDue(a) - getDue(b);
    return getDue(a) - getDue(b) || Number(b.priority || 0) - Number(a.priority || 0) || getCreated(b) - getCreated(a);
  };
}

function getDue(task) { return task.dueDate ? new Date(task.dueDate + "T00:00:00").getTime() : Infinity; }
function getCreated(task) { return task.createdAt?.seconds ? task.createdAt.seconds * 1000 : 0; }
function getPriorityLabel(value) {
  if (Number(value) === 3) return { text: "High priority", className: "priority-high" };
  if (Number(value) === 1) return { text: "Low priority", className: "priority-low" };
  return { text: "Normal priority", className: "priority-normal" };
}
function getDueInfo(value) {
  if (!value) return { text: "No due date", className: "" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(value + "T00:00:00");
  const diffDays = Math.round((due - today) / 86400000);
  const pretty = due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diffDays < 0) return { text: `Overdue: ${pretty}`, className: "overdue" };
  if (diffDays === 0) return { text: "Due today", className: "today" };
  if (diffDays === 1) return { text: "Due tomorrow", className: "today" };
  return { text: `Due: ${pretty}`, className: "" };
}
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}
