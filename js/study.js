// ==========================================
// STUDY TIMER — StudyNest (Debugged Dropdown)
// ==========================================

(function () {
  const getEl = (s) => document.querySelector(s);
  const getAll = (s) => document.querySelectorAll(s);

  // ---------- State ----------
  let totalSeconds = 25 * 60;
  let remaining = totalSeconds;
  let timerId = null;
  let isRunning = false;
  let mode = "focus";
  let user = null;
  let subjects = [];
  let lastSessionId = null;
  let selectedRating = 0;

  // ---------- Elements ----------
  const display = getEl("#timerDisplay");
  const label = getEl("#timerLabel");
  const startBtn = getEl("#startBtn");
  const pauseBtn = getEl("#pauseBtn");
  const resetBtn = getEl("#resetBtn");
  const historyList = getEl("#historyList");
  const subjectSelect = getEl("#timerSubject");
  const titleInput = getEl("#timerTitle");
  const focusRatingBox = getEl("#focusRatingBox");
  const saveRatingBtn = getEl("#saveRatingBtn");
  const skipRatingBtn = getEl("#skipRatingBtn");

  // ---------- Helpers ----------
  const fmt = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const pad = (n) => String(n).padStart(2, "0");

  const fmtTime = (d) =>
    `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  const isoDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const updateDisplay = () => {
    if (!display) return;
    display.textContent = fmt(remaining);
    document.title = isRunning
      ? `${fmt(remaining)} — StudyNest`
      : "Study Timer — StudyNest";
  };

  // ---------- Mobile sidebar ----------
  const menuBtn = getEl("#menuBtn");
  const overlay = getEl("#mobileOverlay");
  const sidebar = getEl("#sidebar");
  if (menuBtn && overlay && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.add("mobile-open");
      overlay.classList.add("show");
    });
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      overlay.classList.remove("show");
    });
  }

  // ---------- Timer control ----------
  function stop() {
    isRunning = false;
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    if (startBtn) startBtn.style.display = "inline-flex";
    if (pauseBtn) pauseBtn.style.display = "none";
  }

  function start() {
    if (isRunning || !startBtn || startBtn.disabled) return;

    isRunning = true;
    startBtn.style.display = "none";
    if (pauseBtn) pauseBtn.style.display = "inline-flex";

    if (label) {
      label.textContent = mode === "focus" ? "Focusing…" : "On a break…";
    }

    timerId = setInterval(() => {
      if (remaining <= 0) {
        complete();
        return;
      }
      remaining--;
      updateDisplay();
    }, 1000);
  }

  // ---------- Complete ----------
  async function complete() {
    stop();
    if (startBtn) startBtn.disabled = true;

    const subjectName = subjectSelect?.value || "";
    const customTitle = (titleInput?.value || "").trim();
    const modeSnapshot = mode;
    const totalSnapshot = totalSeconds;

    if (label) label.textContent = "Session complete! 🎉";

    if (modeSnapshot !== "focus") {
      setTimeout(() => {
        if (startBtn) startBtn.disabled = false;
        remaining = totalSeconds;
        updateDisplay();
        if (label) label.textContent = "Ready to focus";
      }, 2200);
      return;
    }

    const finalTitle = customTitle || (subjectName ? `Study ${subjectName}` : "Focus Session");
    const finalSubject = subjectName || "General Study";

    if (!user || window.studyNestPreview.isPreviewUser(user)) {
      setTimeout(() => {
        if (startBtn) startBtn.disabled = false;
        remaining = totalSeconds;
        updateDisplay();
        if (label) label.textContent = "Ready to focus";
      }, 2200);
      return;
    }

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - totalSnapshot * 1000);

      const payload = {
        user_id: user.id,
        subject: finalSubject,
        title: finalTitle,
        date: isoDate(now),
        start_time: fmtTime(startTime),
        end_time: fmtTime(now),
        actual_minutes: Math.round(totalSnapshot / 60),
        notes: "Logged from Study Timer",
      };

      const subjectObj = subjects.find((s) => s.name === finalSubject);
      if (subjectObj) payload.subject_id = subjectObj.id;

      const { data, error } = await supabaseClient
        .from("sessions")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      lastSessionId = data.id;
      selectedRating = 0;
      showRatingUI();
      loadHistory();
    } catch (err) {
      console.error("Failed to save session:", err);
      if (label) label.textContent = "Session complete, but could not be saved";
      setTimeout(() => {
        if (startBtn) startBtn.disabled = false;
        remaining = totalSeconds;
        updateDisplay();
        if (label) label.textContent = "Ready to focus";
      }, 2500);
    }
  }

  // ---------- Rating UI ----------
  function showRatingUI() {
    if (!focusRatingBox) return;
    focusRatingBox.classList.add("show");
    selectedRating = 0;
    getAll(".focus-star").forEach((b) => b.classList.remove("active"));
    if (saveRatingBtn) saveRatingBtn.style.display = "none";
  }

  function hideRatingUI() {
    if (focusRatingBox) focusRatingBox.classList.remove("show");
    if (startBtn) startBtn.disabled = false;
    remaining = totalSeconds;
    updateDisplay();
    if (label) label.textContent = "Ready to focus";
  }

  getAll(".focus-star").forEach((btn) => {
    btn.addEventListener("click", function () {
      selectedRating = parseInt(this.dataset.rating, 10);
      getAll(".focus-star").forEach((b) => b.classList.remove("active"));
      getAll(".focus-star").forEach((b) => {
        if (parseInt(b.dataset.rating, 10) <= selectedRating) {
          b.classList.add("active");
        }
      });
      if (saveRatingBtn) saveRatingBtn.style.display = "inline-flex";
    });
  });

  if (saveRatingBtn) {
    saveRatingBtn.addEventListener("click", async () => {
      if (!lastSessionId || selectedRating === 0) {
        hideRatingUI();
        return;
      }
      if (window.studyNestPreview.isPreviewUser(user)) {
        hideRatingUI();
        return;
      }
      try {
        const { error } = await supabaseClient
          .from("sessions")
          .update({ focus_rating: selectedRating })
          .eq("id", lastSessionId)
          .eq("user_id", user.id);
        if (error) throw error;
        loadHistory();
      } catch (err) {
        console.warn("Could not save rating:", err);
      }
      hideRatingUI();
    });
  }

  if (skipRatingBtn) {
    skipRatingBtn.addEventListener("click", () => hideRatingUI());
  }

  // ---------- Load history ----------
  async function loadHistory() {
    if (!user || !historyList) return;

    if (window.studyNestPreview.isPreviewUser(user)) {
      historyList.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No sessions yet.</p>';
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        historyList.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">No sessions yet.</p>';
        return;
      }

      historyList.innerHTML = data.map((s) => {
          const rating = s.focus_rating ? ` · ${"★".repeat(s.focus_rating)}` : "";
          return `<div class="history-item">
            <div>
              <div class="subject">${esc(s.subject)}${rating}</div>
              <div class="title">${esc(s.title)}</div>
            </div>
            <span class="duration">${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}</span>
          </div>`;
        }).join("");
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  // ---------- Load subjects dropdown ----------
  async function loadDropdowns() {
    if (!user) return;

    if (window.studyNestPreview.isPreviewUser(user)) {
      if (subjectSelect) subjectSelect.innerHTML = '<option value="">Preview Mode (No Subjects)</option>';
      return;
    }

    try {
      // Fetch subjects
      const { data, error } = await supabaseClient
        .from("subjects")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) {
        console.error("Supabase error loading subjects:", error);
        alert("Database error loading subjects: " + error.message);
        return;
      }

      subjects = data || [];
      console.log("Loaded subjects:", subjects); // Debug log

      if (subjectSelect) {
        let html = '<option value="">Select Subject</option>';
        if (subjects.length === 0) {
          html = '<option value="">No subjects found (Add one in My Subjects)</option>';
        } else {
          subjects.forEach((s) => {
            html += `<option value="${esc(s.name)}">${esc(s.name)}</option>`;
          });
        }
        subjectSelect.innerHTML = html;
      }
    } catch (err) {
      console.error("Catch error loading dropdowns:", err);
      alert("Unexpected error: " + err.message);
    }
  }

  // ---------- Event listeners ----------
  if (startBtn) startBtn.addEventListener("click", start);
  if (pauseBtn) pauseBtn.addEventListener("click", () => { stop(); if (label) label.textContent = "Paused"; });
  if (resetBtn) resetBtn.addEventListener("click", () => {
      stop(); if (startBtn) startBtn.disabled = false;
      remaining = totalSeconds; updateDisplay();
      if (label) label.textContent = "Ready to focus";
      hideRatingUI();
    });

  const modeBtns = document.querySelectorAll("#modeTabs button");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const mins = parseInt(btn.dataset.min, 10);
      mode = mins === 25 ? "focus" : "break";
      totalSeconds = mins * 60;

      stop();
      if (startBtn) startBtn.disabled = false;
      remaining = totalSeconds;
      updateDisplay();
      if (label) label.textContent = "Ready to focus";
      hideRatingUI();
    });
  });

  const logoutBtn = getEl("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (user && !window.studyNestPreview.isPreviewUser(user)) {
        await supabaseClient.auth.signOut();
      }
      window.location.href = "login.html";
    });
  }

  // ---------- Boot ----------
  (async function () {
    try {
      user = await window.studyNestPreview.getUser();
      if (!user) {
        window.location.href = "login.html";
        return;
      }
      
      // Load history first
      loadHistory();
      
      // Wait a tiny bit to ensure DOM is ready, then load dropdowns
      setTimeout(loadDropdowns, 100);
      
    } catch (err) {
      console.error("Session error:", err);
      window.location.href = "login.html";
    }
  })();

  updateDisplay();

  if (window.lucide) lucide.createIcons();
})();