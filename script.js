// Set current year in footer
const currentYearSpan = document.getElementById('current-year');
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
}

// Set current date in legal docs
const currentDateSpans = document.querySelectorAll('.current-date');
if (currentDateSpans) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date().toLocaleDateString('en-US', options);
    currentDateSpans.forEach(span => {
        span.textContent = formattedDate;
    });
}

// Optional: Add active class handling for nav links if needed,
// Bootstrap handles dropdowns automatically.
// Example (more complex logic needed for multi-page):
// const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
// navLinks.forEach(link => {
//   if (link.href === window.location.href) {
//     link.classList.add('active');
//     link.setAttribute('aria-current', 'page');
//   } else {
//       link.classList.remove('active');
//        link.removeAttribute('aria-current');
//   }
// });
