

const SUPABASE_URL = "https://liiecbofmrgquhaobdkw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpaWVjYm9mbXJncXVoYW9iZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MDY5ODYsImV4cCI6MjEwODQ4Mjk4Nn0.d1eMSqpH2a0V4xStghtMsL1oScIifVGUrhdGNXycldY";


if (!window.supabase) {
  throw new Error(
    "Supabase SDK failed to load. Check the Supabase CDN connection."
  );
}


const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);




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


async function redirectIfLoggedIn(redirectTo = "dashboard.html") {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = redirectTo;
  }
}


async function getCurrentUser() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  return user;
}


async function logoutAndRedirect(redirectTo = "login.html") {
  await supabaseClient.auth.signOut();
  window.location.href = redirectTo;
}