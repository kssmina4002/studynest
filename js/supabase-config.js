// ==========================================
// SUPABASE CONFIGURATION — StudyNest
// ==========================================

const SUPABASE_URL = "https://liiecbofmrgquhaobdkw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpaWVjYm9mbXJncXVoYW9iZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MDY5ODYsImV4cCI6MjEwODQ4Mjk4Nn0.d1eMSqpH2a0V4xStghtMsL1oScIifVGUrhdGNXycldY";

// ---------- SDK guard ----------
if (!window.supabase) {
  throw new Error(
    "Supabase SDK failed to load. Check the Supabase CDN connection."
  );
}

// ---------- Client ----------
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// ---------- Auth helpers ----------

// Require an authenticated session. Redirect to login if not logged in.
async function requireAuth(redirectTo = "login.html") {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session.user;
}

// Redirect to dashboard if already logged in (use on login/register pages).
async function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = redirectTo;
  }
}

// Get current user or null (no redirect).
async function getCurrentUser() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  return user;
}

// Log out and redirect.
async function logoutAndRedirect(redirectTo = "login.html") {
  await supabaseClient.auth.signOut();
  window.location.href = redirectTo;
}