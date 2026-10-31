// ==========================================
// PROFILE PAGE — StudyNest (Full)
// Edit name, goal hours, password, avatar
// ==========================================

(function () {
  const getEl = (s) => document.querySelector(s);
  let user = null;
  let profile = null;

  const toast = (msg) => {
    const t = getEl("#toast");
    if (!t) return;
    getEl("#toastMsg").textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3000);
  };

  const esc = (s) =>
    String(s || "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

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

  // ---------- Load profile ----------
  async function loadProfile() {
    user = await window.studyNestPreview.getUser();
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const name =
      user.user_metadata?.full_name || user.email.split("@")[0];

    // Fill header
    getEl("#profileName").textContent = name;
    getEl("#profileEmail").textContent = user.email;
    getEl("#profileEmailInput").value = user.email;
    getEl("#profileId").value = user.id;
    getEl("#profileNameInput").value = name;

    // Avatar
    const avatarUrl = user.user_metadata?.avatar_url;
    if (avatarUrl) {
      getEl("#profileAvatar").innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      getEl("#profileAvatar").textContent = name.charAt(0).toUpperCase();
    }

    // Load profile row for goal hours
    if (!window.studyNestPreview.isPreviewUser(user)) {
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (!error && data) {
          profile = data;
          if (data.weekly_goal_hours) {
            getEl("#profileGoalHours").value = data.weekly_goal_hours;
          } else {
            getEl("#profileGoalHours").value = 8;
          }
        } else {
          getEl("#profileGoalHours").value = 8;
        }
      } catch (err) {
        console.warn("Profile load:", err);
        getEl("#profileGoalHours").value = 8;
      }
    } else {
      getEl("#profileGoalHours").value = 8;
    }
  }

  // ---------- Save profile ----------
  getEl("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (window.studyNestPreview.isPreviewUser(user)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const newName = getEl("#profileNameInput").value.trim();
    const goalHours = parseInt(getEl("#profileGoalHours").value, 10) || 8;

    if (!newName) {
      alert("Please enter your name.");
      return;
    }

    const btn = getEl("#saveProfileBtn");
    const original = btn.innerHTML;
    btn.innerHTML = "Saving...";
    btn.disabled = true;

    try {
      // 1) Update auth metadata
      const { error: authErr } = await supabaseClient.auth.updateUser({
        data: { full_name: newName },
      });
      if (authErr) throw authErr;

      // 2) Update profiles table (upsert)
      const { error: profErr } = await supabaseClient.from("profiles").upsert({
        id: user.id,
        full_name: newName,
        weekly_goal_hours: goalHours,
        updated_at: new Date().toISOString(),
      });
      if (profErr) console.warn("Profile table update:", profErr.message);

      // Update header
      getEl("#profileName").textContent = newName;
      if (!user.user_metadata?.avatar_url) {
        getEl("#profileAvatar").textContent = newName.charAt(0).toUpperCase();
      }

      toast("Profile updated!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  });

  // ---------- Change password ----------
  getEl("#passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = getEl("#passwordMsg");
    msg.textContent = "";
    msg.style.color = "var(--text-muted)";

    if (window.studyNestPreview.isPreviewUser(user)) {
      window.studyNestPreview.notifyUnavailable();
      return;
    }

    const pw1 = getEl("#newPassword").value;
    const pw2 = getEl("#confirmPassword").value;

    if (pw1.length < 6) {
      msg.textContent = "Password must be at least 6 characters.";
      msg.style.color = "var(--status-overdue)";
      return;
    }
    if (pw1 !== pw2) {
      msg.textContent = "Passwords do not match.";
      msg.style.color = "var(--status-overdue)";
      return;
    }

    const btn = getEl("#changePasswordBtn");
    const original = btn.innerHTML;
    btn.innerHTML = "Updating...";
    btn.disabled = true;

    try {
      const { error } = await supabaseClient.auth.updateUser({
        password: pw1,
      });
      if (error) throw error;

      msg.textContent = "Password updated successfully!";
      msg.style.color = "var(--status-completed)";
      getEl("#passwordForm").reset();
      toast("Password changed!");
    } catch (err) {
      msg.textContent = "Error: " + err.message;
      msg.style.color = "var(--status-overdue)";
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  });

  // ---------- Avatar upload ----------
  const avatarWrap = getEl("#profileAvatarWrap");
  const avatarInput = getEl("#avatarInput");

  if (avatarWrap && avatarInput) {
    avatarWrap.addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", async function (e) {
      const file = e.target.files[0];
      if (!file) return;

      if (window.studyNestPreview.isPreviewUser(user)) {
        window.studyNestPreview.notifyUnavailable();
        return;
      }

      try {
        const ext = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${ext}`;

        const uploadResult = await supabaseClient.storage
          .from("avatars")
          .upload(fileName, file, { upsert: true });

        if (uploadResult.error) throw uploadResult.error;

        const urlResult = supabaseClient.storage
          .from("avatars")
          .getPublicUrl(fileName);
        const publicUrl = urlResult.data.publicUrl;

        const { error: updErr } = await supabaseClient.auth.updateUser({
          data: { avatar_url: publicUrl },
        });
        if (updErr) throw updErr;

        getEl("#profileAvatar").innerHTML = `<img src="${publicUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        toast("Avatar updated!");
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  }

  // ---------- Logout ----------
  const doLogout = async (e) => {
    if (e) e.preventDefault();
    if (user && !window.studyNestPreview.isPreviewUser(user)) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "login.html";
  };

  getEl("#logoutBtn")?.addEventListener("click", doLogout);
  getEl("#logoutBtnDanger")?.addEventListener("click", doLogout);

  // ---------- Boot ----------
  loadProfile();

  if (window.lucide) lucide.createIcons();
})();