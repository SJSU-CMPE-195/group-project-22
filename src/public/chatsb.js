const sidebar = document.getElementById("chatSidebar");
const openChatBtn = document.getElementById("openChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("chatMessages");
const test = document.getElementById("sendOutput");
const resizeHandle = document.getElementById("resizeHandle");

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

/* Send message */
async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    messages.prepend(createMsg("message", text));
    input.value = "";

    chatHistory.push({ role: "user", content: text });

    // Temporary loading message
    const loadingMsg = createMsg("thinking-message", "Thinking...");
    messages.prepend(loadingMsg);

    const payload = {
        model: "qwen/qwen3.5-9b",
        messages: chatHistory,
        temperature: 0.7,
        stream: true
    };

    try {
        await new Promise(requestAnimationFrame);

        const response = await fetch("http://localhost:1234/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || "Request failed");
        }

        if (!response.body) {
            throw new Error("Streaming not supported by this response");
        }

        const msg = document.createElement("div");
        msg.className = "output-message";
        messages.prepend(msg);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let fullReply = "";
        let buffer = "";
        let streamFinished = false;

        while (!streamFinished) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;

                const dataStr = trimmed.slice(5).trim();

                if (dataStr === "[DONE]") {
                    break;
                }

                try {
                    const data = JSON.parse(dataStr);
                    const token = data?.choices?.[0]?.delta?.content || "";

                    if (token) {
                        fullReply += token;

                        const rawHtml = marked.parse(fullReply);
                        const safeHtml = DOMPurify.sanitize(rawHtml);
                        msg.innerHTML = safeHtml;
                    }
                } catch (e) {
                    console.warn("Bad stream chunk:", dataStr);
                }
            }
        }
        loadingMsg.remove();
        // Final markdown render after stream completes
        const rawHtml = marked.parse(fullReply || "(no reply)");
        const safeHtml = DOMPurify.sanitize(rawHtml);
        msg.innerHTML = safeHtml;

        chatHistory.push({ role: "assistant", content: fullReply || "(no reply)" });
        // Remove loading message and create live output box
        

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

    const rawHtml = marked.parse(markdownText);
    const safeHtml = DOMPurify.sanitize(rawHtml);

    msg.innerHTML = safeHtml;
    messages.prepend(msg);
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
const pdfSource     = document.getElementById('pdf-source');

const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function fetchWithFallback(url) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url));
      if (res.ok) return await res.text();
    } catch (_) {}
  }
  throw new Error('All proxies failed.');
}

function extractText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('#mw-content-text, article, main') || doc.body;
  ['script','style','nav','footer','header','sup','.mw-editsection']
    .forEach(sel => main.querySelectorAll(sel).forEach(el => el.remove()));
  return (main.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

fetchBtn.addEventListener('click', async () => {
  const url = fetchUrlInput.value.trim();
  if (!url) { fetchStatus.textContent = 'Please enter a URL.'; return; }

  fetchBtn.disabled = true;
  exportPdfBtn.disabled = true;
  fetchStatus.textContent = 'Fetching...';

  try {
    pdfSource.innerHTML = await fetchWithFallback(url);
    exportPdfBtn.disabled = false;
    fetchStatus.textContent = 'Page fetched! Ready to export.';
  } catch (err) {
    fetchStatus.textContent = 'Error: ' + err.message;
  } finally {
    fetchBtn.disabled = false;
  }
});

exportPdfBtn.addEventListener('click', async () => {
  exportPdfBtn.disabled = true;
  fetchStatus.textContent = 'Generating PDF...';

  try {
    const text = extractText(pdfSource.innerHTML);
    if (text.length < 50) throw new Error('No text content found.');

    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const lineHeight = 7;
    let y = margin;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);

    for (const line of pdf.splitTextToSize(text, maxWidth)) {
      if (y + lineHeight > pageHeight - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y);
      y += lineHeight;
    }

    const filename = fetchUrlInput.value.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50) + '.pdf';
    pdf.save(filename);
    fetchStatus.textContent = 'PDF saved!';

  } catch (err) {
    fetchStatus.textContent = 'PDF error: ' + err.message;
  } finally {
    exportPdfBtn.disabled = false;
  }
});
