document.addEventListener("DOMContentLoaded", () => {
  // Mobile Menu Toggle
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  // FAQ Accordion Logic
  const faqItems = document.querySelectorAll(".faq-item");
  
  faqItems.forEach(item => {
    const btn = item.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      // Close other items
      faqItems.forEach(other => {
        if (other !== item) other.classList.remove("active");
      });
      // Toggle current item
      item.classList.toggle("active");
    });
  });

  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }
});