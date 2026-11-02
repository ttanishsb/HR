
const apiKey = document.getElementById("apiKey");
const model = document.getElementById("model");
const status = document.getElementById("status");

async function load() {
  const settings = await chrome.storage.local.get([
    "groqApiKey",
    "groqModel"
  ]);

  apiKey.value = settings.groqApiKey || "";
  model.value = settings.groqModel || "openai/gpt-oss-20b";
}

document.getElementById("save").addEventListener("click", async () => {
  if (!apiKey.value.trim()) {
    status.textContent = "Enter your API key.";
    return;
  }

  await chrome.storage.local.set({
    groqApiKey: apiKey.value.trim(),
    groqModel: model.value.trim()
  });

  status.textContent = "Settings saved.";
});

load();
