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
const clearPageCollectionOption = document.getElementById("clearPageCollectionOption");

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

let activeChatController = null;

/* Cancel functionality */
function setChatThinking(isThinking) {
    if (isThinking) {
        sendBtn.textContent = "Cancel";
        sendBtn.classList.add("cancel");
        chatOptionsBtn.disabled = true;
    } else {
        sendBtn.textContent = "Send";
        sendBtn.classList.remove("cancel");
        chatOptionsBtn.disabled = false;
    }
}

function cancelChat() {
    if (activeChatController) {
        activeChatController.abort();
        activeChatController = null;
        chatHistory.pop(); // Remove the last user message since it was not processed
        setChatThinking(false);
    }
}

/* Model selection */
const modelSelect = document.getElementById("modelSelect");

async function loadModels() {
    try {
        const response = await fetch("/api/models");

        if (!response.ok) {
            throw new Error("Failed to load models");
        }

        const data = await response.json();

        modelSelect.innerHTML = "";

        if (!data.models || data.models.length === 0) {
            const option = document.createElement("option");
            option.textContent = "No models found";
            option.value = "";
            modelSelect.appendChild(option);
            return;
        }

        data.models.forEach(model => {
            const option = document.createElement("option");

            option.value = model;
            option.textContent = model;

            modelSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error loading Ollama models:", error);

        modelSelect.innerHTML = "";

        const option = document.createElement("option");
        option.textContent = "Ollama unavailable";
        option.value = "";

        modelSelect.appendChild(option);
    }
}

loadModels();

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

// Clear chat view
clearChatOption.addEventListener("click", function () {
    messages.innerHTML = "";
    chatOptionsMenu.classList.add("hidden");
});

//Clear chat history
clearChatHistoryOption.addEventListener("click", function () {
    chatHistory = [
        { role: "system", content: "You are a helpful assistant." }
    ];
    chatOptionsMenu.classList.add("hidden");
});

// Clear page collection
clearPageCollectionOption.addEventListener("click", async function () {
    try {
        const response = await fetch("/clear-page-collection", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });
    } catch (err) {
        console.error("Error clearing page collection:", err);
        sendOutput("Error clearing page collection: " + err.message);
    }
});

/* Send message */
async function sendMessage() {
    const text = input.value.trim();
    console.log("chatHistory:", chatHistory);
    console.log("Selected model:", modelSelect.value);

    if (!text) return;

    if (text.includes("[Page]")) {
        const currentPageText = getCurrentPageText();

        if (!currentPageText.trim()) {
            sendOutput("Unable to get text from the current page.");
        }

        try {
            const response = await fetch("/add-page-to-chroma", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    text: currentPageText
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || "Failed to add page to ChromaDB");
            }

            const result = await response.json();

            messages.prepend(
                createMsg(
                    "message",
                    text + `: Current Page Added to Context (${result.chunks} chunks)`
                )
            );
            
            input.value = "";

        } catch (err) {
            console.error("chromaDB error:",err);
            sendOutput("Error adding page to ChromaDB: " + err.message);
        }
            
        //chatHistory.push({ role: "user", content: currentPageText });
        //messages.prepend(createMsg("message", text + ": Current Page Added to Context"));

        return;
    }

    messages.prepend(createMsg("message", text));
    input.value = "";

    chatHistory.push({ role: "user", content: text });
    console.log("chatHistory:", chatHistory);

    const loadingMsg = createMsg("thinking-message", "Thinking");
    messages.prepend(loadingMsg);

    activeChatController = new AbortController();
    setChatThinking(true);

    try {
        console.log("Sending chat history to server:", chatHistory);
        const response = await fetch("/chatMessage", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            signal: activeChatController.signal,
            body: JSON.stringify({
                chatHistory: chatHistory,
                model: modelSelect.value || "tinyllama:latest"
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

        // while (true) {
        //     const { value, done } = await reader.read();
        //     if (done) break;

        //     const chunkText = decoder.decode(value, { stream: true });
        //     fullReply += chunkText;

        //     msg.innerHTML = cleanText(fullReply);
        // }

        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");

            buffer = lines.pop();

            for (const line of lines) {

                if (line.startsWith("__DEBUG__")) {

                    try {
                        const debug = JSON.parse(
                            line.substring("__DEBUG__".length)
                        );

                        if (debug.type === "context_message") {
                            console.log("--- Context Message ---");
                            console.log(debug.content);
                            console.log("-----------------------");
                        } else if (debug.type === "chat_messages_recieved") {
                            console.log("--- Chat Messages Received ---");
                            console.log(debug.content);
                            console.log("-------------------------------");
                        } else {
                            console.log("--- Chroma Chunk ---");
                            console.log("Type:", debug.type);
                            console.log("Distance:", debug.distance);
                            console.log("Document:", debug.document);
                            console.log("--------------------");
                        }

                    } catch (err) {
                        console.error("Failed to parse Chroma debug data:", err);
                    }

                } else {

                    fullReply += line + "\n";
                    msg.innerHTML = cleanText(fullReply);

                }
            }
        }

        chatHistory.push({ role: "assistant", content: fullReply || "(no reply)" });

    } catch (err) {
        console.error(err);
        loadingMsg.remove?.();
        sendOutput("Error: " + err.message);
    } finally {
        activeChatController = null;

        // Turn Cancel back into Send
        sendBtn.textContent = "Send";
        sendBtn.classList.remove("cancel");

        // Re-enable chat options
        chatOptionsBtn.disabled = false;
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

sendBtn.onclick = function () {
    if (activeChatController) {
        cancelChat();
    } else {
        sendMessage();
    }
};
//test.onclick = sendOuput;

input.addEventListener("keypress", function(e){
    if(e.key === "Enter" && !activeChatController) {
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
