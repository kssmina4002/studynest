document.addEventListener("DOMContentLoaded", () => {
  
  const hamburger = document.getElementById("hamburger");
  const navLinks = document.getElementById("navLinks");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  
  const faqItems = document.querySelectorAll(".faq-item");
  
  faqItems.forEach(item => {
    const btn = item.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      // Close other items
      faqItems.forEach(other => {
        if (other !== item) other.classList.remove("active");
      });
      
      item.classList.toggle("active");
    });
  });

  
  if (window.lucide) {
    lucide.createIcons();
  }
});