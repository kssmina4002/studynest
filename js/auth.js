  function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  
  if (!input) {
    return;
  }

  if (input.type === "password") {
    input.type = "text";
     btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
  } else {
    input.type = "password";
     btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  }
}

 function showError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

 function clearErrors() {
   const fieldErrors = document.querySelectorAll(".field-error");
  fieldErrors.forEach(function(el) {
    el.textContent = "";
  });

   const alerts = document.querySelectorAll(".auth-error-alert");
  alerts.forEach(function(el) {
    el.style.display = "none";
  });
}

 const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    clearErrors();

     const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pw = document.getElementById("regPassword").value;
    const confirmPw = document.getElementById("regConfirmPassword").value;

    let isValid = true;

     if (!name) {
      showError("regNameError", "Please enter your full name.");
      isValid = false;
    }

     if (!email) {
      showError("regEmailError", "Please enter your email.");
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError("regEmailError", "Invalid email address.");
        isValid = false;
      }
    }

     if (!pw) {
      showError("regPasswordError", "Please create a password.");
      isValid = false;
    } else if (pw.length < 8) {
      showError("regPasswordError", "Password must be at least 8 characters.");
      isValid = false;
    }

     if (pw !== confirmPw) {
      showError("regConfirmError", "Passwords do not match.");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

     const btn = registerForm.querySelector('button[type="submit"]');
    btn.textContent = "Creating...";
    btn.disabled = true;

    try {
      const response = await supabaseClient.auth.signUp({
        email: email,
        password: pw,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data.session) {
        window.location.href = "dashboard.html";
        return;
      }

      alert("Account created successfully. Check your email to confirm your account, then log in.");
      window.location.href = "login.html";

    } catch (err) {
      const errEl = document.getElementById("regError");
      errEl.textContent = err.message;
      errEl.style.display = "block";
      
      btn.textContent = "Create Account";
      btn.disabled = false;
    }
  });
}

 const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById("loginEmail").value.trim();
    const pw = document.getElementById("loginPassword").value;

    let isValid = true;

     if (!email) {
      showError("loginEmailError", "Please enter your email.");
      isValid = false;
    }

     if (!pw) {
      showError("loginPasswordError", "Please enter your password.");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

     const btn = loginForm.querySelector('button[type="submit"]');
    btn.textContent = "Signing in...";
    btn.disabled = true;

    try {
      const response = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: pw
      });

      if (response.error) {
        throw response.error;
      }

      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError) {
        throw userError;
      }

      const isAdmin = userData.user?.app_metadata?.role === "admin";
      window.location.href = isAdmin ? "admin-dashboard.html" : "dashboard.html";

    } catch (err) {
      const errEl = document.getElementById("loginError");
      const errorMessage = err && typeof err.message === "string" ? err.message : "";
      const normalizedMessage = errorMessage.toLowerCase();

      if (normalizedMessage.includes("invalid login credentials")) {
        errEl.textContent = "Supabase is connected, but these credentials were rejected. Use the exact email registered under Supabase Authentication > Users; a username such as \"admin\" will not work. Confirm the user's password and email confirmation status.";
      } else if (
        normalizedMessage.includes("failed to fetch") ||
        normalizedMessage.includes("network") ||
        normalizedMessage.includes("supabaseclient is not defined")
      ) {
        errEl.textContent = "Could not connect to Supabase. Check that the Supabase SDK loaded and the project URL and public key in js/supabase-config.js are correct.";
      } else {
        errEl.textContent = errorMessage || "Sign-in failed due to an unexpected error.";
      }
      errEl.style.display = "block";
      
      btn.textContent = "Sign In";
      btn.disabled = false;
    }
  });
}
