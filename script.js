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

// --- Playground Logic ---

// --- Common Elements ---
const promptInput = document.getElementById('promptInput');
const outputArea = document.getElementById('outputArea');
const generateButton = document.getElementById('generateButton');
const loadingSpinner = document.getElementById('loadingSpinner');
const copyOutputButton = document.getElementById('copyOutputButton');
const clearOutputButton = document.getElementById('clearOutputButton');
const clearPromptButton = document.getElementById('clearPromptButton');
const examplePromptButtons = document.querySelectorAll('.example-prompt-btn');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryButton = document.getElementById('clearHistoryButton');

// Check if we are on a page with the playground elements
if (generateButton && promptInput && outputArea && loadingSpinner && copyOutputButton) {

    // *** YOUR DEPLOYED WORKER URL - VERIFY IT'S CORRECT ***
    const WORKER_URL = 'https://ai-proxy-worker.clownai.workers.dev';
    const MAX_HISTORY = 5; // Max items in local storage history

    // --- Event Listeners ---
    generateButton.addEventListener('click', handleGeneration);
    copyOutputButton.addEventListener('click', copyOutputToClipboard);
    clearOutputButton.addEventListener('click', clearOutput);
    clearPromptButton.addEventListener('click', clearPrompt);
    clearHistoryButton?.addEventListener('click', clearHistory); // Optional chaining

    examplePromptButtons.forEach(button => {
        button.addEventListener('click', () => {
            const promptText = button.getAttribute('data-prompt');
            if (promptText) {
                promptInput.value = promptText;
                // Optional: auto-focus or scroll
                promptInput.focus();
            }
        });
    });

    // --- Core Generation Function ---
    async function handleGeneration() {
        const prompt = promptInput.value.trim();

        if (!prompt) {
            showError("Please enter a prompt first.");
            return;
        }
        if (!WORKER_URL || !WORKER_URL.startsWith('https://')) {
            showError("Configuration Error: Worker URL is missing or invalid.");
            console.error("WORKER_URL is not configured correctly:", WORKER_URL);
            return;
        }

        setLoadingState(true);
        clearOutput(false); // Clear output without disabling buttons immediately

        try {
            console.log("Sending prompt to worker:", prompt);
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt }),
            });

            const responseBody = await response.text(); // Get raw text first for better error logging
            console.log("Raw response status:", response.status);
             // console.log("Raw response body:", responseBody); // Uncomment for debugging

            if (!response.ok) {
                let detail = responseBody;
                try {
                    const errorJson = JSON.parse(responseBody);
                    detail = errorJson.error || responseBody;
                } catch (e) { /* Not JSON */ }
                throw new Error(`API Error (${response.status}): ${detail}`);
            }

            const data = JSON.parse(responseBody); // Now parse JSON

            if (data.error) {
                throw new Error(`Worker Error: ${data.error}`);
            }

            const generatedText = data.generatedText || "Received empty response.";
            outputArea.value = generatedText;
            copyOutputButton.disabled = false; // Enable copy button
            clearOutputButton.disabled = false; // Enable clear output button
            saveToHistory(prompt, generatedText); // Save successful generation

        } catch (error) {
            console.error("Error during generation:", error);
            showError(`❌ Error: ${error.message}`);
            copyOutputButton.disabled = true; // Disable copy on error
            clearOutputButton.disabled = true;
        } finally {
            setLoadingState(false);
        }
    }

    // --- UI Helper Functions ---
    function setLoadingState(isLoading) {
        if (isLoading) {
            loadingSpinner.classList.remove('d-none');
            generateButton.disabled = true;
            generateButton.querySelector('span:not(.spinner-border)').textContent = ' Generating...'; // Change text if needed
        } else {
            loadingSpinner.classList.add('d-none');
            generateButton.disabled = false;
             generateButton.querySelector('span:not(.spinner-border)').textContent = ' Generate Text'; // Restore text
        }
    }

    function showError(message) {
        outputArea.value = message;
        outputArea.classList.add('is-invalid'); // Optional: Add Bootstrap error style
        copyOutputButton.disabled = true;
        clearOutputButton.disabled = true;
         // Remove error style after a delay
         setTimeout(() => outputArea.classList.remove('is-invalid'), 3000);
    }

     function clearOutput(resetButtons = true) {
        outputArea.value = "";
        outputArea.classList.remove('is-invalid');
        if (resetButtons) {
            copyOutputButton.disabled = true;
            clearOutputButton.disabled = true;
        }
    }

    function clearPrompt() {
        promptInput.value = "";
        promptInput.focus();
    }

    function copyOutputToClipboard() {
        if (!outputArea.value) return;
        navigator.clipboard.writeText(outputArea.value).then(() => {
            // Optional: Show temporary success message on button
            const originalText = copyOutputButton.textContent;
            copyOutputButton.textContent = 'Copied!';
            copyOutputButton.classList.add('btn-success');
            setTimeout(() => {
                copyOutputButton.textContent = originalText;
                copyOutputButton.classList.remove('btn-success');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Optional: Show error message
        });
    }

    // --- Local Storage History Functions ---
    function getHistory() {
        const historyJson = localStorage.getItem('aiPlaygroundHistory');
        return historyJson ? JSON.parse(historyJson) : [];
    }

    function saveToHistory(prompt, output) {
        if (!prompt || !output) return;
        let history = getHistory();
        // Add new item to the beginning
        history.unshift({ prompt, output: output.substring(0, 100) + (output.length > 100 ? '...' : ''), timestamp: new Date().toISOString() });
        // Keep only the last MAX_HISTORY items
        if (history.length > MAX_HISTORY) {
            history = history.slice(0, MAX_HISTORY);
        }
        localStorage.setItem('aiPlaygroundHistory', JSON.stringify(history));
        renderHistory();
    }

     function renderHistory() {
        if (!historySection || !historyList) return;

        const history = getHistory();
        historyList.innerHTML = ''; // Clear existing list

        if (history.length > 0) {
            historySection.classList.remove('d-none'); // Show history section
            history.forEach(item => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action';
                li.style.cursor = 'pointer'; // Indicate clickable
                li.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <small class="mb-1 text-truncate"><strong>Prompt:</strong> ${escapeHtml(item.prompt)}</small>
                        <small class="text-muted">${new Date(item.timestamp).toLocaleTimeString()}</small>
                    </div>
                    <p class="mb-1 text-muted text-truncate"><small>Output: ${escapeHtml(item.output)}</small></p>
                `;
                 // Add click listener to load prompt/output back into fields
                 li.addEventListener('click', () => {
                    promptInput.value = item.prompt;
                    // Find full output if needed (requires more complex storage or just show preview)
                    // For simplicity, we just fill prompt here
                    promptInput.focus();
                 });
                historyList.appendChild(li);
            });
        } else {
            historySection.classList.add('d-none'); // Hide if empty
        }
    }

     function clearHistory() {
        localStorage.removeItem('aiPlaygroundHistory');
        renderHistory(); // Re-render to show empty state
    }

     // Simple HTML escape function
     function escapeHtml(unsafe) {
         if (!unsafe) return '';
         return unsafe
              .replace(/&/g, "&")
              .replace(/</g, "<")
              .replace(/>/g, ">")
              .replace(/"/g, """)
              .replace(/'/g, "'");
     }

    // --- Initial Load ---
    renderHistory(); // Load history when the script runs

} else {
    // console.log("Playground elements not found on this page.");
}