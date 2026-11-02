
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "STATUS") {
        const s = await chrome.storage.local.get(["groqApiKey", "groqModel"]);
        sendResponse({
          success: true,
          configured: !!s.groqApiKey,
          model: s.groqModel || DEFAULT_MODEL
        });
        return;
      }

      if (message.type === "READ") {
        const results = await chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          func: () => {
            const selectors = location.hostname.includes("leetcode")
              ? [
                  '[data-track-load="description_content"]',
                  '[data-testid="description-content"]',
                  'div[class*="description__"]'
                ]
              : [
                  ".challenge-body-html",
                  ".problem-statement",
                  '[class*="challenge-body"]'
                ];

            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el?.innerText?.trim().length > 50) {
                return el.innerText.trim();
              }
            }

            return document.querySelector("main")?.innerText?.trim() || "";
          }
        });

        const question = results?.[0]?.result || "";
        if (question.length < 30) throw new Error("Problem statement not found.");

        sendResponse({ success: true, question });
        return;
      }

      if (message.type === "GENERATE") {
        const code = await generate(
          message.question,
          message.language,
          message.platform
        );
        sendResponse({ success: true, code });
        return;
      }

      if (message.type === "EXPLAIN") {
        const explanation = await explain(
          message.question,
          message.language,
          message.code
        );
        sendResponse({ success: true, explanation });
        return;
      }

      throw new Error("Unknown request.");
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  })();

  return true;
});

async function groq(prompt, system) {
  const settings = await chrome.storage.local.get(["groqApiKey", "groqModel"]);
  const key = (settings.groqApiKey || "").trim();

  if (!key) throw new Error("Add your Groq API key in Settings.");

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: settings.groqModel || DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_completion_tokens: 4096
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq error ${response.status}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("Groq returned empty content.");

  return content.trim();
}

async function generate(question, language, platform) {
  if (!question) throw new Error("Problem statement is empty.");

  const platformRules = platform === "LeetCode"
    ? "Use class Solution and the required method signature. No main function."
    : "Follow HackerRank's required function signature and input/output format.";

  const prompt = `
Solve this programming practice problem.

Language: ${language}
Platform: ${platform}
${platformRules}

Return only source code. No Markdown fences or explanations.
Use an efficient algorithm and handle edge cases.

Problem:
${question}
`;

  let code = await groq(prompt, "You are a precise programming assistant.");
  code = code.replace(/^```[a-zA-Z0-9+#.-]*\s*\n/, "").replace(/\n```$/, "").trim();

  return code;
}

async function explain(question, language, code) {
  const prompt = `
Explain the concepts used in this solution.

Problem:
${question}

Language: ${language}

Code:
${code}

Use these headings:
CONCEPTS USED
HOW IT WORKS
WHY IT WORKS

Keep it under 150 words. Focus on concepts, not line-by-line explanation.
`;

  return groq(prompt, "You are a concise beginner-friendly programming tutor.");
}
