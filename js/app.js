let currentUser = null;
let tasks = [];
let sessions = [];

document.addEventListener("DOMContentLoaded", () => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const TODAY = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const RING_C = 2 * Math.PI * 52;

  const fmtTime = t => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtShort = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function effStatus(t) {
    if (t.status === "Completed") return "Completed";
    if (new Date(t.due + "T23:59:59") < new Date()) return "Overdue";
    return t.status;
  }
  function statusClass(s) {
    return { Completed: "status-completed", Pending: "status-pending", "In Progress": "status-progress", Overdue: "status-overdue" }[s] || "";
  }
  function setRing(el, pct) {
    if (!el) return;
    el.style.strokeDasharray = RING_C;
    el.style.strokeDashoffset = RING_C * (1 - pct / 100);
  }
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    $("#toastMsg").textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  const menuBtn = document.getElementById("menuBtn");
  const overlay = document.getElementById("overlay");
  if (menuBtn) menuBtn.addEventListener("click", () => document.body.classList.add("nav-open"));
  if (overlay) overlay.addEventListener("click", () => document.body.classList.remove("nav-open"));

  function openModal(type) {
    if (type === "task") {
      $("#taskForm").reset();
      $("#taskForm").due.value = toISO(addDays(TODAY, 1));
      $("#taskModal").classList.add("open");
    } else {
      $("#sessionForm").reset();
      $("#sessionForm").date.value = toISO(TODAY);
      $("#sessionForm").start_time.value = "09:00";
      $("#sessionForm").end_time.value = "10:00";
      populateTaskSelect();
      $("#sessionModal").classList.add("open");
    }
  }

  function closeModal(type) {
    $(`#${type}Modal`).classList.remove("open");
  }

  $$("[data-modal]").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.getAttribute("data-modal")));
  });
  $$("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
  });
  $$(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal.id.replace("Modal", "")); });
  });

  $$(".nav-item[data-page]").forEach(el => {
    el.addEventListener("click", () => {
      $$(".nav-item[data-page]").forEach(n => n.classList.remove("active"));
      el.classList.add("active");
      $$(".page").forEach(p => p.classList.remove("active"));
      $("#page-" + el.dataset.page).classList.add("active");
      document.body.classList.remove("nav-open");
    });
  });

  $$("[data-goto]").forEach(el => {
    el.addEventListener("click", () => {
      const page = el.dataset.goto;
      $$(".nav-item[data-page]").forEach(n => n.classList.toggle("active", n.dataset.page === page));
      $$(".page").forEach(p => p.classList.remove("active"));
      $("#page-" + page).classList.add("active");
      document.body.classList.remove("nav-open");
    });
  });

  $$(".switch").forEach(sw => sw.addEventListener("click", () => sw.classList.toggle("on")));

  async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = "login.html";
      return;
    }
    currentUser = session.user;

    const name = currentUser.user_metadata?.full_name || currentUser.email.split("@")[0];
    $("#userName").textContent = name;
    $("#userAvatar").textContent = name.charAt(0).toUpperCase();
    $("#profileName").textContent = name;
    $("#profileName2").textContent = name;
    $("#profileEmail").textContent = currentUser.email;
    $("#profileAvatar").textContent = name.charAt(0).toUpperCase();
    $("#profileId").textContent = currentUser.id;

    loadData();
  }

  async function loadData() {
    const [tRes, sRes] = await Promise.all([
      supabaseClient.from("tasks").select("*").eq("user_id", currentUser.id).order("due", { ascending: true }),
      supabaseClient.from("sessions").select("*").eq("user_id", currentUser.id).order("date", { ascending: true })
    ]);
    if (tRes.error) throw tRes.error;
    if (sRes.error) throw sRes.error;
    if (tRes.data) tasks = tRes.data;
    if (sRes.data) sessions = sRes.data;
    renderAll();
  }

  function populateTaskSelect() {
    const sel = $("#relatedTaskSelect");
    if (!sel) return;
    sel.innerHTML = '<option value="">None</option>' + tasks.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("");
  }

  function computeStats() {
    return {
      total: tasks.length,
      completed: tasks.filter(t => t.status === "Completed").length,
      pending: tasks.filter(t => effStatus(t) === "Pending").length,
      inprog: tasks.filter(t => effStatus(t) === "In Progress").length,
      overdue: tasks.filter(t => effStatus(t) === "Overdue").length
    };
  }

  function renderAll() {
    renderDashboard();
    renderTasks();
    renderPlanner();
    renderCalendar();
    renderProgress();
    populateTaskSelect();
  }

  function renderDashboard() {
    const s = computeStats();
    $("#statTotal").textContent = s.total;
    $("#statCompleted").textContent = s.completed;
    $("#statPending").textContent = s.pending;
    $("#statOverdue").textContent = s.overdue;

    const todays = sessions.filter(x => x.date === toISO(TODAY));
    $("#todaySchedule").innerHTML = todays.length
      ? todays.map(x => `
        <div class="schedule-item">
          <div class="sched-time">${fmtTime(x.start_time)} – ${fmtTime(x.end_time)}</div>
          <div><p class="sched-title">${esc(x.title)}</p><p class="sched-sub">${esc(x.subject)}</p></div>
        </div>`).join("")
      : `<p class="empty" style="text-align:center;color:gray;padding:20px;">No study sessions scheduled for today.</p>`;

    const upcoming = tasks.filter(t => effStatus(t) !== "Completed").slice(0, 4);
    $("#upcomingTasksBody").innerHTML = upcoming.length
      ? upcoming.map(t => `
        <tr>
          <td data-label="Task"><span class="cell-title">${esc(t.title)}</span></td>
          <td data-label="Subject">${esc(t.subject)}</td>
          <td data-label="Due">${fmtShort(t.due)}</td>
          <td data-label="Status"><span class="status ${statusClass(effStatus(t))}">${effStatus(t)}</span></td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="text-align:center;color:gray;">No upcoming tasks.</td></tr>`;

    const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
    setRing($("#dashRing"), pct);
    $("#dashPct").textContent = pct + "%";
    $("#dashCompletedLine").textContent = `${s.completed} of ${s.total} tasks completed`;
  }

  const taskState = { q: "", status: "All Tasks", priority: "All Priorities", type: "All Types" };
  $("#taskSearch").addEventListener("input", e => { taskState.q = e.target.value; renderTasks(); });
  $("#priorityFilter").addEventListener("change", e => { taskState.priority = e.target.value; renderTasks(); });
  $("#typeFilter").addEventListener("change", e => { taskState.type = e.target.value; renderTasks(); });
  $$("#statusChips .chip").forEach(c => c.addEventListener("click", () => {
    $$("#statusChips .chip").forEach(x => x.classList.remove("active"));
    c.classList.add("active");
    taskState.status = c.dataset.status;
    renderTasks();
  }));

  function renderTasks() {
    const q = taskState.q.toLowerCase();
    const list = tasks.filter(t => {
      if (q && !(t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q))) return false;
      if (taskState.status !== "All Tasks" && effStatus(t) !== taskState.status) return false;
      if (taskState.priority !== "All Priorities" && t.priority !== taskState.priority) return false;
      if (taskState.type !== "All Types" && t.type !== taskState.type) return false;
      return true;
    });

    $("#taskCount").textContent = `${list.length} tasks`;
    $("#taskTableBody").innerHTML = list.length
      ? list.map(t => {
          const st = effStatus(t);
          return `<tr>
            <td data-label="Task"><span class="cell-title">${esc(t.title)}</span>${t.description ? `<span class="cell-sub">${esc(t.description)}</span>` : ""}</td>
            <td data-label="Subject">${esc(t.subject)}</td>
            <td data-label="Type">${esc(t.type)}</td>
            <td data-label="Due Date">${fmtDate(t.due)}</td>
            <td data-label="Priority"><span style="font-size:12.5px;font-weight:600;color:${t.priority === "High" ? "var(--red)" : t.priority === "Medium" ? "var(--orange)" : "#16A34A"}">${t.priority}</span></td>
            <td data-label="Status"><span class="status ${statusClass(st)}">${st}</span></td>
            <td data-label="Actions" class="cell-actions">
              <div class="row-actions">
                <button class="mini-btn toggle-complete-btn" data-id="${t.id}" data-status="${t.status}"><svg class="icon"><use href="#i-check"/></svg></button>
                <button class="mini-btn danger delete-task-btn" data-id="${t.id}"><svg class="icon"><use href="#i-trash"/></svg></button>
              </div>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="7" style="text-align:center;color:gray;padding:20px;">No tasks found.</td></tr>`;

    $$(".toggle-complete-btn").forEach(btn => btn.addEventListener("click", async () => {
      const newStatus = btn.dataset.status === "Completed" ? "Pending" : "Completed";
      const { error } = await supabaseClient.from("tasks").update({ status: newStatus }).eq("id", btn.dataset.id).eq("user_id", currentUser.id);
      if (error) {
        toast("Could not update task: " + error.message);
        return;
      }
      loadData();
    }));
    $$(".delete-task-btn").forEach(btn => btn.addEventListener("click", async () => {
      if (!confirm("Delete this task?")) return;
      const { error } = await supabaseClient.from("tasks").delete().eq("id", btn.dataset.id).eq("user_id", currentUser.id);
      if (error) {
        toast("Could not delete task: " + error.message);
        return;
      }
      loadData();
    }));
  }

  const SLOT_START = 8, SLOT_COUNT = 10, SLOT_H = 56;
  let plannerMode = "week";
  let viewDate = new Date(TODAY);

  $$("#viewToggle button").forEach(b => b.addEventListener("click", () => {
    $$("#viewToggle button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    plannerMode = b.dataset.view;
    renderPlanner();
  }));
  $("#prevRange").addEventListener("click", () => { viewDate = addDays(viewDate, plannerMode === "week" ? -7 : -1); renderPlanner(); });
  $("#nextRange").addEventListener("click", () => { viewDate = addDays(viewDate, plannerMode === "week" ? 7 : 1); renderPlanner(); });
  $("#todayBtn").addEventListener("click", () => { viewDate = new Date(TODAY); renderPlanner(); });

  function renderPlanner() {
    const days = plannerMode === "week"
      ? [...Array(7)].map((_, i) => addDays(viewDate, -viewDate.getDay() + i))
      : [viewDate];
    $("#plannerRoot").classList.toggle("day-mode", plannerMode === "day");

    if (plannerMode === "week") {
      $("#plannerTitle").textContent = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      $("#plannerTitle").textContent = viewDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }

    $("#plannerDays").style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
    $("#plannerDays").innerHTML = days.map(d => `<div class="ph-day ${toISO(d) === toISO(TODAY) ? "is-today" : ""}">${d.toLocaleDateString("en-US", { weekday: "short" })}<span>${d.getDate()}</span></div>`).join("");

    $("#plannerTimes").innerHTML = [...Array(SLOT_COUNT)].map((_, i) => `<div class="p-time">${(SLOT_START + i) % 12 === 0 ? 12 : (SLOT_START + i) % 12} ${(SLOT_START + i) >= 12 ? "PM" : "AM"}</div>`).join("");

    $("#plannerCols").style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
    $("#plannerCols").innerHTML = days.map(d => {
      const iso = toISO(d);
      const events = sessions.filter(s => s.date === iso).map(s => {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        const startH = sh + sm / 60, endH = eh + em / 60;
        const top = (startH - SLOT_START) * SLOT_H;
        const height = Math.max((endH - startH) * SLOT_H - 4, 26);
        if (startH < SLOT_START || startH >= SLOT_START + SLOT_COUNT) return "";
        return `<div class="p-event" style="top:${top}px;height:${height}px"><b>${esc(s.title)}</b><small>${esc(s.subject)} · ${fmtTime(s.start_time)}</small></div>`;
      }).join("");
      return `<div class="p-col" style="height:${SLOT_COUNT * SLOT_H}px">${events}</div>`;
    }).join("");
  }

  let calCursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  $("#prevMonth").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
  $("#nextMonth").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
  $("#curMonth").addEventListener("click", () => { calCursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); renderCalendar(); });

  function renderCalendar() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    $("#calTitle").textContent = calCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstDow = new Date(y, m, 1).getDay();
    const prevDays = new Date(y, m, 0).getDate();
    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--) cells.push({ date: new Date(y, m - 1, prevDays - i), other: true });
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(y, m, d), other: false });
    while (cells.length < 42) cells.push({ date: addDays(cells[cells.length - 1].date, 1), other: true });

    $("#calGrid").innerHTML = cells.map(c => {
      const iso = toISO(c.date);
      const evs = [];
      tasks.forEach(t => {
        if (t.due === iso) {
          const st = effStatus(t);
          evs.push({ label: t.title, type: st === "Completed" ? "done" : st === "Overdue" ? "overdue" : (t.type === "Exam" || t.type === "Examination" || t.type === "Quiz") ? "exam" : "task" });
        }
      });
      sessions.forEach(s => { if (s.date === iso) evs.push({ label: s.title, type: "session" }); });

      return `<div class="cal-cell ${c.other ? "other" : ""} ${iso === toISO(TODAY) ? "today" : ""}">
        <span class="cal-daynum">${c.date.getDate()}</span>
        <div class="cal-events">${evs.slice(0, 2).map(e => `<span class="cal-chip chip-${e.type}">${esc(e.label)}</span>`).join("")}${evs.length > 2 ? `<span style="font-size:10px;font-weight:700;color:var(--gray);">+${evs.length - 2} more</span>` : ""}</div>
      </div>`;
    }).join("");
  }

  function renderProgress() {
    const s = computeStats();
    $("#progTotal").textContent = s.total;
    $("#progCompleted").textContent = s.completed;
    $("#progInProgress").textContent = s.inprog;
    $("#progPending").textContent = s.pending;
    $("#progOverdue").textContent = s.overdue;

    const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
    setRing($("#progRing"), pct);
    $("#progPct").textContent = pct + "%";
    $("#progCompletedLine").textContent = `${s.completed} of ${s.total} tasks completed`;

    const rows = [
      { label: "Completed", value: s.completed, color: "var(--green)" },
      { label: "In Progress", value: s.inprog, color: "var(--purple)" },
      { label: "Pending", value: s.pending, color: "var(--orange)" },
      { label: "Overdue", value: s.overdue, color: "var(--red)" }
    ];
    $("#statusBars").innerHTML = rows.map(r => {
      const w = s.total ? (r.value / s.total) * 100 : 0;
      return `<div class="bar-row"><span class="bar-label">${r.label}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${r.color}"></div></div><span class="bar-count">${r.value}</span></div>`;
    }).join("");

    const subjects = [...new Set(tasks.map(t => t.subject))];
    $("#subjectBars").innerHTML = subjects.length
      ? subjects.map(sub => {
          const all = tasks.filter(t => t.subject === sub);
          const done = all.filter(t => t.status === "Completed").length;
          const w = all.length ? (done / all.length) * 100 : 0;
          return `<div class="bar-row"><span class="bar-label">${esc(sub)}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:var(--purple)"></div></div><span class="bar-count">${done}/${all.length}</span></div>`;
        }).join("")
      : '<p style="text-align:center;color:gray;padding:20px;">Add tasks to see subject breakdowns.</p>';
  }

  $("#taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const newTask = {
      user_id: currentUser.id,
      title: f.title.value.trim(),
      subject: f.subject.value.trim(),
      type: f.type.value,
      description: f.description.value.trim(),
      due: f.due.value,
      priority: f.priority.value,
      status: f.status.value
    };
    const { error } = await supabaseClient.from("tasks").insert([newTask]);
    if (error) alert(error.message);
    else { closeModal("task"); f.reset(); toast("Task saved."); loadData(); }
  });

  $("#sessionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const newSession = {
      user_id: currentUser.id,
      title: f.title.value.trim(),
      subject: f.subject.value.trim(),
      date: f.date.value,
      start_time: f.start_time.value,
      end_time: f.end_time.value,
      notes: f.notes.value.trim(),
      task_id: f.task_id.value || null
    };
    const { error } = await supabaseClient.from("sessions").insert([newSession]);
    if (error) alert(error.message);
    else { closeModal("session"); f.reset(); toast("Session saved."); loadData(); }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

  checkSession();
});