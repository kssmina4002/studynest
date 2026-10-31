// ==========================================
// TASKS PAGE — StudyNest (Full)
// Subtasks, exams, recurring, validation
// ==========================================

let currentUser = null;
let tasks = [];
let subjects = [];
let taskToDelete = null;
let subtasksDraft = []; // in-memory list while editing

document.addEventListener("DOMContentLoaded", function () {
  window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("open");
  };

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-close");
      window.closeModal(target + "Modal");
    });
  });

  document.querySelectorAll(".modal-backdrop").forEach((m) => {
    m.addEventListener("click", function (e) {
      if (e.target === this) this.classList.remove("open");
    });
  });

  initTasksPage();
});

async function initTasksPage() {
  const getEl = (s) => document.querySelector(s);
  const getAll = (s) => document.querySelectorAll(s);

  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const TODAY = new Date();

  const fmtDate = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const effStatus = (t) => {
    if (t.status === "Completed") return "Completed";
    if (t.due && new Date(t.due + "T23:59:59") < new Date()) return "Overdue";
    return t.status || "Not Started";
  };

  const statusClass = (s) => {
    if (s === "Completed") return "status-completed";
    if (s === "Pending" || s === "Not Started") return "status-pending";
    if (s === "In Progress") return "status-progress";
    if (s === "Overdue") return "status-overdue";
    return "";
  };

  const priorityClass = (p) => {
    if (p === "High") return "priority-high";
    if (p === "Medium") return "priority-medium";
    if (p === "Low") return "priority-low";
    return "";
  };

  const toast = (msg) => {
    const t = getEl("#toast");
    if (!t) return;
    getEl("#toastMsg").textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3000);
  };

  // ---------- Mobile sidebar ----------
  const menuBtn = getEl("#menuBtn");
  const overlay = getEl("#mobileOverlay");
  const sidebar = getEl("#sidebar");
  if (menuBtn) menuBtn.addEventListener("click", () => {
    sidebar.classList.add("mobile-open");
    overlay.classList.add("show");
  });
  if (overlay) overlay.addEventListener("click", () => {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("show");
  });

  // ---------- Session ----------
  currentUser = await window.studyNestPreview.getUser();
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  // ---------- Load data ----------
  async function loadData() {
    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      tasks = [];
      subjects = [];
      render();
      return;
    }

    try {
      const [tRes, sRes] = await Promise.all([
        supabaseClient
          .from("tasks")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("due", { ascending: true, nullsFirst: false }),
        supabaseClient
          .from("subjects")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("name"),
      ]);

      if (tRes.error) throw tRes.error;
      if (sRes.error) throw sRes.error;

      tasks = tRes.data || [];
      subjects = sRes.data || [];

      populateSubjectFilter();
      populateSubjectDatalist();
      render();
    } catch (err) {
      alert("Error loading tasks: " + err.message);
    }
  }

  function populateSubjectFilter() {
    const set = new Set(subjects.map((s) => s.name).filter(Boolean));
    tasks.forEach((t) => t.subject && set.add(t.subject));
    const names = Array.from(set);

    const filter = getEl("#filterSubject");
    const cur = filter.value;

    let html = '<option value="All">All Subjects</option>';
    names.forEach((n) => {
      html += `<option value="${esc(n)}">${esc(n)}</option>`;
    });
    filter.innerHTML = html;

    if (names.includes(cur)) filter.value = cur;
  }

  function populateSubjectDatalist() {
    const dl = getEl("#subjectList");
    if (!dl) return;
    dl.innerHTML = subjects
      .map((s) => `<option value="${esc(s.name)}"></option>`)
      .join("");
  }

  // ---------- Render table ----------
  function render() {
    const q = (getEl("#taskSearch").value || "").toLowerCase();
    const fStatus = getEl("#filterStatus").value;
    const fPriority = getEl("#filterPriority").value;
    const fSubject = getEl("#filterSubject").value;
    const fType = getEl("#filterType").value;

    const filtered = tasks.filter((t) => {
      if (q) {
        const title = String(t.title || "").toLowerCase();
        const subject = String(t.subject || "").toLowerCase();
        if (!title.includes(q) && !subject.includes(q)) return false;
      }
      if (fStatus !== "All" && effStatus(t) !== fStatus) return false;
      if (fPriority !== "All" && t.priority !== fPriority) return false;
      if (fSubject !== "All" && t.subject !== fSubject) return false;
      if (fType !== "All" && t.type !== fType) return false;
      return true;
    });

    // Counters
    getEl("#taskStatTotal").textContent = tasks.length;

    let pendingCount = 0;
    tasks.forEach((t) => {
      const s = effStatus(t);
      if (s === "Not Started" || s === "Pending" || s === "In Progress") {
        pendingCount++;
      }
    });
    getEl("#taskStatPending").textContent = pendingCount;

    let completedCount = 0;
    tasks.forEach((t) => t.status === "Completed" && completedCount++);
    getEl("#taskStatCompleted").textContent = completedCount;

    getEl("#taskCount").textContent = `Showing ${filtered.length} tasks`;

    // Table body
    const tbody = getEl("#taskTableBody");

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state" style="padding: 60px 20px;">
              <h4>No Tasks Found</h4>
              <p>${
                tasks.length === 0
                  ? "Add your first task to get started."
                  : "Try changing your search or filters."
              }</p>
              <button class="btn btn-primary" onclick="openTaskModal('add')">+ Add New Task</button>
            </div>
          </td>
        </tr>`;
      return;
    }

    let html = "";
    filtered.forEach((t) => {
      const st = effStatus(t);
      const isExam = (t.type || "").toLowerCase() === "exam";
      const examDays =
        isExam && t.due
          ? Math.ceil(
              (new Date(t.due + "T23:59:59") - new Date()) / (1000 * 60 * 60 * 24)
            )
          : null;
      const examBadge =
        examDays !== null && examDays >= 0
          ? `<span class="exam-countdown">${examDays}d</span>`
          : "";

      html += `
        <tr>
          <td><span class="cell-title">${esc(t.title)}</span>${examBadge}</td>
          <td>${esc(t.subject || "—")}</td>
          <td>${esc(t.type || "—")}</td>
          <td>${fmtDate(t.due)}</td>
          <td><span class="priority-badge ${priorityClass(
            t.priority
          )}">${esc(t.priority || "Medium")}</span></td>
          <td><span class="status ${statusClass(st)}">${st}</span></td>
          <td>
            <div class="row-actions">
              <button class="mini-btn edit-task-btn" data-id="${t.id}">
                <i data-lucide="edit" class="icon"></i>
              </button>
              <button class="mini-btn danger delete-task-btn" data-id="${t.id}">
                <i data-lucide="trash-2" class="icon"></i>
              </button>
            </div>
          </td>
        </tr>`;
    });
    tbody.innerHTML = html;

    if (window.lucide) lucide.createIcons();

    getAll(".edit-task-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        openTaskModal("edit", this.dataset.id);
      });
    });

    getAll(".delete-task-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        taskToDelete = this.dataset.id;
        getEl("#deleteModal").classList.add("open");
      });
    });
  }

  // ---------- Form helpers ----------
  function renderSubtasks() {
    const list = getEl("#subtaskList");
    if (!list) return;

    if (subtasksDraft.length === 0) {
      list.innerHTML =
        '<p style="font-size:13px;color:var(--text-muted);margin:0 0 8px;">No subtasks yet.</p>';
      return;
    }

    list.innerHTML = subtasksDraft
      .map(
        (st, idx) => `
        <div class="subtask-row ${st.completed ? "completed" : ""}" data-idx="${idx}">
          <input type="checkbox" ${st.completed ? "checked" : ""} class="subtask-check">
          <span class="subtask-title">${esc(st.title)}</span>
          <button type="button" class="remove-subtask" title="Remove">
            <i data-lucide="x" class="icon" style="width:14px;height:14px;"></i>
          </button>
        </div>`
      )
      .join("");

    if (window.lucide) lucide.createIcons();

    list.querySelectorAll(".subtask-check").forEach((cb) => {
      cb.addEventListener("change", function () {
        const idx = Number(this.parentElement.dataset.idx);
        subtasksDraft[idx].completed = this.checked;
        renderSubtasks();
      });
    });

    list.querySelectorAll(".remove-subtask").forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = Number(this.parentElement.dataset.idx);
        subtasksDraft.splice(idx, 1);
        renderSubtasks();
      });
    });
  }

  function addSubtask() {
    const input = getEl("#newSubtaskInput");
    const val = input.value.trim();
    if (!val) return;
    subtasksDraft.push({ title: val, completed: false });
    input.value = "";
    renderSubtasks();
  }

  getEl("#addSubtaskBtn").addEventListener("click", addSubtask);
  getEl("#newSubtaskInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask();
    }
  });

  // Exam field toggle
  getEl("#taskType").addEventListener("change", function () {
    const isExam = this.value === "Exam";
    getEl("#examFields").style.display = isExam ? "block" : "none";
  });

  getEl("#taskReadiness").addEventListener("input", function () {
    getEl("#readinessValue").textContent = this.value;
  });

  // ---------- Open modal ----------
  window.openTaskModal = async function (mode, id) {
    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const form = getEl("#taskForm");
    form.reset();
    subtasksDraft = [];
    getEl("#examFields").style.display = "none";
    getEl("#readinessValue").textContent = "0";

    if (mode === "add") {
      getEl("#taskId").value = "";
      getEl("#taskModalTitle").textContent = "Add New Task";
      getEl("#taskDue").value = toISO(addDays(TODAY, 1));
      renderSubtasks();
    } else if (mode === "edit") {
      const task = tasks.find((x) => x.id === id);
      if (!task) return;

      getEl("#taskId").value = task.id;
      getEl("#taskTitle").value = task.title || "";
      getEl("#taskSubject").value = task.subject || "";
      getEl("#taskType").value = task.type || "Assignment";
      getEl("#taskDesc").value = task.description || "";
      getEl("#taskDue").value = task.due || "";
      getEl("#taskPriority").value = task.priority || "Medium";
      getEl("#taskEst").value = task.estimated_minutes || "";
      getEl("#taskStatus").value = task.status || "Not Started";
      getEl("#taskRecurring").value = task.recurring || "";
      getEl("#taskNotes").value = task.notes || "";

      if ((task.type || "").toLowerCase() === "exam") {
        getEl("#examFields").style.display = "block";
        getEl("#taskExamTopics").value = task.exam_topics || "";
        getEl("#taskReadiness").value = task.exam_readiness || 0;
        getEl("#readinessValue").textContent = task.exam_readiness || 0;
      }

      getEl("#taskModalTitle").textContent = "Edit Task";

      // Load subtasks
      subtasksDraft = [];
      try {
        const { data, error } = await supabaseClient
          .from("subtasks")
          .select("*")
          .eq("task_id", task.id)
          .order("position");
        if (!error && data) {
          subtasksDraft = data.map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          }));
        }
      } catch (err) {
        console.warn("Could not load subtasks:", err);
      }

      renderSubtasks();
    }

    getEl("#taskModal").classList.add("open");
  };

  // ---------- Clear filters ----------
  window.clearFilters = function () {
    getEl("#taskSearch").value = "";
    getEl("#filterStatus").value = "All";
    getEl("#filterPriority").value = "All";
    getEl("#filterSubject").value = "All";
    getEl("#filterType").value = "All";
    render();
  };

  // Filter listeners
  ["taskSearch", "filterStatus", "filterPriority", "filterSubject", "filterType"].forEach(
    (id) => {
      const el = getEl("#" + id);
      if (el) {
        el.addEventListener(id === "taskSearch" ? "input" : "change", render);
      }
    }
  );

  // ---------- Submit ----------
  getEl("#taskForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const id = getEl("#taskId").value.trim();
    const title = getEl("#taskTitle").value.trim();
    const subject = getEl("#taskSubject").value.trim();
    const due = getEl("#taskDue").value;
    const type = getEl("#taskType").value;

    if (!title) {
      alert("Please enter a task title.");
      getEl("#taskTitle").focus();
      return;
    }
    if (!subject) {
      alert("Please enter a subject.");
      getEl("#taskSubject").focus();
      return;
    }
    if (!due) {
      alert("Please select a due date.");
      getEl("#taskDue").focus();
      return;
    }

    const subjObj = subjects.find((s) => s.name === subject);
    const subject_id = subjObj ? subjObj.id : null;

    const payload = {
      user_id: currentUser.id,
      title,
      subject,
      subject_id,
      type,
      description: getEl("#taskDesc").value.trim(),
      due,
      priority: getEl("#taskPriority").value,
      status: getEl("#taskStatus").value,
      estimated_minutes: getEl("#taskEst").value
        ? parseInt(getEl("#taskEst").value, 10)
        : null,
      recurring: getEl("#taskRecurring").value || null,
      notes: getEl("#taskNotes").value.trim() || null,
    };

    if (type === "Exam") {
      payload.exam_topics = getEl("#taskExamTopics").value.trim() || null;
      payload.exam_readiness = parseInt(getEl("#taskReadiness").value, 10) || 0;
    }

    // Auto-set actual_completed_at when marking complete
    if (payload.status === "Completed") {
      payload.actual_completed_at = new Date().toISOString();
    } else {
      payload.actual_completed_at = null;
    }

    const btn = getEl("#saveTaskBtn");
    const original = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
      let taskId = id;

      if (id) {
        const { error } = await supabaseClient
          .from("tasks")
          .update(payload)
          .eq("id", id)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabaseClient
          .from("tasks")
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        taskId = data.id;
      }

      // Sync subtasks: delete all + reinsert (simplest reliable approach)
      if (taskId) {
        await supabaseClient.from("subtasks").delete().eq("task_id", taskId);
        if (subtasksDraft.length > 0) {
          const rows = subtasksDraft.map((st, idx) => ({
            task_id: taskId,
            user_id: currentUser.id,
            title: st.title,
            completed: st.completed,
            position: idx,
          }));
          const { error: stErr } = await supabaseClient
            .from("subtasks")
            .insert(rows);
          if (stErr) console.warn("Subtask save error:", stErr.message);
        }
      }

      window.closeModal("taskModal");
      toast(id ? "Task updated!" : "Task added!");
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  });

  // ---------- Delete ----------
  getEl("#confirmDeleteBtn").addEventListener("click", async function () {
    if (!taskToDelete) return;

    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const btn = getEl("#confirmDeleteBtn");
    btn.textContent = "Deleting...";
    btn.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("tasks")
        .delete()
        .eq("id", taskToDelete)
        .eq("user_id", currentUser.id);
      if (error) throw error;

      window.closeModal("deleteModal");
      toast("Task deleted!");
      taskToDelete = null;
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.textContent = "Delete Task";
      btn.disabled = false;
    }
  });

  // ---------- Logout ----------
  getEl("#logoutBtn").addEventListener("click", async function (e) {
    e.preventDefault();
    if (!window.studyNestPreview.isPreviewUser(currentUser)) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "login.html";
  });

  // ---------- Boot ----------
  await loadData();
}

