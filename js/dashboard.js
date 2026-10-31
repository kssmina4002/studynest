// ==========================================
// DASHBOARD — StudyNest (11 sections)
// Bug-free version — all sections render
// ==========================================

let currentUser = null;
let tasks = [];
let sessions = [];
let subjects = [];
let profile = null;

document.addEventListener("DOMContentLoaded", function () {
  // ---------- Utility helpers ----------
  const $ = (s) => document.querySelector(s);
  const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const TODAY = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );
  const TODAY_ISO = toISO(TODAY);

  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${
      h >= 12 ? "PM" : "AM"
    }`;
  };

  const fmtShortDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const daysUntil = (iso) => {
    if (!iso) return 9999;
    const due = new Date(iso + "T23:59:59");
    return Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
  };

  const minutesBetween = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const effStatus = (t) => {
    if (!t) return "Not Started";
    if (t.status === "Completed") return "Completed";
    if (t.due && new Date(t.due + "T23:59:59") < new Date()) return "Overdue";
    return t.status || "Not Started";
  };

  // ---------- Mobile sidebar ----------
  const menuBtn = $("#menuBtn");
  const overlay = $("#mobileOverlay");
  const sidebar = $("#sidebar");

  if (menuBtn && sidebar && overlay) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.add("mobile-open");
      overlay.classList.add("show");
    });
  }
  if (overlay && sidebar) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      overlay.classList.remove("show");
    });
  }

  // ---------- Date header ----------
  const dateEl = $("#currentDate");
  if (dateEl) {
    dateEl.textContent = TODAY.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  // ---------- Profile menu ----------
  const userAvatar = $("#userAvatar");
  const profileMenu = $("#profileMenu");

  if (userAvatar && profileMenu) {
    userAvatar.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("show");
    });
  }
  document.addEventListener("click", () => {
    if (profileMenu) profileMenu.classList.remove("show");
  });

  // ---------- Session ----------
  async function checkSession() {
    try {
      currentUser = await window.studyNestPreview.getUser();
      if (!currentUser) {
        window.location.href = "login.html";
        return;
      }

      const name =
        currentUser.user_metadata?.full_name ||
        currentUser.email.split("@")[0];

      if ($("#userName")) $("#userName").textContent = name;
      if ($("#dropdownName")) $("#dropdownName").textContent = name;
      if ($("#dropdownEmail")) $("#dropdownEmail").textContent = currentUser.email;

      if (userAvatar) {
        const url = currentUser.user_metadata?.avatar_url;
        if (url) {
          userAvatar.innerHTML = `<img src="${url}" alt="Avatar">`;
        } else {
          userAvatar.textContent = name.charAt(0).toUpperCase();
        }
      }

      await loadAll();
    } catch (err) {
      console.error("Session error:", err);
      window.location.href = "login.html";
    }
  }

  // ---------- Load all data ----------
  async function loadAll() {
    if (window.studyNestPreview.isPreviewUser(currentUser)) {
      renderAll();
      return;
    }

    try {
      const [tRes, sRes, subjRes, profRes] = await Promise.all([
        supabaseClient
          .from("tasks")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("due", { ascending: true, nullsFirst: false }),
        supabaseClient
          .from("sessions")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("date", { ascending: true }),
        supabaseClient
          .from("subjects")
          .select("*")
          .eq("user_id", currentUser.id),
        supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .maybeSingle(),
      ]);

      if (tRes.error) console.warn("tasks load:", tRes.error.message);
      if (sRes.error) console.warn("sessions load:", sRes.error.message);
      if (subjRes.error) console.warn("subjects load:", subjRes.error.message);
      if (profRes.error) console.warn("profile load:", profRes.error.message);

      tasks = tRes.data || [];
      sessions = sRes.data || [];
      subjects = subjRes.data || [];
      profile = profRes.data || null;

      renderAll();
    } catch (err) {
      console.error("Load error:", err);
    }
  }

  // ---------- Render all 11 sections ----------
  function renderAll() {
    renderSummary();
    renderTodayPlan();
    renderUpcomingDeadlines();
    renderQuickTasks();
    renderSubjectProgress();
    renderWeeklyActivity();
    renderGoals();
    renderReminders();
    renderRecentSessions();
    renderWeeklyReview();
    if (window.lucide) lucide.createIcons();
  }

  // ---------- 02 · Summary cards ----------
  function renderSummary() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "Completed").length;
    const pending = tasks.filter((t) => {
      const s = effStatus(t);
      return s === "Not Started" || s === "Pending" || s === "In Progress";
    }).length;
    const overdue = tasks.filter((t) => effStatus(t) === "Overdue").length;

    if ($("#statTotalTasks")) $("#statTotalTasks").textContent = total;
    if ($("#statCompletedTasks")) $("#statCompletedTasks").textContent = completed;
    if ($("#statPendingTasks")) $("#statPendingTasks").textContent = pending;
    if ($("#statOverdueTasks")) $("#statOverdueTasks").textContent = overdue;
  }

  // ---------- 03 · Today's Study Plan ----------
  function renderTodayPlan() {
    const grid = $("#todayActivityGrid");
    if (!grid) return;

    const todaySessions = sessions
      .filter((s) => s.date === TODAY_ISO)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

    const todayTasks = tasks.filter(
      (t) => t.due === TODAY_ISO && t.status !== "Completed"
    );

    if (todaySessions.length === 0 && todayTasks.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <h4>No study plan for today</h4>
        <p>Schedule your first session to get started.</p>
        <a href="planner.html" class="btn btn-primary">+ Plan Study Session</a>
      </div>`;
      const badge = $("#todayTimeBadge");
      if (badge) badge.textContent = "0 min";
      return;
    }

    let html = "";
    todaySessions.forEach((s) => {
      html += `<div class="activity-card">
        <div class="activity-header">
          <h5>${esc(s.subject || "General")}</h5>
          <span class="badge progress">Session</span>
        </div>
        <div class="activity-body">
          <h6>${esc(s.title)}</h6>
          <p>${minutesBetween(s.start_time, s.end_time)} min</p>
        </div>
        <div class="activity-meta">
          <i data-lucide="clock" style="width:14px;height:14px;"></i>
          ${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}
        </div>
        <a href="study.html" class="activity-btn">Start Session</a>
      </div>`;
    });

    todayTasks.forEach((t) => {
      html += `<div class="activity-card">
        <div class="activity-header">
          <h5>${esc(t.subject || "")}</h5>
          <span class="badge pending">Due Today</span>
        </div>
        <div class="activity-body">
          <h6>${esc(t.title)}</h6>
          <p>${esc(t.type || "")}</p>
        </div>
        <a href="tasks.html" class="activity-btn">Open Task</a>
      </div>`;
    });

    grid.innerHTML = html;

    const badge = $("#todayTimeBadge");
    if (badge) {
      const totalMin = todaySessions.reduce(
        (sum, s) => sum + minutesBetween(s.start_time, s.end_time),
        0
      );
      badge.textContent = `${totalMin} min`;
    }
  }

  // ---------- 04 · Upcoming Deadlines & Exams ----------
  function renderUpcomingDeadlines() {
    const list = $("#upcomingDeadlinesList");
    if (!list) return;

    const upcoming = tasks
      .filter((t) => t.status !== "Completed" && t.due)
      .filter((t) => new Date(t.due + "T23:59:59") >= new Date())
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 5);

    if (upcoming.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <h4>All caught up</h4>
        <p>No upcoming deadlines.</p>
      </div>`;
      return;
    }

    list.innerHTML = upcoming
      .map((t) => {
        const days = daysUntil(t.due);
        const isExam = (t.type || "").toLowerCase() === "exam";
        const urgent = days <= 2;
        const label =
          days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;

        return `<div class="deadline-row ${urgent ? "urgent" : ""}">
          <div class="deadline-info">
            <strong>${esc(t.title)}</strong>
            <span>${esc(t.subject || "")} · ${fmtShortDate(t.due)}${
          isExam ? " · 📝 Exam" : ""
        }</span>
          </div>
          <div class="deadline-right">
            <span class="priority-badge priority-${(
              t.priority || "Medium"
            ).toLowerCase()}">${esc(t.priority || "Medium")}</span>
            <small>${label}</small>
          </div>
        </div>`;
      })
      .join("");
  }

  // ---------- 05 · Quick Task List ----------
  function renderQuickTasks() {
    const list = $("#quickTaskList");
    if (!list) return;

    const urgent = tasks
      .filter((t) => t.status !== "Completed")
      .filter((t) => t.due === TODAY_ISO || effStatus(t) === "Overdue")
      .slice(0, 5);

    if (urgent.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <h4>Nothing urgent</h4>
        <p>Add tasks to see your priorities here.</p>
      </div>`;
      return;
    }

    list.innerHTML = urgent
      .map((t) => {
        const st = effStatus(t);
        const statusClass = st === "Overdue" ? "status-overdue" : "status-pending";
        return `<div class="quick-task-row" data-id="${t.id}">
          <input type="checkbox" class="quick-task-check" data-id="${t.id}">
          <div class="quick-task-info">
            <strong>${esc(t.title)}</strong>
            <span>${esc(t.subject || "")}${
          t.due ? " · " + fmtShortDate(t.due) : ""
        }</span>
          </div>
          <span class="status ${statusClass}">${st}</span>
        </div>`;
      })
      .join("");

    list.querySelectorAll(".quick-task-check").forEach((cb) => {
      cb.addEventListener("change", async (e) => {
        const id = e.target.dataset.id;
        if (window.studyNestPreview.isPreviewUser(currentUser)) {
          window.studyNestPreview.notifyUnavailable();
          e.target.checked = false;
          return;
        }
        const { error } = await supabaseClient
          .from("tasks")
          .update({
            status: "Completed",
            actual_completed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("user_id", currentUser.id);
        if (error) {
          alert("Error: " + error.message);
          e.target.checked = false;
          return;
        }
        loadAll();
      });
    });
  }

  // ---------- 06 · Subject Progress ----------
  function renderSubjectProgress() {
    const grid = $("#subjectProgressGrid");
    if (!grid) return;

    // Merge subject names from subjects table AND from tasks
    const names = [
      ...new Set([
        ...subjects.map((s) => s.name).filter(Boolean),
        ...tasks.map((t) => t.subject).filter(Boolean),
      ]),
    ];

    if (names.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
        <h4>No subjects yet</h4>
        <p>Add a subject or task to see progress.</p>
        <a href="subjects.html" class="btn btn-primary">+ Add Subject</a>
      </div>`;
      return;
    }

    grid.innerHTML = names
      .slice(0, 4)
      .map((name) => {
        const subjObj = subjects.find((s) => s.name === name);
        const all = tasks.filter(
          (t) =>
            t.subject === name || (subjObj && t.subject_id === subjObj.id)
        );
        const done = all.filter((t) => t.status === "Completed").length;
        const pct = all.length ? Math.round((done / all.length) * 100) : 0;
        const color = subjObj?.color || "#d946ef";

        return `<div class="subject-card">
          <div class="subject-header">
            <div>
              <h4>${esc(name)}</h4>
              <span>${pct}% Completed</span>
            </div>
            <a href="tasks.html" class="btn-link" style="font-size:13px;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:8px;">View Tasks</a>
          </div>
          <ul class="subject-tasks">
            ${all
              .slice(0, 3)
              .map((t) => `<li>• ${esc(t.title)}</li>`)
              .join("")}
          </ul>
          <div class="subject-progress-bar">
            <div class="subject-progress-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <p class="subject-next">${done} of ${all.length} tasks completed</p>
        </div>`;
      })
      .join("");
  }

  // ---------- 07 · Weekly Study Activity ----------
  function renderWeeklyActivity() {
    const container = $("#weeklyActivityGrid");
    if (!container) return;

    const weekStart = new Date(TODAY);
    const dow = TODAY.getDay();
    const diff = TODAY.getDate() - dow + (dow === 0 ? -6 : 1);
    weekStart.setDate(diff);

    let html = "";
    let totalWeekMin = 0;

    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const iso = toISO(day);

      const daySessions = sessions.filter((s) => s.date === iso);
      const dayTasksDone = tasks.filter(
        (t) => t.due === iso && t.status === "Completed"
      ).length;
      const dayMin = daySessions.reduce(
        (sum, s) => sum + minutesBetween(s.start_time, s.end_time),
        0
      );
      totalWeekMin += dayMin;

      const dayName = day
        .toLocaleDateString("en-US", { weekday: "short" })
        .slice(0, 3);

      html += `<div class="weekly-day ${iso === TODAY_ISO ? "today" : ""}">
        <span class="wd-name">${dayName}</span>
        <span class="wd-num">${day.getDate()}</span>
        <span class="wd-min">${dayMin}m</span>
        <span class="wd-done">${dayTasksDone}✓</span>
      </div>`;
    }

    container.innerHTML = html;

    const badge = $("#weeklyTotalBadge");
    if (badge) {
      badge.textContent = `${Math.floor(totalWeekMin / 60)}h ${
        totalWeekMin % 60
      }m`;
    }
  }

  // ---------- 08 · Goals & Streak ----------
  function renderGoals() {
    const box = $("#goalsBox");
    if (!box) return;

    // Weekly goal hours (default 8)
    const goalHours = profile?.weekly_goal_hours || 8;
    const weekStart = new Date(TODAY);
    const dow = TODAY.getDay();
    const diff = TODAY.getDate() - dow + (dow === 0 ? -6 : 1);
    weekStart.setDate(diff);
    const weekStartISO = toISO(weekStart);

    const weekMinutes = sessions
      .filter((s) => s.date >= weekStartISO)
      .reduce((sum, s) => sum + minutesBetween(s.start_time, s.end_time), 0);
    const weekHours = weekMinutes / 60;
    const pct = Math.min(100, Math.round((weekHours / goalHours) * 100));

    // Compute streak: consecutive days with at least 1 session
    const sessionDates = new Set(sessions.map((s) => s.date));
    let streak = 0;
    const cursor = new Date(TODAY);
    while (sessionDates.has(toISO(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    box.innerHTML = `
      <div class="goal-row">
        <div class="goal-info">
          <strong>Weekly Goal</strong>
          <span>${weekHours.toFixed(1)}h of ${goalHours}h</span>
        </div>
        <div class="goal-bar">
          <div class="goal-fill" style="width:${pct}%"></div>
        </div>
        <span class="goal-pct">${pct}%</span>
      </div>
      <div class="goal-row" style="margin-top:16px;">
        <div class="goal-info">
          <strong>Study Streak</strong>
          <span>${streak} consecutive day${streak === 1 ? "" : "s"}</span>
        </div>
        <div class="goal-streak-badge">🔥 ${streak}</div>
      </div>
    `;
  }

  // ---------- 09 · Reminders & Recommendations ----------
  function renderReminders() {
    const box = $("#remindersBox");
    if (!box) return;

    const reminders = [];

    // Overdue
    const overdue = tasks.filter((t) => effStatus(t) === "Overdue");
    if (overdue.length > 0) {
      reminders.push({
        icon: "alert-triangle",
        text: `You have ${overdue.length} overdue task${
          overdue.length > 1 ? "s" : ""
        }.`,
      });
    }

    // High priority due soon
    const urgentHigh = tasks.filter(
      (t) =>
        t.status !== "Completed" &&
        t.priority === "High" &&
        t.due &&
        daysUntil(t.due) >= 0 &&
        daysUntil(t.due) <= 3
    );
    if (urgentHigh.length > 0) {
      reminders.push({
        icon: "zap",
        text: `${urgentHigh.length} high-priority task${
          urgentHigh.length > 1 ? "s" : ""
        } due within 3 days.`,
      });
    }

    // No session today but pending tasks
    const todaySessionCount = sessions.filter(
      (s) => s.date === TODAY_ISO
    ).length;
    const pendingCount = tasks.filter(
      (t) => t.status !== "Completed"
    ).length;
    if (todaySessionCount === 0 && pendingCount > 0) {
      reminders.push({
        icon: "calendar-plus",
        text: "No study session scheduled today. Consider planning one.",
      });
    }

    // Recommended next task
    const candidates = tasks
      .filter((t) => t.status !== "Completed" && t.due)
      .sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        const pDiff = (order[a.priority] || 1) - (order[b.priority] || 1);
        if (pDiff !== 0) return pDiff;
        return a.due.localeCompare(b.due);
      });

    if (candidates.length > 0) {
      const rec = candidates[0];
      const reason =
        effStatus(rec) === "Overdue"
          ? "It's overdue."
          : daysUntil(rec.due) <= 1
          ? "It's due very soon."
          : rec.priority === "High"
          ? "It's high priority."
          : "It's your next deadline.";
      reminders.push({
        icon: "target",
        text: `Recommended next: "${rec.title}" — ${reason}`,
      });
    }

    if (reminders.length === 0) {
      box.innerHTML = `<div class="empty-state">
        <h4>You're on track! 🎉</h4>
        <p>No reminders right now. Keep up the great work.</p>
      </div>`;
      return;
    }

    box.innerHTML = reminders
      .map(
        (r) => `<div class="reminder-row">
        <i data-lucide="${r.icon}" class="icon"></i>
        <span>${esc(r.text)}</span>
      </div>`
      )
      .join("");
  }

  // ---------- 10 · Recent Study Sessions ----------
  function renderRecentSessions() {
    const list = $("#recentSessionsList");
    if (!list) return;

    const recent = sessions
      .slice()
      .sort((a, b) => {
        const aKey = `${a.date} ${a.start_time}`;
        const bKey = `${b.date} ${b.start_time}`;
        return bKey.localeCompare(aKey);
      })
      .slice(0, 5);

    if (recent.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <h4>No sessions yet</h4>
        <p>Run the timer to log your first focus session.</p>
        <a href="study.html" class="btn btn-primary">Open Study Timer</a>
      </div>`;
      return;
    }

    list.innerHTML = recent
      .map((s) => {
        const min = minutesBetween(s.start_time, s.end_time);
        return `<div class="recent-session-row">
          <div>
            <strong>${esc(s.title)}</strong>
            <span>${esc(s.subject || "")} · ${fmtShortDate(s.date)}</span>
          </div>
          <span class="duration">${min} min</span>
        </div>`;
      })
      .join("");
  }

  // ---------- 11 · Weekly Review ----------
  function renderWeeklyReview() {
    const box = $("#weeklyReviewBox");
    if (!box) return;

    const weekStart = new Date(TODAY);
    const dow = TODAY.getDay();
    const diff = TODAY.getDate() - dow + (dow === 0 ? -6 : 1);
    weekStart.setDate(diff);
    const weekStartISO = toISO(weekStart);

    const weekCompleted = tasks.filter(
      (t) =>
        t.status === "Completed" &&
        t.actual_completed_at &&
        t.actual_completed_at.slice(0, 10) >= weekStartISO
    ).length;

    const weekSessions = sessions.filter((s) => s.date >= weekStartISO);
    const weekMin = weekSessions.reduce(
      (sum, s) => sum + minutesBetween(s.start_time, s.end_time),
      0
    );

    const overdueCount = tasks.filter((t) => effStatus(t) === "Overdue").length;
    const pendingCount = tasks.filter(
      (t) => t.status !== "Completed"
    ).length;

    box.innerHTML = `
      <div class="review-grid">
        <div class="review-stat">
          <h4>${weekCompleted}</h4>
          <p>Tasks Completed</p>
        </div>
        <div class="review-stat">
          <h4>${Math.floor(weekMin / 60)}h ${weekMin % 60}m</h4>
          <p>Study Time</p>
        </div>
        <div class="review-stat">
          <h4>${pendingCount}</h4>
          <p>Tasks Remaining</p>
        </div>
        <div class="review-stat ${overdueCount > 0 ? "warning" : ""}">
          <h4>${overdueCount}</h4>
          <p>Overdue</p>
        </div>
      </div>
      ${
        overdueCount > 0
          ? `<p class="review-note">Consider rescheduling your ${overdueCount} overdue task${
              overdueCount > 1 ? "s" : ""
            } for tomorrow.</p>`
          : `<p class="review-note success">Great job — no overdue tasks this week! 🎉</p>`
      }
    `;
  }

  // ---------- Logout ----------
  const doLogout = async (e) => {
    if (e) e.preventDefault();
    if (!window.studyNestPreview.isPreviewUser(currentUser)) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "login.html";
  };

  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);

  const dropdownLogout = $("#dropdownLogout");
  if (dropdownLogout) dropdownLogout.addEventListener("click", doLogout);

  // ---------- Start ----------
  checkSession();
});