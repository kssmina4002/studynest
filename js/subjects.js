// ==========================================
// SUBJECTS PAGE — StudyNest (Full)
// CRUD for subjects with colors, progress, details
// ==========================================

let currentUser = null;
let subjects = [];
let tasks = [];
let sessions = [];
let subjectToDelete = null;

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

  initSubjectsPage();
});

async function initSubjectsPage() {
  const getEl = (s) => document.querySelector(s);
  const getAll = (s) => document.querySelectorAll(s);

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const fmtDate = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const fmtShortDate = (iso) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "—";

  const toast = (msg) => {
    const t = getEl("#toast");
    if (!t) return;
    getEl("#toastMsg").textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3000);
  };

  const effStatus = (t) => {
    if (t.status === "Completed") return "Completed";
    if (t.due && new Date(t.due + "T23:59:59") < new Date()) return "Overdue";
    return t.status || "Not Started";
  };

  const minutesBetween = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
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
      subjects = [];
      tasks = [];
      sessions = [];
      render();
      return;
    }

    try {
      const [sRes, tRes, sessRes] = await Promise.all([
        supabaseClient
          .from("subjects")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("name"),
        supabaseClient.from("tasks").select("*").eq("user_id", currentUser.id),
        supabaseClient.from("sessions").select("*").eq("user_id", currentUser.id),
      ]);

      if (sRes.error) throw sRes.error;
      if (tRes.error) throw tRes.error;
      if (sessRes.error) throw sessRes.error;

      subjects = sRes.data || [];
      tasks = tRes.data || [];
      sessions = sessRes.data || [];
      render();
    } catch (err) {
      alert("Error loading subjects: " + err.message);
    }
  }

  // ---------- Render grid ----------
  function render() {
    const grid = getEl("#subjectsGrid");
    if (!grid) return;

    if (subjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <h4>No subjects yet</h4>
          <p>Add your first subject to organize your tasks and sessions.</p>
          <button class="btn btn-primary" onclick="openSubjectModal('add')">
            + Add Subject
          </button>
        </div>`;
      return;
    }

    grid.innerHTML = subjects
      .map((s) => {
        const subjTasks = tasks.filter(
          (t) => t.subject === s.name || t.subject_id === s.id
        );
        const subjSessions = sessions.filter(
          (x) => x.subject === s.name || x.subject_id === s.id
        );
        const done = subjTasks.filter((t) => t.status === "Completed").length;
        const pct = subjTasks.length
          ? Math.round((done / subjTasks.length) * 100)
          : 0;
        const totalMin = subjSessions.reduce(
          (sum, x) => sum + minutesBetween(x.start_time, x.end_time),
          0
        );
        const hours = Math.floor(totalMin / 60);
        const mins = totalMin % 60;

        return `<div class="subject-full-card" style="--subject-color:${s.color || "#d946ef"};">
          <div class="subject-full-header">
            <div>
              <h3>${esc(s.name)}</h3>
              <div class="subj-meta">${
                s.code ? esc(s.code) + " · " : ""
              }${s.instructor ? esc(s.instructor) : "No instructor"}</div>
            </div>
            <div class="subject-color-dot" style="background:${s.color || "#d946ef"};"></div>
          </div>

          <div class="subject-stats">
            <div class="subject-stat">
              <div class="subject-stat-label">Tasks</div>
              <div class="subject-stat-value">${done}/${subjTasks.length}</div>
            </div>
            <div class="subject-stat">
              <div class="subject-stat-label">Study Time</div>
              <div class="subject-stat-value" style="font-size:16px;">${hours}h ${mins}m</div>
            </div>
          </div>

          <div class="subject-progress-bar" style="margin-bottom:10px;">
            <div class="subject-progress-fill" style="width:${pct}%; background:${s.color || "#d946ef"};"></div>
          </div>
          <p class="subject-next" style="margin-bottom:14px;">${pct}% complete</p>

          <div class="subject-actions">
            <button class="btn btn-ghost btn-sm view-subject-btn" data-id="${s.id}" style="flex:1;">View Details</button>
            <button class="mini-btn edit-subject-btn" data-id="${s.id}" title="Edit">
              <i data-lucide="edit" class="icon"></i>
            </button>
            <button class="mini-btn danger delete-subject-btn" data-id="${s.id}" title="Delete">
              <i data-lucide="trash-2" class="icon"></i>
            </button>
          </div>
        </div>`;
      })
      .join("");

    if (window.lucide) lucide.createIcons();

    getAll(".view-subject-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        openSubjectDetail(this.dataset.id);
      });
    });

    getAll(".edit-subject-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        openSubjectModal("edit", this.dataset.id);
      });
    });

    getAll(".delete-subject-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        subjectToDelete = this.dataset.id;
        getEl("#deleteSubjectModal").classList.add("open");
      });
    });
  }

  // ---------- Open form modal ----------
  window.openSubjectModal = function (mode, id) {
    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const form = getEl("#subjectForm");
    form.reset();

    if (mode === "add") {
      getEl("#subjectId").value = "";
      getEl("#subjectModalTitle").textContent = "Add Subject";
      getEl("#subjectColor").value = "#d946ef";
      getEl("#colorValue").textContent = "#d946ef";
    } else if (mode === "edit") {
      const s = subjects.find((x) => x.id === id);
      if (!s) return;

      getEl("#subjectId").value = s.id;
      getEl("#subjectName").value = s.name || "";
      getEl("#subjectCode").value = s.code || "";
      getEl("#subjectInstructor").value = s.instructor || "";
      getEl("#subjectColor").value = s.color || "#d946ef";
      getEl("#colorValue").textContent = s.color || "#d946ef";
      getEl("#subjectStart").value = s.semester_start || "";
      getEl("#subjectEnd").value = s.semester_end || "";
      getEl("#subjectModalTitle").textContent = "Edit Subject";
    }

    getEl("#subjectModal").classList.add("open");
  };

  // ---------- Color live update ----------
  getEl("#subjectColor").addEventListener("input", function () {
    getEl("#colorValue").textContent = this.value;
  });

  // ---------- Submit form ----------
  getEl("#subjectForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const id = getEl("#subjectId").value.trim();
    const name = getEl("#subjectName").value.trim();

    if (!name) {
      alert("Please enter a subject name.");
      getEl("#subjectName").focus();
      return;
    }

    // Check duplicate name (different id)
    const duplicate = subjects.find(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== id
    );
    if (duplicate) {
      alert(`You already have a subject named "${name}".`);
      return;
    }

    const payload = {
      user_id: currentUser.id,
      name,
      code: getEl("#subjectCode").value.trim() || null,
      instructor: getEl("#subjectInstructor").value.trim() || null,
      color: getEl("#subjectColor").value || "#d946ef",
      semester_start: getEl("#subjectStart").value || null,
      semester_end: getEl("#subjectEnd").value || null,
    };

    const btn = getEl("#saveSubjectBtn");
    const original = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
      if (id) {
        const { error } = await supabaseClient
          .from("subjects")
          .update(payload)
          .eq("id", id)
          .eq("user_id", currentUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("subjects")
          .insert([payload]);
        if (error) throw error;
      }

      window.closeModal("subjectModal");
      toast(id ? "Subject updated!" : "Subject added!");
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  });

  // ---------- Detail modal ----------
  function openSubjectDetail(id) {
    const s = subjects.find((x) => x.id === id);
    if (!s) return;

    const subjTasks = tasks
      .filter((t) => t.subject === s.name || t.subject_id === s.id)
      .sort((a, b) => (a.due || "").localeCompare(b.due || ""));
    const subjSessions = sessions
      .filter((x) => x.subject === s.name || x.subject_id === s.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);

    const done = subjTasks.filter((t) => t.status === "Completed").length;
    const pct = subjTasks.length ? Math.round((done / subjTasks.length) * 100) : 0;
    const totalMin = sessions
      .filter((x) => x.subject === s.name || x.subject_id === s.id)
      .reduce((sum, x) => sum + minutesBetween(x.start_time, x.end_time), 0);

    const upcoming = subjTasks
      .filter((t) => t.status !== "Completed" && t.due)
      .slice(0, 5);

    getEl("#subjectDetailTitle").textContent = s.name;

    getEl("#subjectDetailBody").innerHTML = `
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:24px; padding:16px; background:rgba(255,255,255,0.03); border-radius:12px; border-left:4px solid ${s.color || "#d946ef"};">
        <div><strong style="color:#fff;">${esc(s.name)}</strong>
          ${s.code ? `<br><span style="font-size:13px;color:var(--text-muted);">${esc(s.code)}</span>` : ""}
          ${s.instructor ? `<br><span style="font-size:13px;color:var(--text-muted);">${esc(s.instructor)}</span>` : ""}
        </div>
      </div>

      <div class="form-grid" style="margin-bottom:24px;">
        <div class="review-stat" style="text-align:left;padding:16px;">
          <h4 style="font-size:20px;">${pct}%</h4>
          <p>Completion</p>
        </div>
        <div class="review-stat" style="text-align:left;padding:16px;">
          <h4 style="font-size:20px;">${Math.floor(totalMin / 60)}h ${totalMin % 60}m</h4>
          <p>Total Study</p>
        </div>
      </div>

      <h4 style="font-family:var(--font-head); font-size:16px; margin:0 0 12px; color:#fff;">Upcoming Tasks</h4>
      ${
        upcoming.length === 0
          ? '<p style="color:var(--text-muted); font-size:13px; padding:12px; text-align:center;">No upcoming tasks.</p>'
          : upcoming
              .map(
                (t) => `
          <div style="display:flex; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px;">
            <div>
              <strong style="color:#fff;font-size:14px;">${esc(t.title)}</strong>
              <div style="font-size:12px;color:var(--text-muted);">${esc(t.type || "")} · ${fmtShortDate(t.due)}</div>
            </div>
            <span class="priority-badge priority-${(t.priority || "Medium").toLowerCase()}">${esc(t.priority || "Medium")}</span>
          </div>`
              )
              .join("")
      }

      <h4 style="font-family:var(--font-head); font-size:16px; margin:24px 0 12px; color:#fff;">Recent Sessions</h4>
      ${
        subjSessions.length === 0
          ? '<p style="color:var(--text-muted); font-size:13px; padding:12px; text-align:center;">No study sessions yet.</p>'
          : subjSessions
              .map(
                (x) => `
          <div style="display:flex; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:8px; margin-bottom:8px;">
            <div>
              <strong style="color:#fff;font-size:14px;">${esc(x.title)}</strong>
              <div style="font-size:12px;color:var(--text-muted);">${fmtShortDate(x.date)}</div>
            </div>
            <span style="font-weight:700; color:var(--primary); font-size:13px;">${minutesBetween(x.start_time, x.end_time)} min</span>
          </div>`
              )
              .join("")
      }
    `;

    getEl("#subjectDetailModal").classList.add("open");
    if (window.lucide) lucide.createIcons();
  }

  // ---------- Delete subject ----------
  getEl("#confirmDeleteSubjectBtn").addEventListener("click", async function () {
    if (!subjectToDelete) return;

    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const btn = getEl("#confirmDeleteSubjectBtn");
    btn.textContent = "Deleting...";
    btn.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("subjects")
        .delete()
        .eq("id", subjectToDelete)
        .eq("user_id", currentUser.id);
      if (error) throw error;

      window.closeModal("deleteSubjectModal");
      toast("Subject deleted!");
      subjectToDelete = null;
      await loadData();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.textContent = "Delete Subject";
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