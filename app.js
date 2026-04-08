const STORAGE_KEY = "duitrayaok_v1";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRm(n) {
  try {
    return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(n);
  } catch {
    return `RM ${Number(n).toFixed(2)}`;
  }
}

function sumEntries(entries) {
  return entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { children: [] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.children)) return { children: [] };
    return data;
  } catch {
    return { children: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const tplChild = document.getElementById("tpl-child");
const tplEntry = document.getElementById("tpl-entry");
const childrenRoot = document.getElementById("children-root");
const formChild = document.getElementById("form-child");
const childNameInput = document.getElementById("child-name");

let state = loadState();

function renderEntry(childId, entry) {
  const node = tplEntry.content.cloneNode(true);
  const li = node.querySelector(".entry-row");
  li.dataset.entryId = entry.id;
  node.querySelector(".entry-amount").textContent = formatRm(entry.amount);
  const note = (entry.note || "").trim();
  node.querySelector(".entry-meta").textContent = `${entry.date || "—"}${note ? ` · ${note}` : ""}`;
  node.querySelector(".js-delete-entry").addEventListener("click", () => {
    deleteEntry(childId, entry.id);
  });
  return node;
}

function render() {
  childrenRoot.replaceChildren();
  if (state.children.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-hint";
    p.textContent = "Add a child, then log each Duit Raya packet.";
    childrenRoot.appendChild(p);
    return;
  }

  for (const child of state.children) {
    const node = tplChild.content.cloneNode(true);
    const article = node.querySelector(".child");
    article.dataset.childId = child.id;
    node.querySelector(".child-title").textContent = child.name;
    const total = sumEntries(child.entries || []);
    node.querySelector(".child-total").textContent = `Total: ${formatRm(total)}`;

    const list = node.querySelector(".js-entry-list");
    const empty = node.querySelector(".js-empty");
    const entries = [...(child.entries || [])].sort((a, b) => {
      const da = String(a.date || "");
      const db = String(b.date || "");
      return db.localeCompare(da);
    });

    if (entries.length === 0) {
      empty.hidden = false;
    } else {
      empty.hidden = true;
      for (const e of entries) {
        list.appendChild(renderEntry(child.id, e));
      }
    }

    node.querySelector(".js-export").addEventListener("click", () => exportChild(child));
    node.querySelector(".js-delete-child").addEventListener("click", () => deleteChild(child.id));

    const form = node.querySelector(".js-form-entry");
    const dateInput = form.querySelector('[name="date"]');
    if (dateInput) dateInput.value = todayYmd();

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const amount = Number(fd.get("amount"));
      const date = String(fd.get("date") || "");
      const note = String(fd.get("note") || "").trim();
      if (Number.isNaN(amount) || amount < 0 || !date) return;
      addEntry(child.id, { amount, date, note });
      form.reset();
      if (dateInput) dateInput.value = todayYmd();
    });

    childrenRoot.appendChild(node);
  }
}

function addChild(name) {
  state.children.push({
    id: uid(),
    name,
    entries: [],
  });
  saveState(state);
  render();
}

function deleteChild(childId) {
  if (!confirm("Remove this child and all their entries?")) return;
  state.children = state.children.filter((c) => c.id !== childId);
  saveState(state);
  render();
}

function addEntry(childId, { amount, date, note }) {
  const child = state.children.find((c) => c.id === childId);
  if (!child) return;
  if (!Array.isArray(child.entries)) child.entries = [];
  child.entries.push({
    id: uid(),
    amount,
    date,
    note,
  });
  saveState(state);
  render();
}

function deleteEntry(childId, entryId) {
  const child = state.children.find((c) => c.id === childId);
  if (!child || !Array.isArray(child.entries)) return;
  child.entries = child.entries.filter((e) => e.id !== entryId);
  saveState(state);
  render();
}

function exportChild(child) {
  const blob = new Blob([JSON.stringify(child, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  const safe = child.name.replace(/[^\w\-]+/g, "_").slice(0, 40) || "child";
  a.download = `duitrayaok-${safe}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

formChild.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = childNameInput.value.trim();
  if (!name) return;
  addChild(name);
  childNameInput.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
