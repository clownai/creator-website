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

// --- Code Helper Elements ---
const codePromptInput = document.getElementById('codePromptInput');
const codeOutputArea = document.getElementById('codeOutputArea');
const generateCodeButton = document.getElementById('generateCodeButton');
const loadingCodeSpinner = document.getElementById('loadingCodeSpinner');
const copyCodeOutputButton = document.getElementById('copyCodeOutputButton');
const clearCodeOutputButton = document.getElementById('clearCodeOutputButton');
const clearCodePromptButton = document.getElementById('clearCodePromptButton');

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
if ((generateButton && promptInput) || (generateCodeButton && codePromptInput)) {

    // *** YOUR DEPLOYED WORKER URL - VERIFY IT'S CORRECT ***
    const WORKER_URL = 'https://ai-proxy-worker.clownai.workers.dev';
    const MAX_HISTORY = 5; // Max items in local storage history

    // --- Event Listeners ---
    generateButton?.addEventListener('click', () => handleGeneration('text')); // Pass type
    copyOutputButton?.addEventListener('click', copyOutputToClipboard);
    clearOutputButton?.addEventListener('click', clearOutput);
    clearPromptButton?.addEventListener('click', clearPrompt);
    clearHistoryButton?.addEventListener('click', clearHistory);
    examplePromptButtons?.forEach(button => {
        button.addEventListener('click', () => {
            const promptText = button.getAttribute('data-prompt');
            if (promptText) {
                promptInput.value = promptText;
                // Optional: auto-focus or scroll
                promptInput.focus();
            }
        });
    });

    // --- NEW Listeners for Code Helper ---
    generateCodeButton?.addEventListener('click', () => handleGeneration('code')); // Pass type
    copyCodeOutputButton?.addEventListener('click', copyCodeOutputToClipboard);
    clearCodeOutputButton?.addEventListener('click', clearCodeOutput);
    clearCodePromptButton?.addEventListener('click', clearCodePrompt);

    // --- Core Generation Function (Handles Both Text & Code) ---
    async function handleGeneration(type = 'text') { // Default to text
        let currentPromptInput, currentOutputArea, currentLoadingSpinner, currentGenerateButton, currentCopyButton, currentClearOutButton;
        let specificInstruction = "";

        // Select elements based on the type
        if (type === 'code') {
            currentPromptInput = codePromptInput;
            currentOutputArea = codeOutputArea; // This is the <code> element
            currentLoadingSpinner = loadingCodeSpinner;
            currentGenerateButton = generateCodeButton;
            currentCopyButton = copyCodeOutputButton;
            currentClearOutButton = clearCodeOutputButton;
            specificInstruction = "Generate only the computer code (no explanations unless asked) based on the following request, using markdown code blocks if applicable:\n\n";
        } else { // Default to text
            currentPromptInput = promptInput;
            currentOutputArea = outputArea; // This is the <textarea> element
            currentLoadingSpinner = loadingSpinner;
            currentGenerateButton = generateButton;
            currentCopyButton = copyOutputButton;
            currentClearOutButton = clearOutputButton;
            specificInstruction = "Generate creative text based on the following prompt:\n\n";
        }

        // Ensure elements for the current type exist
        if (!currentPromptInput || !currentOutputArea || !currentLoadingSpinner || !currentGenerateButton || !currentCopyButton || !currentClearOutButton) {
            console.error(`Error: Missing required elements for type '${type}'`);
            return; // Don't proceed if elements are missing
        }

        const prompt = currentPromptInput.value.trim();
        const finalPrompt = specificInstruction + prompt; // Prepend instruction

        if (!prompt) {
            showError(`Please enter a ${type} prompt/request first.`, type);
            return;
        }
        if (!WORKER_URL || !WORKER_URL.startsWith('https://')) {
            showError("Configuration Error: Worker URL is missing or invalid.", type);
            console.error("WORKER_URL is not configured correctly:", WORKER_URL);
            return;
        }

        setLoadingState(true, type);
        if (type === 'code') clearCodeOutput(false); else clearOutput(false); // Clear appropriate output

        try {
            console.log(`Sending ${type} prompt to worker:`, finalPrompt);
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt }), // Send modified prompt
            });

            const responseBody = await response.text();
            console.log(`Raw ${type} response status:`, response.status);
            // console.log(`Raw ${type} response body:`, responseBody); // Debugging

            if (!response.ok) {
                let detail = responseBody;
                try { detail = JSON.parse(responseBody).error || responseBody; } catch (e) { /* Ignore */ }
                throw new Error(`API Error (${response.status}): ${detail}`);
            }

            const data = JSON.parse(responseBody);

            if (data.error) { throw new Error(`Worker Error: ${data.error}`); }

            const generatedContent = data.generatedText || `Received empty ${type} response.`;

            // Display content differently for code vs text
            if (type === 'code') {
                // Set text content for <code> element, preserving whitespace from AI
                currentOutputArea.textContent = generatedContent;
                // Optional: Add syntax highlighting later if desired
            } else {
                currentOutputArea.value = generatedContent; // Set value for <textarea>
                saveToHistory(prompt, generatedContent); // Save only text history for now
            }

            currentCopyButton.disabled = false;
            currentClearOutButton.disabled = false;

        } catch (error) {
            console.error(`Error during ${type} generation:`, error);
            showError(`❌ Error: ${error.message}`, type);
            currentCopyButton.disabled = true;
            currentClearOutButton.disabled = true;
        } finally {
            setLoadingState(false, type);
        }
    }

    // --- UI Helper Functions ---
    function setLoadingState(isLoading, type = 'text') {
        const spinner = (type === 'code') ? loadingCodeSpinner : loadingSpinner;
        const button = (type === 'code') ? generateCodeButton : generateButton;
        const buttonText = (type === 'code') ? 'Generate Code' : 'Generate Text';
        const loadingText = (type === 'code') ? ' Generating Code...' : ' Generating Text...';

        if (!spinner || !button) return; // Exit if elements don't exist for type

        if (isLoading) {
            spinner.classList.remove('d-none');
            button.disabled = true;
            // Find the text node, not the spinner span
            button.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) { node.textContent = loadingText; }
            });
        } else {
            spinner.classList.add('d-none');
            button.disabled = false;
            button.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) { node.textContent = ` ${buttonText}`; } // Add space back
            });
        }
    }

    function showError(message, type = 'text') {
        const outputElem = (type === 'code') ? codeOutputArea : outputArea;
        const copyBtn = (type === 'code') ? copyCodeOutputButton : copyOutputButton;
        const clearBtn = (type === 'code') ? clearCodeOutputButton : clearOutputButton;

        if (!outputElem || !copyBtn || !clearBtn) return;

        if (type === 'code') outputElem.textContent = message; else outputElem.value = message;

        // Use parent <pre> for code error style if needed
        const errorTarget = (type === 'code') ? outputElem.parentElement : outputElem;
        errorTarget.classList.add('is-invalid');
        copyBtn.disabled = true;
        clearBtn.disabled = true;
        setTimeout(() => errorTarget.classList.remove('is-invalid'), 3500); // Longer timeout for errors
    }

    // --- Text Specific Helpers ---
    function clearOutput(resetButtons = true) {
        if (!outputArea) return;
        outputArea.value = "";
        outputArea.classList.remove('is-invalid');
        if (resetButtons && copyOutputButton && clearOutputButton) {
            copyOutputButton.disabled = true;
            clearOutputButton.disabled = true;
        }
    }
    function clearPrompt() {
        if (!promptInput) return;
        promptInput.value = "";
        promptInput.focus();
    }
    function copyOutputToClipboard() {
        if (!outputArea || !outputArea.value) return;
        copyTextToClipboard(outputArea.value, copyOutputButton);
    }

    // --- Code Specific Helpers ---
    function clearCodeOutput(resetButtons = true) {
        if (!codeOutputArea) return;
        codeOutputArea.textContent = "Code will appear here..."; // Reset placeholder
        codeOutputArea.parentElement.classList.remove('is-invalid'); // Use parent <pre>
        if (resetButtons && copyCodeOutputButton && clearCodeOutputButton) {
            copyCodeOutputButton.disabled = true;
            clearCodeOutputButton.disabled = true;
        }
    }
    function clearCodePrompt() {
        if (!codePromptInput) return;
        codePromptInput.value = "";
        codePromptInput.focus();
    }
    function copyCodeOutputToClipboard() {
        if (!codeOutputArea || !codeOutputArea.textContent || codeOutputArea.textContent === "Code will appear here...") return;
        copyTextToClipboard(codeOutputArea.textContent, copyCodeOutputButton);
    }

    // --- Generic Copy Function ---
    function copyTextToClipboard(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copied!';
            buttonElement.classList.add('btn-success');
            buttonElement.classList.remove('btn-outline-secondary');
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('btn-success');
                buttonElement.classList.add('btn-outline-secondary');
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Error Copying';
            buttonElement.classList.add('btn-danger');
            buttonElement.classList.remove('btn-outline-secondary');
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('btn-danger');
                buttonElement.classList.add('btn-outline-secondary');
            }, 2000);
        });
    }

    // --- History Functions (Text Only) ---
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
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Initial Load ---
    renderHistory(); // Load history when the script runs

} else {
    // console.log("Playground elements not found on this page.");
}