

document.addEventListener("DOMContentLoaded", function () {
  const path = window.location.pathname;

  if (path.includes("planner.html")) initPlanner();
  if (path.includes("calendar.html")) initCalendar();
  if (path.includes("progress.html")) initProgress();

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const user = await getSession();
      if (user && !window.studyNestPreview.isPreviewUser(user)) {
        await supabaseClient.auth.signOut();
      }
      window.location.href = "login.html";
    });
  }

  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("mobileOverlay");
  const sidebar = document.getElementById("sidebar");
  if (menuBtn && sidebar && overlay) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.add("mobile-open");
      overlay.classList.add("show");
    });
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      overlay.classList.remove("show");
    });
  }
});

async function getSession() {
  try {
    return await window.studyNestPreview.getUser();
  } catch (err) {
    console.error("Session error:", err);
    return null;
  }
}

const SN_esc = (s) =>
  String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
const SN_toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
const SN_addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const SN_fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${
    h >= 12 ? "PM" : "AM"
  }`;
};
const SN_minutesBetween = (s, e) => {
  if (!s || !e) return 0;
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};


async function initPlanner() {
  const user = await getSession();
  if (!user) return (window.location.href = "login.html");

  const getEl = (s) => document.querySelector(s);
  const getAll = (s) => document.querySelectorAll(s);

  const TODAY = new Date(new Date().setHours(0, 0, 0, 0));
  const START_HOUR = 8;
  const END_HOUR = 20;
  const ROW_PX = 80;

  let currentDate = new Date(TODAY);
  let sessions = [];
  let tasks = [];
  let subjects = [];
  let activeDetailId = null;
  let activeDeleteId = null;

  const fmtLongDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  function toast(msg, kind) {
    const t = getEl("#toast");
    if (!t) return;
    getEl("#toastMsg").textContent = msg;
    t.style.background =
      kind === "error" ? "var(--status-overdue)" : "var(--text-main)";
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  const openModal = (id) =>
    document.getElementById(id)?.classList.add("open");
  const closeModal = (id) =>
    document.getElementById(id)?.classList.remove("open");

  async function loadSessions() {
    if (window.studyNestPreview.isPreviewUser(user)) {
      sessions = [];
      tasks = [];
      subjects = [];
      renderPlanner();
      return;
    }

    showState("loading");
    try {
      const [sRes, tRes, subjRes] = await Promise.all([
        supabaseClient
          .from("sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true }),
        supabaseClient.from("tasks").select("*").eq("user_id", user.id),
        supabaseClient.from("subjects").select("*").eq("user_id", user.id),
      ]);

      if (sRes.error) throw sRes.error;
      if (tRes.error) throw tRes.error;
      if (subjRes.error) throw subjRes.error;

      sessions = sRes.data || [];
      tasks = tRes.data || [];
      subjects = subjRes.data || [];
      renderPlanner();
    } catch (err) {
      showState("error", err.message);
    }
  }

  function showState(kind, message) {
    const stateEl = getEl("#plannerState");
    const bodyEl = getEl("#plannerBody");
    if (bodyEl) bodyEl.style.display = "none";
    if (!stateEl) return;

    if (kind === "loading") {
      stateEl.innerHTML =
        '<div class="planner-state-inner"><p>Loading your study schedule…</p></div>';
      return;
    }
    if (kind === "empty") {
      stateEl.innerHTML = `
        <div class="planner-state-inner">
          <h3>No Study Sessions Yet</h3>
          <p>Plan your first study session.</p>
          <button class="btn btn-primary" onclick="document.getElementById('addSessionBtn').click()">
            + Add Study Session
          </button>
        </div>`;
      return;
    }
    if (kind === "error") {
      stateEl.innerHTML = `
        <div class="planner-state-inner error">
          <h3>Unable to load</h3>
          <p>${SN_esc(message || "Please try again.")}</p>
          <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        </div>`;
    }
  }

  function hideState() {
    const stateEl = getEl("#plannerState");
    const bodyEl = getEl("#plannerBody");
    if (stateEl) stateEl.innerHTML = "";
    if (bodyEl) bodyEl.style.display = "grid";
  }

  function renderPlanner() {
    renderWeekHeader();
    renderTimeColumn();
    if (sessions.length === 0) {
      showState("empty");
      return;
    }
    hideState();
    renderDayColumns();
    if (window.lucide) lucide.createIcons();
  }

  function getWeekStart(d) {
    const offset = (d.getDay() + 6) % 7;
    return SN_addDays(d, -offset);
  }

  function renderWeekHeader() {
    const startOfWeek = getWeekStart(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(SN_addDays(startOfWeek, i));

    const titleEl = getEl("#plannerTitle");
    if (titleEl) {
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        titleEl.textContent = `${first.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })} – ${last.getDate()}, ${last.getFullYear()}`;
      } else {
        titleEl.textContent = `${first.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} – ${last.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;
      }
    }

    const daysEl = getEl("#plannerDays");
    if (daysEl) {
      let html = '<div class="planner-day-header"></div>';
      days.forEach((d) => {
        const isToday = SN_toISO(d) === SN_toISO(TODAY);
        html += `<div class="planner-day-header ${
          isToday ? "active" : ""
        }">${d.toLocaleDateString("en-US", {
          weekday: "short",
        })}<span>${d.getDate()}</span></div>`;
      });
      daysEl.innerHTML = html;
    }
  }

  function renderTimeColumn() {
    const timesEl = getEl("#plannerTimes");
    if (!timesEl) return;
    let html = "";
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const suffix = h >= 12 ? "PM" : "AM";
      const hh = h % 12 === 0 ? 12 : h % 12;
      html += `<div class="planner-time-slot">${hh} ${suffix}</div>`;
    }
    timesEl.innerHTML = html;
    timesEl.style.height = `${(END_HOUR - START_HOUR) * ROW_PX}px`;
  }

  function renderDayColumns() {
    const startOfWeek = getWeekStart(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(SN_addDays(startOfWeek, i));

    const gridEl = getEl("#plannerGrid");
    if (!gridEl) return;

    const totalHeight = (END_HOUR - START_HOUR) * ROW_PX;
    let html = "";

    days.forEach((d) => {
      const iso = SN_toISO(d);
      const daySessions = sessions.filter((s) => s.date === iso);
      let eventsHtml = "";

      daySessions.forEach((s) => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const visStart = START_HOUR * 60;
        const visEnd = END_HOUR * 60;
        if (endMin <= visStart || startMin >= visEnd) return;

        const top = ((Math.max(startMin, visStart) - visStart) / 60) * ROW_PX;
        const height =
          ((Math.min(endMin, visEnd) - Math.max(startMin, visStart)) / 60) *
          ROW_PX;
        const isCompact = height < 50;
        const linkedTask = s.task_id ? tasks.find((t) => t.id === s.task_id) : null;

        eventsHtml += `<div class="planner-session ${
          isCompact ? "compact" : ""
        }" style="top:${top}px; height:${height}px;" data-id="${s.id}">
          <b>${SN_esc(s.title)}</b>
          <span class="ps-subject">${SN_esc(s.subject || "General")}</span>
          <span class="ps-time">${SN_fmtTime(s.start_time)}–${SN_fmtTime(
          s.end_time
        )}</span>
          ${
            linkedTask
              ? `<span class="planner-task-link">🔗 ${SN_esc(
                  linkedTask.title
                )}</span>`
              : ""
          }
        </div>`;
      });

      html += `<div class="planner-col" style="height:${totalHeight}px;">${eventsHtml}</div>`;
    });

    gridEl.innerHTML = html;
    gridEl.querySelectorAll(".planner-session").forEach((card) => {
      card.addEventListener("click", () => openDetail(card.dataset.id));
    });
  }

  function clearFormErrors() {
    [
      "#errTitle",
      "#errSubject",
      "#errDate",
      "#errStart",
      "#errEnd",
      "#errForm",
    ].forEach((id) => {
      const el = getEl(id);
      if (el) el.textContent = "";
    });
    ["#sfTitle", "#sfSubject", "#sfDate", "#sfStart", "#sfEnd"].forEach((id) => {
      const el = getEl(id);
      if (el) el.style.borderColor = "";
    });
  }

  function setFieldError(field, err, msg) {
    const f = getEl(field);
    const e = getEl(err);
    if (f) f.style.borderColor = "var(--status-overdue)";
    if (e) e.textContent = msg;
  }

  function populateTaskSelect(selectedId) {
    const sel = getEl("#sfTask");
    if (!sel) return;
    const openTasks = tasks.filter((t) => t.status !== "Completed");
    let html = '<option value="">None</option>';
    openTasks.forEach((t) => {
      html += `<option value="${t.id}" ${
        selectedId === t.id ? "selected" : ""
      }>${SN_esc(t.title)} (${SN_esc(t.subject || "")})</option>`;
    });
    sel.innerHTML = html;
  }

  function populateSubjectDatalist() {
    const dl = getEl("#subjectOptions");
    if (!dl) return;
    const names = new Set(subjects.map((s) => s.name).filter(Boolean));
    tasks.forEach((t) => t.subject && names.add(t.subject));
    dl.innerHTML = Array.from(names)
      .map((n) => `<option value="${SN_esc(n)}"></option>`)
      .join("");
  }

  function openFormForAdd() {
    if (window.studyNestPreview.isPreviewUser(user)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }
    clearFormErrors();
    getEl("#sessionForm").reset();
    getEl("#sessionId").value = "";
    getEl("#sessionFormTitle").textContent = "Schedule a Study Session";

    const now = new Date();
    getEl("#sfDate").value = SN_toISO(now);
    const startH = Math.min(now.getHours() + 1, END_HOUR - 1);
    const endH = Math.min(startH + 1, END_HOUR);
    getEl("#sfStart").value = `${String(startH).padStart(2, "0")}:00`;
    getEl("#sfEnd").value = `${String(endH).padStart(2, "0")}:00`;

    populateTaskSelect(null);
    populateSubjectDatalist();
    openModal("sessionFormModal");
  }

  function openFormForEdit(s) {
    clearFormErrors();
    getEl("#sessionId").value = s.id;
    getEl("#sessionFormTitle").textContent = "Edit Study Session";
    getEl("#sfTitle").value = s.title || "";
    getEl("#sfSubject").value = s.subject || "";
    getEl("#sfDate").value = s.date || "";
    getEl("#sfStart").value = s.start_time || "";
    getEl("#sfEnd").value = s.end_time || "";
    getEl("#sfNotes").value = s.notes || "";

    populateTaskSelect(s.task_id || null);
    populateSubjectDatalist();
    openModal("sessionFormModal");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    if (window.studyNestPreview.isPreviewUser(user)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const id = getEl("#sessionId").value.trim();
    const title = getEl("#sfTitle").value.trim();
    const subject = getEl("#sfSubject").value.trim();
    const date = getEl("#sfDate").value;
    const start = getEl("#sfStart").value;
    const end = getEl("#sfEnd").value;
    const notes = getEl("#sfNotes").value.trim();
    const taskId = getEl("#sfTask").value || null;

    let valid = true;
    if (!title) {
      setFieldError("#sfTitle", "#errTitle", "Title required.");
      valid = false;
    }
    if (!subject) {
      setFieldError("#sfSubject", "#errSubject", "Subject required.");
      valid = false;
    }
    if (!date) {
      setFieldError("#sfDate", "#errDate", "Date required.");
      valid = false;
    }
    if (!start) {
      setFieldError("#sfStart", "#errStart", "Start time required.");
      valid = false;
    }
    if (!end) {
      setFieldError("#sfEnd", "#errEnd", "End time required.");
      valid = false;
    }
    if (start && end && end <= start) {
      setFieldError("#sfEnd", "#errEnd", "End must be after start.");
      valid = false;
    }
    if (!valid) return;

    // Overlap check
    const conflict = sessions.find(
      (s) =>
        s.id !== id &&
        s.date === date &&
        !(end <= s.start_time || start >= s.end_time)
    );
    if (conflict) {
      const ok = confirm(
        `You already have "${conflict.title}" from ${SN_fmtTime(
          conflict.start_time
        )} to ${SN_fmtTime(conflict.end_time)} on that day.\n\nSave anyway?`
      );
      if (!ok) return;
    }

    const subjObj = subjects.find((s) => s.name === subject);
    const payload = {
      user_id: user.id,
      title,
      subject,
      subject_id: subjObj ? subjObj.id : null,
      date,
      start_time: start,
      end_time: end,
      task_id: taskId,
      notes: notes || null,
    };

    const btn = getEl("#saveSessionBtn");
    const original = btn.textContent;
    btn.textContent = "Saving…";
    btn.disabled = true;

    try {
      if (id) {
        const { error } = await supabaseClient
          .from("sessions")
          .update(payload)
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("sessions")
          .insert([payload]);
        if (error) throw error;
      }
      closeModal("sessionFormModal");
      toast(id ? "Session updated!" : "Session saved!");
      await loadSessions();
    } catch (err) {
      const errEl = getEl("#errForm");
      if (errEl) {
        errEl.textContent = "Error: " + err.message;
        errEl.style.display = "block";
      } else {
        alert("Error: " + err.message);
      }
    } finally {
      btn.textContent = original;
      btn.disabled = false;
    }
  }

  function openDetail(id) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    activeDetailId = id;

    const linked = s.task_id ? tasks.find((t) => t.id === s.task_id) : null;
    const body = getEl("#sessionDetailBody");
    body.innerHTML = `
      <div style="margin-bottom:16px;">
        <h2 style="font-family:var(--font-head);font-size:20px;margin:0 0 6px;">${SN_esc(
          s.title
        )}</h2>
        <span style="color:var(--primary);font-weight:600;font-size:13px;">${SN_esc(
          s.subject || "General"
        )}</span>
      </div>
      <div class="form-grid" style="margin-bottom:16px;">
        <div><label style="font-size:12px;color:var(--text-muted);">Date</label>
          <p style="margin:4px 0 0;">${fmtLongDate(s.date)}</p></div>
        <div><label style="font-size:12px;color:var(--text-muted);">Time</label>
          <p style="margin:4px 0 0;">${SN_fmtTime(s.start_time)} – ${SN_fmtTime(
      s.end_time
    )}</p></div>
      </div>
      ${
        linked
          ? `<div style="margin-bottom:16px;"><label style="font-size:12px;color:var(--text-muted);">Linked Task</label>
        <p style="margin:4px 0 0;font-weight:600;">🔗 ${SN_esc(
          linked.title
        )}</p></div>`
          : ""
      }
      <div><label style="font-size:12px;color:var(--text-muted);">Notes</label>
        <p style="margin:4px 0 0;font-size:14px;line-height:1.5;background:var(--bg-main);padding:12px;border-radius:8px;">${
          s.notes
            ? SN_esc(s.notes)
            : '<em style="color:var(--text-muted);">No notes.</em>'
        }</p></div>
    `;
    openModal("sessionDetailModal");
    if (window.lucide) lucide.createIcons();
  }

  async function handleDeleteConfirmed() {
    if (window.studyNestPreview.isPreviewUser(user)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }
    if (!activeDeleteId) return;

    const btn = getEl("#confirmDeleteBtn");
    const orig = btn.textContent;
    btn.textContent = "Deleting…";
    btn.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("sessions")
        .delete()
        .eq("id", activeDeleteId)
        .eq("user_id", user.id);
      if (error) throw error;
      closeModal("deleteConfirmModal");
      activeDetailId = null;
      activeDeleteId = null;
      toast("Session deleted!");
      await loadSessions();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.textContent = orig;
      btn.disabled = false;
    }
  }

  
  getEl("#addSessionBtn")?.addEventListener("click", openFormForAdd);
  getEl("#prevWeek")?.addEventListener("click", () => {
    currentDate = SN_addDays(currentDate, -7);
    renderPlanner();
  });
  getEl("#nextWeek")?.addEventListener("click", () => {
    currentDate = SN_addDays(currentDate, 7);
    renderPlanner();
  });
  getEl("#todayBtn")?.addEventListener("click", () => {
    currentDate = new Date(TODAY);
    renderPlanner();
  });
  getAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-close");
      if (t) closeModal(t);
    });
  });
  getAll(".modal-backdrop").forEach((b) => {
    b.addEventListener("click", (e) => {
      if (e.target === b) b.classList.remove("open");
    });
  });
  getEl("#sessionForm")?.addEventListener("submit", handleSubmit);
  getEl("#detailEditBtn")?.addEventListener("click", () => {
    if (!activeDetailId) return;
    const s = sessions.find((x) => x.id === activeDetailId);
    if (!s) return;
    closeModal("sessionDetailModal");
    openFormForEdit(s);
  });
  getEl("#detailDeleteBtn")?.addEventListener("click", () => {
    if (!activeDetailId) return;
    activeDeleteId = activeDetailId;
    closeModal("sessionDetailModal");
    openModal("deleteConfirmModal");
  });
  getEl("#confirmDeleteBtn")?.addEventListener("click", handleDeleteConfirmed);

  await loadSessions();
}


async function initCalendar() {
  const user = await getSession();
  if (!user) return (window.location.href = "login.html");

  const getEl = (s) => document.querySelector(s);
  const TODAY = new Date(new Date().setHours(0, 0, 0, 0));

  let currentMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  let tasks = [];
  let sessions = [];
  let subjects = [];

  if (!window.studyNestPreview.isPreviewUser(user)) {
    try {
      const [tRes, sRes, subRes] = await Promise.all([
        supabaseClient.from("tasks").select("*").eq("user_id", user.id),
        supabaseClient.from("sessions").select("*").eq("user_id", user.id),
        supabaseClient.from("subjects").select("*").eq("user_id", user.id),
      ]);
      if (tRes.error) throw tRes.error;
      if (sRes.error) throw sRes.error;
      if (subRes.error) throw subRes.error;
      tasks = tRes.data || [];
      sessions = sRes.data || [];
      subjects = subRes.data || [];
    } catch (err) {
      console.error("Calendar load error:", err);
    }
  }

  function render() {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const titleEl = getEl("#calTitle");
    if (titleEl) {
      titleEl.textContent = currentMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    let html = '<div class="cal-grid">';
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((n) => {
      html += `<div class="cal-day-name">${n}</div>`;
    });

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(y, m - 1, prevDays - i), other: true });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(y, m, i), other: false });
    }
    while (cells.length < 42) {
      cells.push({
        date: SN_addDays(cells[cells.length - 1].date, 1),
        other: true,
      });
    }

    cells.forEach((c) => {
      const iso = SN_toISO(c.date);
      const isToday = iso === SN_toISO(TODAY);
      const dayTasks = tasks.filter((t) => t.due === iso);
      const daySessions = sessions.filter((s) => s.date === iso);

      let events = "";
      dayTasks.slice(0, 2).forEach((t) => {
        const isExam = (t.type || "").toLowerCase() === "exam";
        const isOverdue =
          t.status !== "Completed" && new Date(t.due + "T23:59:59") < new Date();
        const cls = isExam ? "overdue" : isOverdue ? "overdue" : "task";
        events += `<div class="cal-event ${cls}">${SN_esc(t.title)}</div>`;
      });
      daySessions.slice(0, 2).forEach((s) => {
        events += `<div class="cal-event session">${SN_esc(s.title)}</div>`;
      });
      const total = dayTasks.length + daySessions.length;
      if (total > 2) {
        events += `<div style="font-size:10px;color:var(--text-muted);text-align:center;">+${
          total - 2
        } more</div>`;
      }

      html += `<div class="cal-cell ${
        c.other ? "other" : ""
      } ${isToday ? "today" : ""}" data-date="${iso}">
        <span class="cal-day-num">${c.date.getDate()}</span>
        ${events}
      </div>`;
    });

    html += "</div>";
    const container = getEl("#calGridContainer");
    if (container) {
      container.innerHTML = html;
      container.querySelectorAll(".cal-cell").forEach((cell) => {
        cell.addEventListener("click", () => openDayDetail(cell.dataset.date));
      });
    }
  }

  function openDayDetail(iso) {
    if (!iso) return;

    const dayTasks = tasks.filter((t) => t.due === iso);
    const daySessions = sessions.filter((s) => s.date === iso);
    const dateLabel = new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const titleEl = getEl("#dayDetailTitle");
    if (titleEl) titleEl.textContent = dateLabel;

    const body = getEl("#dayDetailBody");
    if (!body) return;

    if (dayTasks.length === 0 && daySessions.length === 0) {
      body.innerHTML =
        '<p style="text-align:center;color:var(--text-muted);padding:30px;">Nothing scheduled on this day.</p>';
    } else {
      let html = '<div class="cal-day-detail-list">';
      dayTasks.forEach((t) => {
        const isExam = (t.type || "").toLowerCase() === "exam";
        const cls = isExam ? "exam" : "task";
        html += `<div class="cal-day-detail-item ${cls}">
          <strong>${SN_esc(t.title)}</strong>
          <span>${SN_esc(t.subject || "")} · ${SN_esc(t.type || "")} · ${
          t.priority || ""
        }</span>
        </div>`;
      });
      daySessions.forEach((s) => {
        html += `<div class="cal-day-detail-item session">
          <strong>${SN_esc(s.title)}</strong>
          <span>${SN_esc(s.subject || "")} · ${SN_fmtTime(
          s.start_time
        )} – ${SN_fmtTime(s.end_time)}</span>
        </div>`;
      });
      html += "</div>";
      body.innerHTML = html;
    }

    document.getElementById("dayDetailModal")?.classList.add("open");
    if (window.lucide) lucide.createIcons();
  }

  getEl("#prevMonth")?.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    render();
  });
  getEl("#nextMonth")?.addEventListener("click", () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    render();
  });
  getEl("#curMonth")?.addEventListener("click", () => {
    currentMonth = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    render();
  });
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-close");
      if (target) document.getElementById(target)?.classList.remove("open");
    });
  });
  document.querySelectorAll(".modal-backdrop").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.remove("open");
    });
  });

  render();
}


async function initProgress() {
  const user = await getSession();
  if (!user) return (window.location.href = "login.html");

  const getEl = (s) => document.querySelector(s);
  const RING_C = 2 * Math.PI * 52;
  const TODAY = new Date(new Date().setHours(0, 0, 0, 0));

  let taskList = [];
  let sessionList = [];

  if (!window.studyNestPreview.isPreviewUser(user)) {
    try {
      const [tRes, sRes] = await Promise.all([
        supabaseClient.from("tasks").select("*").eq("user_id", user.id),
        supabaseClient.from("sessions").select("*").eq("user_id", user.id),
      ]);
      if (tRes.error) throw tRes.error;
      if (sRes.error) throw sRes.error;
      taskList = tRes.data || [];
      sessionList = sRes.data || [];
    } catch (err) {
      console.error("Insights load error:", err);
    }
  }

  const effStatus = (t) => {
    if (t.status === "Completed") return "Completed";
    if (t.due && new Date(t.due + "T23:59:59") < new Date()) return "Overdue";
    return t.status || "Not Started";
  };

  const total = taskList.length;
  const completed = taskList.filter((t) => t.status === "Completed").length;
  const inprog = taskList.filter((t) => effStatus(t) === "In Progress").length;
  const pending = taskList.filter((t) => {
    const s = effStatus(t);
    return s === "Not Started" || s === "Pending";
  }).length;
  const overdue = taskList.filter((t) => effStatus(t) === "Overdue").length;

  const setText = (id, v) => {
    const el = getEl(id);
    if (el) el.textContent = v;
  };
  setText("#progTotal", total);
  setText("#progCompleted", completed);
  setText("#progInProgress", inprog);
  setText("#progOverdue", overdue);

  const pct = total ? Math.round((completed / total) * 100) : 0;
  const ring = getEl("#progRing");
  if (ring) {
    ring.style.strokeDasharray = RING_C;
    ring.style.strokeDashoffset = RING_C * (1 - pct / 100);
  }
  setText("#progPct", pct + "%");
  setText("#progCompletedLine", `${completed} of ${total} tasks completed`);

  const rows = [
    { label: "Completed", value: completed, color: "var(--status-completed)" },
    { label: "In Progress", value: inprog, color: "var(--primary)" },
    { label: "Pending", value: pending, color: "var(--status-pending)" },
    { label: "Overdue", value: overdue, color: "var(--status-overdue)" },
  ];
  const sb = getEl("#statusBars");
  if (sb) {
    sb.innerHTML = rows
      .map((r) => {
        const w = total ? (r.value / total) * 100 : 0;
        return `<div class="bar-row">
          <span class="bar-label">${r.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${r.color}"></div></div>
          <span class="bar-count">${r.value}</span>
        </div>`;
      })
      .join("");
  }

  const subjects = [...new Set(taskList.map((t) => t.subject).filter(Boolean))];
  const subjBars = getEl("#subjectBars");
  if (subjBars) {
       if (subjects.length === 0) {
      subjBars.innerHTML =
        '<p style="text-align:center;color:var(--text-muted);padding:20px;">Add tasks to see subject breakdowns.</p>';
    } else {
      subjBars.innerHTML = subjects
        .map((sub) => {
          const all = taskList.filter((t) => t.subject === sub);
          const done = all.filter((t) => t.status === "Completed").length;
          const w = all.length ? (done / all.length) * 100 : 0;
          return `<div class="bar-row">
            <span class="bar-label">${SN_esc(sub)}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${w}%;background:var(--primary)"></div>
            </div>
            <span class="bar-count">${done}/${all.length}</span>
          </div>`;
        })
        .join("");
    }
  }

  
  renderHoursChart();

  
  renderWeeklyComparison();


  function renderHoursChart() {
    const chart = getEl("#hoursChart");
    if (!chart) return;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = SN_addDays(TODAY, -i);
      const iso = SN_toISO(d);
      const dayMin = sessionList
        .filter((s) => s.date === iso)
        .reduce((sum, s) => sum + SN_minutesBetween(s.start_time, s.end_time), 0);
      days.push({
        iso,
        label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3),
        minutes: dayMin,
      });
    }

    const max = Math.max(60, ...days.map((d) => d.minutes)); // at least 60 min height

    chart.innerHTML = days
      .map((d) => {
        const hPct = (d.minutes / max) * 100;
        const display = d.minutes >= 60
          ? `${Math.floor(d.minutes / 60)}h${d.minutes % 60 > 0 ? d.minutes % 60 + "m" : ""}`
          : `${d.minutes}m`;
        return `<div class="hours-bar-wrap">
          <div class="hours-bar" style="height:${Math.max(hPct, 2)}%;">
            <span class="hours-bar-value">${display}</span>
          </div>
          <span class="hours-bar-label">${d.label}</span>
        </div>`;
      })
      .join("");
  }

  
  function renderWeeklyComparison() {
    const box = getEl("#weeklyComparisonBox");
    if (!box) return;

    // This week (Mon-Sun)
    const dow = TODAY.getDay();
    const thisWeekStart = SN_addDays(TODAY, -(dow === 0 ? 6 : dow - 1));
    const lastWeekStart = SN_addDays(thisWeekStart, -7);

    const thisWeekMin = sessionList
      .filter((s) => s.date >= SN_toISO(thisWeekStart))
      .reduce((sum, s) => sum + SN_minutesBetween(s.start_time, s.end_time), 0);

    const lastWeekMin = sessionList
      .filter(
        (s) =>
          s.date >= SN_toISO(lastWeekStart) &&
          s.date < SN_toISO(thisWeekStart)
      )
      .reduce((sum, s) => sum + SN_minutesBetween(s.start_time, s.end_time), 0);

    const thisWeekDone = taskList.filter(
      (t) =>
        t.status === "Completed" &&
        t.actual_completed_at &&
        t.actual_completed_at.slice(0, 10) >= SN_toISO(thisWeekStart)
    ).length;

    const lastWeekDone = taskList.filter(
      (t) =>
        t.status === "Completed" &&
        t.actual_completed_at &&
        t.actual_completed_at.slice(0, 10) >= SN_toISO(lastWeekStart) &&
        t.actual_completed_at.slice(0, 10) < SN_toISO(thisWeekStart)
    ).length;

    const diffMin = thisWeekMin - lastWeekMin;
    const diffDone = thisWeekDone - lastWeekDone;
    const arrow = (n) => (n > 0 ? "▲" : n < 0 ? "▼" : "→");
    const color = (n) =>
      n > 0 ? "var(--status-completed)" : n < 0 ? "var(--status-overdue)" : "var(--text-muted)";

    box.innerHTML = `
      <div class="comparison-grid">
        <div class="comparison-card">
          <h4>Study Time</h4>
          <p>This week vs last week</p>
          <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:12px;">
            <span style="font-size:32px; font-weight:800; color:#fff; font-family:var(--font-head);">${Math.floor(
              thisWeekMin / 60
            )}h ${thisWeekMin % 60}m</span>
            <span style="font-size:13px; font-weight:700; color:${color(diffMin)};">
              ${arrow(diffMin)} ${Math.abs(Math.floor(diffMin / 60))}h ${Math.abs(
      diffMin % 60
    )}m
            </span>
          </div>
          <p style="font-size:13px;color:var(--text-muted);margin:0;">Last week: ${Math.floor(
            lastWeekMin / 60
          )}h ${lastWeekMin % 60}m</p>
        </div>

        <div class="comparison-card">
          <h4>Tasks Completed</h4>
          <p>This week vs last week</p>
          <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:12px;">
            <span style="font-size:32px; font-weight:800; color:#fff; font-family:var(--font-head);">${thisWeekDone}</span>
            <span style="font-size:13px; font-weight:700; color:${color(diffDone)};">
              ${arrow(diffDone)} ${Math.abs(diffDone)}
            </span>
          </div>
          <p style="font-size:13px;color:var(--text-muted);margin:0;">Last week: ${lastWeekDone}</p>
        </div>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}