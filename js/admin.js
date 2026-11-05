

(function() {
  var currentUser = null;
  var globalTasks = [];
  var globalSessions = [];
  var globalFeedback = [];
  var globalStudents = [];
  var globalLogs = [];
  var chartActivityTrend = null;
  var chartTaskStatus = null;

  
  function initUI() {
    var menuBtn = document.getElementById("menuBtn");
    var sidebar = document.getElementById("sidebar");
    var mobileOverlay = document.getElementById("mobileOverlay");

    function closeMobileMenu() {
      if (sidebar) sidebar.classList.remove("mobile-open");
      if (mobileOverlay) mobileOverlay.classList.remove("show");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    }

    if (menuBtn && sidebar && mobileOverlay) {
      menuBtn.addEventListener("click", function() {
        sidebar.classList.add("mobile-open");
        mobileOverlay.classList.add("show");
        menuBtn.setAttribute("aria-expanded", "true");
      });
      mobileOverlay.addEventListener("click", closeMobileMenu);
      sidebar.addEventListener("click", function(e) {
        if (e.target.closest(".nav-item")) closeMobileMenu();
      });
      document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") closeMobileMenu();
      });
    }

    // Fix Date
    var currentDate = document.getElementById("currentDate");
    if (currentDate) {
      var dateObj = new Date();
      var options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      currentDate.textContent = dateObj.toLocaleDateString('en-US', options);
    }

    
    document.addEventListener("click", function(e) {
      var avatarWrapper = e.target.closest("#avatarWrapper");
      var profileMenu = document.getElementById("profileMenu");
      
     
      if (avatarWrapper && profileMenu) {
        profileMenu.classList.toggle("show");
        return; // Stop here so it doesn't immediately close
      }

      
      if (e.target.closest(".dropdown-item")) {
        return; 
      }

      
      if (profileMenu && profileMenu.classList.contains("show")) {
        profileMenu.classList.remove("show");
      }
    });

    bindSearch("#studentSearch", renderStudentsPage);
    bindSearch("#studentStatusFilter", renderStudentsPage);
    bindSearch("#taskSearch", renderTasksPage);
    bindSearch("#taskStatusFilter", renderTasksPage);
    bindSearch("#sessionSearch", renderSessionsPage);

    document.addEventListener("change", async function(e) {
      var select = e.target.closest(".feedback-status-select");
      if (!select) return;

      var previousStatus = select.dataset.status;
      var result = await supabaseClient
        .from("feedback")
        .update({ status: select.value })
        .eq("id", select.dataset.id);

      if (result.error) {
        window.alert("Could not update feedback status: " + result.error.message);
        select.value = previousStatus;
        return;
      }

      select.dataset.status = select.value;
      var feedbackItem = globalFeedback.find(function(item) { return item.id === select.dataset.id; });
      if (feedbackItem) feedbackItem.status = select.value;
      renderFeedbackPage();
    });

    
    document.addEventListener("click", function(e) {
      if (e.target.closest("#logoutBtn")) {
        e.preventDefault(); // Prevent default only for this specific button
        if (typeof supabaseClient !== 'undefined') {
          supabaseClient.auth.signOut().then(function() { window.location.href = "login.html"; });
        } else {
          window.location.href = "login.html";
        }
      }
    });

    setTimeout(function() {
      if (window.Chart) renderCharts();
    }, 100);
  }

  
  async function initAuth() {
    try {
      var response = await supabaseClient.auth.getSession();
      if (response.error) throw response.error;
      var session = response.data.session;
      if (!session) {
        window.location.href = "login.html";
        return;
      }

      currentUser = session.user;
      if (!currentUser.app_metadata || currentUser.app_metadata.role !== "admin") {
        window.location.href = "dashboard.html";
        return;
      }

      var name = currentUser.email.split("@")[0];
      if (currentUser.user_metadata && currentUser.user_metadata.full_name) {
        name = currentUser.user_metadata.full_name;
      }

      
      var userAvatar = document.getElementById("userAvatar");
      var dropdownName = document.getElementById("dropdownName");
      var dropdownEmail = document.getElementById("dropdownEmail");
      var profileName = document.getElementById("profileName");
      var profileEmail = document.getElementById("profileEmail");
      var profileId = document.getElementById("profileId");
      var profileNameInput = document.getElementById("profileName2");
      var profileAvatar = document.getElementById("profileAvatar");
      var settingsEmail = document.getElementById("settingsEmail");

      if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
      if (dropdownName) dropdownName.textContent = name;
      if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
      if (profileName) profileName.textContent = name;
      if (profileEmail) profileEmail.textContent = currentUser.email;
      if (profileId) profileId.value = currentUser.id;
      if (profileNameInput) profileNameInput.value = (currentUser.user_metadata && currentUser.user_metadata.full_name) || "";
      if (profileAvatar) profileAvatar.textContent = name.charAt(0).toUpperCase();
      if (settingsEmail) settingsEmail.value = currentUser.email || "";

      var currentPage = getCurrentPageFile();
      if (currentPage === "admin-profile.html" ||
          currentPage === "admin-settings.html") {
        routePage();
        return;
      }

      var results = await Promise.all([
        supabaseClient.from("tasks").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("sessions").select("*").order("date", { ascending: false }),
        supabaseClient.from("feedback").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabaseClient.rpc("admin_list_students")
      ]);
      var resourceNames = ["Tasks", "sessions", "feedback", "activity logs", "student list"];
      var loadErrors = [];
      results.forEach(function(result, index) {
        if (result.error) {
          loadErrors.push(resourceNames[index] + ": " + result.error.message);
          console.error("Admin " + resourceNames[index] + " load error:", result.error);
        }
      });
      globalTasks = results[0].error ? [] : results[0].data || [];
      globalSessions = results[1].error ? [] : results[1].data || [];
      globalFeedback = results[2].error ? [] : results[2].data || [];
      globalLogs = results[3].error ? [] : results[3].data || [];
      globalStudents = results[4].error ? [] : results[4].data || [];
      routePage();
      renderCharts();
      if (loadErrors.length) showAdminLoadError(loadErrors);
    } catch (err) {
      console.error("Admin data error:", err);
      showAdminLoadError(["Unable to load admin data: " + err.message]);
    }
  }

  function showAdminLoadError(messages) {
    var page = document.querySelector(".page.active") || document.querySelector(".page");
    if (!page) return;

    var banner = document.createElement("div");
    banner.className = "admin-load-error";
    banner.setAttribute("role", "alert");
    banner.textContent = "Some admin data could not load. " + messages.join(" | ");
    page.insertBefore(banner, page.firstChild);

    page.querySelectorAll("tbody").forEach(function(body) {
      var loadingCell = body.querySelector("td");
      if (loadingCell && loadingCell.textContent.trim() === "Loading...") {
        loadingCell.textContent = "Data could not load. See the error above.";
      }
    });
  }

  
  function getCurrentPageFile() {
    var path = window.location.pathname.replace(/\/+$/, "");
    var page = path.slice(path.lastIndexOf("/") + 1);
    return page.indexOf(".") === -1 ? page + ".html" : page;
  }

  function routePage() {
    var page = getCurrentPageFile();

    if (page === "admin-dashboard.html") renderDashboard();
    else if (page === "admin-reports.html") renderReports();
    else if (page === "admin-calendar.html") renderCalendar();
    else if (page === "admin-students.html") renderStudentsPage();
    else if (page === "admin-tasks.html") renderTasksPage();
    else if (page === "admin-sessions.html") renderSessionsPage();
    else if (page === "admin-logs.html") renderLogsPage();
    else if (page === "admin-feedback.html") renderFeedbackPage();
    else if (page === "admin-profile.html") renderAdminProfile();
    else if (page === "admin-settings.html") renderAdminSettings();

    if (window.lucide) lucide.createIcons();
  }

  // 4. PAGE RENDERERS
  function renderDashboard() {
    var uniqueStudents = globalStudents.length;
    var totalTasks = globalTasks.length;
    var completed = globalTasks.filter(function(t) { return t.status === "Completed"; }).length;
    var sessions = globalSessions.length;
    var rate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    if (document.getElementById("statTotalStudents")) document.getElementById("statTotalStudents").textContent = uniqueStudents;
    if (document.getElementById("statTotalTasks")) document.getElementById("statTotalTasks").textContent = totalTasks;
    if (document.getElementById("statCompletedTasks")) document.getElementById("statCompletedTasks").textContent = completed;
    if (document.getElementById("statCompletionRate")) document.getElementById("statCompletionRate").textContent = rate + "% completion rate";
    if (document.getElementById("statTotalSessions")) document.getElementById("statTotalSessions").textContent = sessions;

    var today = localDateKey(new Date());
    var activeToday = new Set(globalLogs.filter(function(log) {
      return localDateKey(new Date(log.created_at)) === today;
    }).map(function(log) { return log.user_id; }).filter(Boolean)).size;
    setText("engageActive", activeToday);
    setText("engageInactive", Math.max(0, uniqueStudents - activeToday));

    var deadlineBody = document.getElementById("upcomingDeadlinesBody");
    if (deadlineBody) {
      var upcoming = globalTasks.filter(function(task) {
        return task.status !== "Completed" && task.due >= today;
      }).sort(function(a, b) { return a.due.localeCompare(b.due); }).slice(0, 5);
      deadlineBody.innerHTML = upcoming.length ? upcoming.map(function(task) {
        return "<tr><td>" + escapeHtml(task.title) + "</td><td>" + escapeHtml(task.subject) +
          "</td><td>" + formatDate(task.due) + "</td><td>" + escapeHtml(task.priority) + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="empty-text">No upcoming deadlines.</td></tr>';
    }

    var feedbackBody = document.getElementById("feedbackPreviewBody");
    if (feedbackBody) {
      feedbackBody.innerHTML = globalFeedback.length ? globalFeedback.slice(0, 5).map(function(item) {
        return "<tr><td>" + escapeHtml(item.name) + "</td><td>" + escapeHtml(item.subject) +
          "</td><td>" + escapeHtml(item.status || "New") + "</td></tr>";
      }).join("") : '<tr><td colspan="3" class="empty-text">No feedback submitted yet.</td></tr>';
    }
  }

  function renderReports() {
    var uniqueStudents = globalStudents.length;
    var totalTasks = globalTasks.length;
    var completed = globalTasks.filter(function(t) { return t.status === "Completed"; }).length;
    var sessions = globalSessions.length;
    var rate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    if (document.getElementById("repTotalStudents")) document.getElementById("repTotalStudents").textContent = uniqueStudents;
    if (document.getElementById("repActiveStudents")) {
      var activeSince = Date.now() - 30 * 24 * 60 * 60 * 1000;
      var activeCount = globalStudents.filter(function(student) {
        return student.last_sign_in_at && new Date(student.last_sign_in_at).getTime() >= activeSince;
      }).length;
      document.getElementById("repActiveStudents").textContent = activeCount + " Active accounts";
    }
    if (document.getElementById("repTotalTasks")) document.getElementById("repTotalTasks").textContent = totalTasks;
    if (document.getElementById("repTasksPeriod")) document.getElementById("repTasksPeriod").textContent = totalTasks + " tasks total";
    if (document.getElementById("repCompletionRate")) document.getElementById("repCompletionRate").textContent = rate + "%";
    if (document.getElementById("repCompletionText")) document.getElementById("repCompletionText").textContent = completed + " of " + totalTasks + " tasks completed";
    if (document.getElementById("repTotalSessions")) document.getElementById("repTotalSessions").textContent = sessions;
    if (document.getElementById("repSessionsPeriod")) document.getElementById("repSessionsPeriod").textContent = sessions + " sessions";
  }

  function renderStudentsPage() {
    var tableBody = document.getElementById("studentTableBody");
    if (!tableBody) return;

    var search = (document.getElementById("studentSearch")?.value || "").trim().toLowerCase();
    var statusFilter = document.getElementById("studentStatusFilter")?.value || "All";
    var activeSince = Date.now() - 30 * 24 * 60 * 60 * 1000;
    var filtered = globalStudents.filter(function(student) {
      var active = student.last_sign_in_at && new Date(student.last_sign_in_at).getTime() >= activeSince;
      var status = active ? "Active" : "Inactive";
      var matchesSearch = !search ||
        (student.full_name || "").toLowerCase().includes(search) ||
        (student.email || "").toLowerCase().includes(search);
      return matchesSearch && (statusFilter === "All" || statusFilter === status);
    });

    var activeCount = globalStudents.filter(function(student) {
      return student.last_sign_in_at && new Date(student.last_sign_in_at).getTime() >= activeSince;
    }).length;
    setText("statTotalStudents", globalStudents.length);
    setText("statActiveAccounts", activeCount);
    setText("statInactiveAccounts", globalStudents.length - activeCount);
    setText("statRecentStudents", globalStudents.filter(function(student) {
      return Date.now() - new Date(student.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length);

    tableBody.innerHTML = filtered.length ? filtered.map(function(student) {
      var active = student.last_sign_in_at && new Date(student.last_sign_in_at).getTime() >= activeSince;
      return "<tr><td>" + escapeHtml(student.id.slice(0, 8)) + "</td><td>" +
        escapeHtml(student.full_name || "Student") + "</td><td>" + escapeHtml(student.email || "") +
        "</td><td>" + formatDate(student.created_at) + "</td><td>" +
        (active ? "Active" : "Inactive") + "</td><td>" +
        (student.last_sign_in_at ? "Last sign in " + formatDate(student.last_sign_in_at) : "Never signed in") +
        "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty-text">No matching students found.</td></tr>';
  }

  function renderTasksPage() {
    var tableBody = document.getElementById("taskTableBody");
    if (!tableBody) return;

    var search = (document.getElementById("taskSearch")?.value || "").trim().toLowerCase();
    var status = document.getElementById("taskStatusFilter")?.value || "All";
    var filtered = globalTasks.filter(function(task) {
      var owner = getStudent(task.user_id);
      return (!search || (task.title || "").toLowerCase().includes(search) ||
        (task.subject || "").toLowerCase().includes(search) ||
        (owner && (owner.full_name || "").toLowerCase().includes(search)) ||
        (owner && (owner.email || "").toLowerCase().includes(search))) &&
        (status === "All" || task.status === status);
    });
    var today = localDateKey(new Date());
    setText("statTotalTasks", globalTasks.length);
    setText("statCompletedTasks", globalTasks.filter(function(task) { return task.status === "Completed"; }).length);
    setText("statPendingTasks", globalTasks.filter(function(task) { return task.status === "Pending"; }).length);
    setText("statOverdueTasks", globalTasks.filter(function(task) {
      return task.status !== "Completed" && task.due < today;
    }).length);
    tableBody.innerHTML = filtered.length ? filtered.map(function(task) {
      var owner = getStudent(task.user_id);
      return "<tr><td>" + escapeHtml(task.title) + "</td><td>" +
        escapeHtml(owner ? owner.full_name : "Student") + "</td><td>" +
        escapeHtml(task.subject) + "</td><td>" + formatDate(task.due) + "</td><td>" +
        escapeHtml(task.priority) + "</td><td>" + escapeHtml(task.status) +
        "</td><td>" + escapeHtml(task.type) + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty-text">No matching tasks found.</td></tr>';
  }

  function renderSessionsPage() {
    var tableBody = document.getElementById("sessionTableBody");
    if (!tableBody) return;

    var search = (document.getElementById("sessionSearch")?.value || "").trim().toLowerCase();
    var filtered = globalSessions.filter(function(session) {
      var owner = getStudent(session.user_id);
      return !search || (session.title || "").toLowerCase().includes(search) ||
        (session.subject || "").toLowerCase().includes(search) ||
        (owner && (owner.full_name || "").toLowerCase().includes(search)) ||
        (owner && (owner.email || "").toLowerCase().includes(search));
    });
    var today = localDateKey(new Date());
    setText("statTotalSessions", globalSessions.length);
    setText("statSessionsToday", globalSessions.filter(function(session) { return session.date === today; }).length);
    setText("statUpcomingSessions", globalSessions.filter(function(session) { return session.date >= today; }).length);
    setText("statCompletedSessions", globalSessions.filter(function(session) { return session.date < today; }).length);
    tableBody.innerHTML = filtered.length ? filtered.map(function(session) {
      var owner = getStudent(session.user_id);
      return "<tr><td>" + escapeHtml(session.title) + "</td><td>" +
        escapeHtml(owner ? owner.full_name : "Student") + "</td><td>" +
        escapeHtml(session.subject) + "</td><td>" + formatDate(session.date) +
        "</td><td>" + formatTime(session.start_time) + "</td><td>" +
        formatTime(session.end_time) + "</td><td>" +
        escapeHtml(session.notes || "—") + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="empty-text">No matching study sessions found.</td></tr>';
  }

  function renderFeedbackPage() {
    var tableBody = document.getElementById("feedbackTableBody");
    if (!tableBody) return;

    var counts = { "New": 0, "In Review": 0, "Resolved": 0 };
    globalFeedback.forEach(function(item) {
      var status = item.status || "New";
      if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    });
    setText("statTotalFeedback", globalFeedback.length);
    setText("statNewFeedback", counts.New);
    setText("statReviewFeedback", counts["In Review"]);
    setText("statResolvedFeedback", counts.Resolved);
    tableBody.innerHTML = globalFeedback.length ? globalFeedback.map(function(item) {
      return "<tr><td>" + escapeHtml(item.name) + "<br><small>" + escapeHtml(item.email) +
        "</small></td><td>" + escapeHtml(item.subject) + "<br><small>" +
        escapeHtml(item.message) + "</small></td><td>" + escapeHtml(item.type) +
        "</td><td>" + formatDate(item.created_at) + "</td><td>" +
        escapeHtml(item.status || "New") + '</td><td><select class="feedback-status-select" data-id="' +
        escapeHtml(item.id) + '" data-status="' + escapeHtml(item.status || "New") + '">' +
        ["New", "In Review", "Resolved"].map(function(status) {
          return '<option value="' + status + '"' + ((item.status || "New") === status ? " selected" : "") +
            ">" + status + "</option>";
        }).join("") + "</select></td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty-text">No feedback has been submitted yet.</td></tr>';
  }

  function renderLogsPage() {
    var tableBody = document.getElementById("logTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = globalLogs.length ? globalLogs.map(function(log) {
      var owner = getStudent(log.user_id);
      return "<tr><td>" + formatDateTime(log.created_at) + "</td><td>" +
        escapeHtml(owner ? owner.full_name + " (" + owner.email + ")" : "Account") +
        "</td><td>" + escapeHtml(log.event_type.replace(/_/g, " ")) +
        "</td><td>" + escapeHtml(log.description) + "</td><td>" +
        escapeHtml(log.result) + "</td></tr>";
    }).join("") : '<tr><td colspan="5" class="empty-text">No activity recorded yet. New task and study-session changes will appear here.</td></tr>';
  }

  function renderAdminProfile() {
    var metadata = currentUser.user_metadata || {};
    var name = metadata.full_name || currentUser.email.split("@")[0];
    setText("profileName", name);
    setText("profileEmail", currentUser.email);
    setText("dropdownName", name);
    setText("dropdownEmail", currentUser.email);
    var profileId = document.getElementById("profileId");
    var nameInput = document.getElementById("profileName2");
    var avatar = document.getElementById("profileAvatar");
    if (profileId) profileId.value = currentUser.id;
    if (nameInput) nameInput.value = metadata.full_name || "";
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
  }

  function renderAdminSettings() {
    var emailInput = document.getElementById("settingsEmail");
    if (emailInput) emailInput.value = currentUser.email || "";
  }

  function showFormMessage(id, message, isError) {
    var element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.style.display = "block";
    element.style.color = isError ? "var(--status-overdue)" : "var(--status-completed)";
  }

  async function submitAccountUpdate(formId, buttonId, update, onSuccess) {
    var form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async function(event) {
      event.preventDefault();
      var button = document.getElementById(buttonId);
      var oldText = button.textContent;
      button.disabled = true;
      button.textContent = "Saving...";
      try {
        var result = await update();
        if (result.error) throw result.error;
        if (result.data && result.data.user) currentUser = result.data.user;
        onSuccess(result);
      } catch (error) {
        onSuccess({ error: error });
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });
  }

  submitAccountUpdate("adminProfileForm", "saveAdminProfileBtn", function() {
    var name = document.getElementById("profileName2").value.trim();
    if (!name) return Promise.resolve({ error: new Error("Please enter your full name.") });
    return supabaseClient.auth.updateUser({ data: { full_name: name } });
  }, function(result) {
    if (result.error) {
      showFormMessage("profileMessage", "Could not update profile: " + result.error.message, true);
      return;
    }
    var name = (currentUser.user_metadata && currentUser.user_metadata.full_name) || currentUser.email.split("@")[0];
    setText("profileName", name);
    setText("dropdownName", name);
    setText("userAvatar", name.charAt(0).toUpperCase());
    setText("profileAvatar", name.charAt(0).toUpperCase());
    showFormMessage("profileMessage", "Profile updated successfully.", false);
  });

  submitAccountUpdate("adminEmailForm", "updateEmailBtn", function() {
    var email = document.getElementById("settingsEmail").value.trim();
    if (!email) return Promise.resolve({ error: new Error("Please enter a valid email address.") });
    return supabaseClient.auth.updateUser({ email: email });
  }, function(result) {
    if (result.error) {
      showFormMessage("emailMessage", "Could not update email: " + result.error.message, true);
      return;
    }
    showFormMessage("emailMessage", "Email update requested. Confirm the new address using the email Supabase sent.", false);
  });

  submitAccountUpdate("adminPasswordForm", "updatePasswordBtn", function() {
    var password = document.getElementById("newAdminPassword").value;
    var confirmation = document.getElementById("confirmAdminPassword").value;
    if (password.length < 8) return Promise.resolve({ error: new Error("Password must be at least 8 characters.") });
    if (password !== confirmation) return Promise.resolve({ error: new Error("Passwords do not match.") });
    return supabaseClient.auth.updateUser({ password: password });
  }, function(result) {
    if (result.error) {
      showFormMessage("passwordMessage", "Could not update password: " + result.error.message, true);
      return;
    }
    document.getElementById("adminPasswordForm").reset();
    showFormMessage("passwordMessage", "Password updated successfully.", false);
  });

  function bindSearch(selector, render) {
    var input = document.querySelector(selector);
    if (!input) return;
    input.addEventListener(input.tagName === "SELECT" ? "change" : "input", render);
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function getStudent(userId) {
    return globalStudents.find(function(student) { return student.id === userId; }) || null;
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value.length === 10 ? value + "T00:00:00" : value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  }

  function formatDateTime(value) {
    if (!value) return "—";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function formatTime(value) {
    if (!value) return "—";
    var parts = value.split(":");
    var date = new Date();
    date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function localDateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
      "-" + String(date.getDate()).padStart(2, "0");
  }

  window.clearStudentFilters = function() {
    var search = document.getElementById("studentSearch");
    var status = document.getElementById("studentStatusFilter");
    if (search) search.value = "";
    if (status) status.value = "All";
    renderStudentsPage();
  };

  window.clearTaskFilters = function() {
    var search = document.getElementById("taskSearch");
    var status = document.getElementById("taskStatusFilter");
    if (search) search.value = "";
    if (status) status.value = "All";
    renderTasksPage();
  };

  function renderCalendar() {
    var container = document.getElementById("adminCalGridContainer");
    var title = document.getElementById("calTitle");
    if (!container) return;

    var currentMonth = new Date();
    currentMonth.setDate(1);

    function drawCalendar() {
      var year = currentMonth.getFullYear();
      var month = currentMonth.getMonth();
      
      if (title) {
        var monthOptions = { month: 'long', year: 'numeric' };
        title.textContent = currentMonth.toLocaleDateString('en-US', monthOptions);
      }

      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      
      var html = '<div class="cal-grid">';
      var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      for (var i = 0; i < dayNames.length; i++) {
        html += '<div class="cal-day-name">' + dayNames[i] + '</div>';
      }
      
      var cells = [];
      for (var i = firstDay - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInMonth - i), other: true });
      for (var i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(year, month, i), other: false });
      for (var i = 1; i <= (42 - cells.length); i++) cells.push({ date: new Date(year, month + 1, i), other: true });

      var todayIso = new Date().toISOString().split('T')[0];

      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        var iso = c.date.toISOString().split('T')[0];
        var isToday = (iso === todayIso);
        
        var dayTasks = globalTasks.filter(function(t) { return t.due === iso && t.status !== "Completed"; });
        var daySessions = globalSessions.filter(function(s) { return s.date === iso; });
        
        var eventsHtml = '';
        for (var j = 0; j < dayTasks.length && j < 2; j++) eventsHtml += '<div class="cal-event task">' + dayTasks[j].title + '</div>';
        for (var j = 0; j < daySessions.length && j < 2; j++) eventsHtml += '<div class="cal-event session">' + daySessions[j].title + '</div>';

        html += '<div class="cal-cell ' + (c.other ? 'other' : '') + ' ' + (isToday ? 'today' : '') + '">';
        html += '<span class="cal-day-num">' + c.date.getDate() + '</span>';
        html += eventsHtml;
        html += '</div>';
      }

      html += '</div>';
      container.innerHTML = html;
    }

    var prevMonth = document.getElementById("prevMonth");
    var nextMonth = document.getElementById("nextMonth");
    var curMonth = document.getElementById("curMonth");

    if (prevMonth) prevMonth.onclick = function() { currentMonth.setMonth(currentMonth.getMonth() - 1); drawCalendar(); };
    if (nextMonth) nextMonth.onclick = function() { currentMonth.setMonth(currentMonth.getMonth() + 1); drawCalendar(); };
    if (curMonth) curMonth.onclick = function() { currentMonth = new Date(); currentMonth.setDate(1); drawCalendar(); };

    drawCalendar();
  }

  // 5. CHARTS
  function renderCharts() {
    if (!window.Chart) return;

    var trendCtx = document.getElementById("activityTrendChart");
    if (trendCtx) {
      if (chartActivityTrend) chartActivityTrend.destroy();
      var trendLabels = [];
      var createdCounts = [];
      var completedCounts = [];
      var today = new Date();
      for (var dayOffset = 6; dayOffset >= 0; dayOffset--) {
        var date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
        var key = localDateKey(date);
        trendLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        createdCounts.push(globalTasks.filter(function(task) {
          return task.created_at && localDateKey(new Date(task.created_at)) === key;
        }).length);
        completedCounts.push(globalLogs.filter(function(log) {
          return log.event_type === "task_completed" &&
            localDateKey(new Date(log.created_at)) === key;
        }).length);
      }
      chartActivityTrend = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: trendLabels,
          datasets: [
            { label: 'Tasks Created', data: createdCounts, borderColor: '#d946ef', tension: 0.4, fill: true, backgroundColor: 'rgba(217, 70, 239, 0.1)' },
            { label: 'Tasks Completed', data: completedCounts, borderColor: '#10b981', tension: 0.4 }
          ]
        },
        options: { 
          responsive: true, maintainAspectRatio: false, 
          plugins: { legend: { labels: { color: '#9ca3af' } } },
          scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
            y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    var statusCtx = document.getElementById("taskStatusChart");
    if (statusCtx) {
      if (chartTaskStatus) chartTaskStatus.destroy();
      
      var completed = globalTasks.filter(function(t) { return t.status === "Completed"; }).length;
      var isOverdue = function(task) {
        return task.status !== "Completed" && task.due < localDateKey(new Date());
      };
      var inProg = globalTasks.filter(function(task) { return task.status === "In Progress" && !isOverdue(task); }).length;
      var pending = globalTasks.filter(function(task) { return task.status === "Pending" && !isOverdue(task); }).length;
      var overdue = globalTasks.filter(isOverdue).length;

      var chartData = [completed, inProg, pending, overdue];
      var chartColors = ['#10b981', '#d946ef', '#f59e0b', '#ef4444'];
      var hasTasks = chartData.some(function(count) { return count > 0; });
      
      if (!hasTasks) {
        chartData = [1]; chartColors = ['rgba(255,255,255,0.1)']; 
      }

      chartTaskStatus = new Chart(statusCtx, {
        type: 'doughnut',
        data: { 
          labels: chartData.length === 1 ? ['No Data'] : ['Completed', 'In Progress', 'Pending', 'Overdue'], 
          datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0 }] 
        },
        options: { 
          responsive: true, maintainAspectRatio: false, cutout: '70%', 
          plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } } 
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", function() {
      initUI();
      initAuth();
    });
  } else {
    initUI();
    initAuth();
  }
})();