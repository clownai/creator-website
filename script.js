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

// --- Playground Text Generation Logic (Connects to Cloudflare Worker) ---
const generateButton = document.getElementById('generateButton');
const promptInput = document.getElementById('promptInput');
const outputArea = document.getElementById('outputArea');
const loadingSpinner = document.getElementById('loadingSpinner');

// Check if the elements exist (only run on playground.html)
if (generateButton && promptInput && outputArea && loadingSpinner) {

    // *** YOUR DEPLOYED WORKER URL ***
    const WORKER_URL = 'https://ai-proxy-worker.clownai.workers.dev';

    generateButton.addEventListener('click', handleGeneration); // Add listener only if button exists

    // Function to handle the generation request
    async function handleGeneration() { // Make the function async
        const prompt = promptInput.value.trim();

        if (!prompt) {
            outputArea.value = "Please enter a prompt first.";
            return;
        }
        if (!WORKER_URL || !WORKER_URL.startsWith('https://')) {
             outputArea.value = "Error: Worker URL is missing or invalid in script.js";
             console.error("WORKER_URL is not configured correctly:", WORKER_URL);
             return;
        }

        // Show loading state
        outputArea.value = "🧠 Thinking..."; // Update placeholder text
        loadingSpinner.classList.remove('d-none'); // Show spinner
        generateButton.disabled = true;

        try {
            // Send the prompt to your Cloudflare Worker
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt }), // Send prompt in JSON body
            });

            if (!response.ok) {
                // Handle errors from the Worker/API
                const errorText = await response.text();
                // Try to parse error if JSON, otherwise show raw text
                let detail = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    detail = errorJson.error || errorText;
                } catch(e) {
                    // Not JSON, use raw text
                }
                throw new Error(`API Error (${response.status}): ${detail}`);
            }

            const data = await response.json();

            if (data.error) { // Check if the worker returned a JSON error message
                 throw new Error(`Worker Error: ${data.error}`);
            }

            outputArea.value = data.generatedText || "Received empty response."; // Display the text received

        } catch (error) {
            console.error("Error calling AI proxy:", error);
            outputArea.value = `❌ Error: ${error.message}\n\nCheck the browser console (F12) and Cloudflare Worker logs ('wrangler tail') for details.`;
        } finally {
            // Hide loading state regardless of success/failure
            loadingSpinner.classList.add('d-none'); // Hide spinner
            generateButton.disabled = false;
        }
    }
} else {
    // Optional: Log if playground elements aren't found (useful for debugging)
    // console.log("Playground elements not found on this page.");
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