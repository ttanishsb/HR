
const $ = id => document.getElementById(id);

const generateButton = $("generate");
const languageSelect = $("language");
const statusText = $("status");
const substatusText = $("substatus");
const statusDot = $("statusDot");

const resultPanel = $("result");
const copyButton = $("copy");
const viewButton = $("view");
const explainButton = $("explain");

const codePreview = $("codePreview");
const explanationBox = $("explanation");

let currentCode = "";
let currentQuestion = "";
let currentLanguage = "Python";

function setStatus(message, detail = "", state = "normal") {
    statusText.textContent = message;
    substatusText.textContent = detail;
    statusDot.className = "status-dot";

    if (state === "success") statusDot.classList.add("success");
    if (state === "error") statusDot.classList.add("error");
    if (state === "loading") statusDot.classList.add("loading");
}

function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (!response) {
                reject(new Error("No response from background service."));
                return;
            }

            if (!response.success) {
                reject(new Error(response.error || "Request failed."));
                return;
            }

            resolve(response);
        });
    });
}

function resetResult() {
    currentCode = "";
    resultPanel.hidden = true;
    codePreview.hidden = true;
    explanationBox.hidden = true;

    codePreview.textContent = "";
    explanationBox.textContent = "";

    copyButton.disabled = true;
    viewButton.disabled = true;
    explainButton.disabled = true;

    viewButton.textContent = "VIEW CODE";
    explainButton.textContent = "VIEW CONCEPTS ↗";
}

async function checkConnection() {
    try {
        const response = await sendMessage({ type: "STATUS" });

        if (!response.configured) {
            setStatus("Groq key missing", "Open settings to add your API key.", "error");
        } else {
            setStatus("Ready · Groq connected", `Model: ${response.model}`, "success");
        }
    } catch (error) {
        setStatus("Extension error", error.message, "error");
    }
}

async function generateCode() {
    generateButton.disabled = true;
    generateButton.textContent = "GENERATING...";
    resetResult();

    try {
        setStatus("Reading problem", "Finding the active practice challenge...", "loading");

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const tab = tabs[0];

        if (!tab?.id || !tab.url) {
            throw new Error("Could not identify the active tab.");
        }

        let platform;

        if (tab.url.includes("leetcode.com")) {
            platform = "LeetCode";
        } else if (tab.url.includes("hackerrank.com")) {
            platform = "HackerRank";
        } else {
            throw new Error("Open a supported LeetCode or HackerRank practice problem.");
        }

        const readResponse = await sendMessage({
            type: "READ",
            tabId: tab.id
        });

        currentQuestion = readResponse.question;
        currentLanguage = languageSelect.value;

        setStatus("Generating code", "Sending request to Groq...", "loading");

        const response = await sendMessage({
            type: "GENERATE",
            question: currentQuestion,
            language: currentLanguage,
            platform
        });

        currentCode = response.code;

        if (!currentCode?.trim()) {
            throw new Error("Groq returned empty code.");
        }

        resultPanel.hidden = false;

        copyButton.disabled = false;
        viewButton.disabled = false;
        explainButton.disabled = false;

        setStatus("Generation complete", "Groq · " + currentLanguage, "success");

    } catch (error) {
        setStatus("Generation failed", error.message, "error");
        console.error("[HR Reader]", error);

    } finally {
        generateButton.disabled = false;
        generateButton.innerHTML = 'READ &amp; GENERATE <span>↗</span>';
    }
}

async function copyCode() {
    if (!currentCode) return;

    try {
        await navigator.clipboard.writeText(currentCode);
        copyButton.textContent = "COPIED";

        setTimeout(() => {
            copyButton.textContent = "COPY CODE";
        }, 1500);

    } catch {
        setStatus("Copy failed", "Clipboard permission denied.", "error");
    }
}

function toggleCode() {
    if (!currentCode) return;

    codePreview.hidden = !codePreview.hidden;
    codePreview.textContent = currentCode;

    viewButton.textContent = codePreview.hidden ? "VIEW CODE" : "HIDE CODE";
}

async function explainCode() {
    if (!currentCode || !currentQuestion) return;

    explainButton.disabled = true;
    explainButton.textContent = "LOADING...";

    try {
        const response = await sendMessage({
            type: "EXPLAIN",
            question: currentQuestion,
            language: currentLanguage,
            code: currentCode
        });

        explanationBox.textContent = response.explanation;
        explanationBox.hidden = false;

        explainButton.textContent = "CONCEPTS READY";

    } catch (error) {
        setStatus("Explanation failed", error.message, "error");
        explainButton.textContent = "VIEW CONCEPTS ↗";

    } finally {
        explainButton.disabled = false;
    }
}

generateButton.addEventListener("click", generateCode);
copyButton.addEventListener("click", copyCode);
viewButton.addEventListener("click", toggleCode);
explainButton.addEventListener("click", explainCode);

$("openSettings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});

resetResult();
checkConnection();
