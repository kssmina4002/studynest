window.studyNestPreview = {
  user: {
    id: "studynest-preview",
    email: "preview@studynest.local",
    user_metadata: { full_name: "Student Preview" }
  },

  isPreviewUser(user) {
    return user?.id === this.user.id;
  },

  async getUser() {
    // If Supabase hasn't loaded, fall back to preview (dev-safe)
    if (typeof supabaseClient === "undefined") {
      return this.user;
    }

    const response = await supabaseClient.auth.getSession();
    const session = response.data.session;
    const error = response.error;

    if (error) {
      throw error;
    }

    if (session) {
      return session.user;
    }

    // ✅ FIX: No session → redirect to login
    window.location.href = "login.html";
    throw new Error("No active session — redirecting to login.");
  },

  notifyUnavailable() {
    alert("Please sign in to save changes.");
  }
};