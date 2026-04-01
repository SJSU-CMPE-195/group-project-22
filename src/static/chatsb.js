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

/* Send message */
function sendMessage() {
    const text = input.value.trim();
    if (text === "") return;

    const msg = document.createElement("div");
    msg.className = "message";
    msg.textContent = text;

    // bottom aligned chat (older messages moved up)
    messages.prepend(msg);

    input.value = "";
}

/* Send Output to message (test) */
function sendOuput() {
    const text = input.value.trim();
    if (text === "") return;

    const msg = document.createElement("div");
    msg.className = "output-message";
    msg.textContent = text;

    // bottom aligned chat (older messages moved up)
    messages.prepend(msg);

    input.value = "";
}

sendBtn.onclick = sendMessage;
test.onclick = sendOuput;

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
