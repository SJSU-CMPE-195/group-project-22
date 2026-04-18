import { getCurrentPageText } from "./view.js";

const sidebar = document.getElementById("chatSidebar");
const openChatBtn = document.getElementById("openChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("chatMessages");
const resizeHandle = document.getElementById("resizeHandle");

const chatOptionsBtn = document.getElementById("chatOptionsBtn");
const chatOptionsMenu = document.getElementById("chatOptionsMenu");
const clearChatOption = document.getElementById("clearChatOption");
const clearChatHistoryOption = document.getElementById("clearChatHistoryOption");

/* Toggle sidebar */
function openChat() {
    sidebar.classList.add("open");
    openChatBtn.classList.add("hidden");
}

function closeChat() {
    sidebar.classList.remove("open");
    openChatBtn.classList.remove("hidden");
}

openChatBtn.addEventListener("click", openChat);
closeChatBtn.addEventListener("click", closeChat);

let chatHistory = [
    { role: "system", content: "You are a helpful assistant." }
];

/* Chat options menu */
chatOptionsBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    chatOptionsMenu.classList.toggle("hidden");
});

document.addEventListener("click", function (e) {
    if (!chatOptionsMenu.contains(e.target) && e.target !== chatOptionsBtn) {
        chatOptionsMenu.classList.add("hidden");
    }
});

clearChatOption.addEventListener("click", function () {
    messages.innerHTML = "";
    chatOptionsMenu.classList.add("hidden");
});

clearChatHistoryOption.addEventListener("click", function () {
    chatHistory = [
        { role: "system", content: "You are a helpful assistant." }
    ];
    chatOptionsMenu.classList.add("hidden");
});

/* Send message */
async function sendMessage() {
    const text = input.value.trim();
    console.log("chatHistory:", chatHistory);
    if (!text) return;

    if (text.includes("[Page]")) {
        const currentPageText = getCurrentPageText();
        chatHistory.push({ role: "user", content: currentPageText });
        messages.prepend(createMsg("message", text + ": Current Page Added to Context"));
        input.value = "";
        return;
    }

    messages.prepend(createMsg("message", text));
    input.value = "";

    chatHistory.push({ role: "user", content: text });
    console.log("chatHistory:", chatHistory);

    const loadingMsg = createMsg("thinking-message", "Thinking");
    messages.prepend(loadingMsg);

    try {
        const response = await fetch("/chatMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chatHistory: chatHistory
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || "Request failed");
        }
        
        if (!response.body) {
            throw new Error("Streaming not supported by this response");
        }

        loadingMsg.remove();

        const msg = document.createElement("div");
        msg.className = "output-message";
        messages.prepend(msg);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let fullReply = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            fullReply += chunkText;

            msg.innerHTML = cleanText(fullReply);
        }

        chatHistory.push({ role: "assistant", content: fullReply || "(no reply)" });

    } catch (err) {
        console.error(err);
        loadingMsg.remove?.();
        sendOutput("Error: " + err.message);
    }
}

function createMsg(className, text) {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = text;
    return div;
}

/* Send Output to message (test) */
function sendOutput(markdownText) {
    const msg = document.createElement("div");
    msg.className = "output-message";

    msg.innerHTML = cleanText(markdownText);
    messages.prepend(msg);
}

function cleanText(text) {
    const rawHtml = marked.parse(text || "");
    return DOMPurify.sanitize(rawHtml);
}

sendBtn.onclick = sendMessage;
//test.onclick = sendOuput;

input.addEventListener("keypress", function(e){
    if(e.key === "Enter"){
        sendMessage();
    }
});

/* Resize sidebar by dragging left edge */
let isResizing = false;

resizeHandle.addEventListener("mousedown", function(e) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
});

document.addEventListener("mousemove", function(e) {
    if (!isResizing) return;

    e.preventDefault();

    const minWidth = 250;
    const maxWidth = window.innerWidth * 0.8;
    let newWidth = window.innerWidth - e.clientX;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    sidebar.style.width = newWidth + "px";
});

document.addEventListener("mouseup", function() {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
});

// fetch URL and convert to PDF
const fetchBtn      = document.getElementById('fetch-btn');
const exportPdfBtn  = document.getElementById('export-pdf-btn');
const fetchUrlInput = document.getElementById('fetch-url');
const fetchStatus   = document.getElementById('fetch-status');

fetchBtn.addEventListener('click', async () => {
  const url = fetchUrlInput.value.trim();
  if (!url) { fetchStatus.textContent = 'Please enter a URL.'; return; }

  fetchBtn.disabled = true;
  exportPdfBtn.disabled = true;
  fetchStatus.textContent = 'Fetching...';

  try {
    const res = await fetch('/fetch-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }

    const blob = await res.blob();
    window._fetchedPdfBlob = blob;
    exportPdfBtn.disabled = false;
    fetchStatus.textContent = 'Page fetched! Ready to export.';

  } catch (err) {
    fetchStatus.textContent = 'Error: ' + err.message;
  } finally {
    fetchBtn.disabled = false;
  }
});

exportPdfBtn.addEventListener('click', () => {
  if (!window._fetchedPdfBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(window._fetchedPdfBlob);
  const filename = fetchUrlInput.value.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50) + '.pdf';
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  fetchStatus.textContent = 'PDF saved!';
});
