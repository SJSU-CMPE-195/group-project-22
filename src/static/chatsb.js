import { getCurrentPageText, navToPage } from "./view.js";
import { updateButtons, viewState, fileStates, updateViewState } from "./viewState.js";
import { setCurrFileIndex, fileInput, showFilesList, highlightSelectedFile, currFileIndex, loadFileByIndex } from "./filepanelupload.js";

const sidebar = document.getElementById("chatSidebar");
const openChatBtn = document.getElementById("openChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("chatMessages");
const resizeHandle = document.getElementById("resizeHandle");

// Chat options menu elements
const chatOptionsBtn = document.getElementById("chatOptionsBtn");
const chatOptionsMenu = document.getElementById("chatOptionsMenu");
const clearChatOption = document.getElementById("clearChatOption");
const clearChatHistoryOption = document.getElementById("clearChatHistoryOption");
const clearPageCollectionOption = document.getElementById("clearPageCollectionOption");

// Toggle sidebar
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

// Cancel functionality
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

// Model selection
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

// Chat options menu
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

// Send message
async function sendMessage() {
    const text = input.value.trim();
    let messageText = text;

    console.log("chatHistory:", chatHistory);
    console.log("Selected model:", modelSelect.value);

    if (!text) return;

    if (text.includes("[Page]")) {
        console.log("Detected [Page] command, adding current page to ChromaDB.");
        sendOutput("Trying to add current page to ChromaDB.");
        await addCurrentPageToChroma(text);
        return;
    }

    const currentPagePatterns = [
        /current\s+(page|file|document)/i,
        /this\s+(page|file|document)/i,
        /the\s+page\s+i'?m\s+on/i,
        /the\s+file\s+i'?m\s+(on|viewing|reading)/i,
        /the\s+document\s+i'?m\s+(on|viewing|reading)/i,
        /what\s+i'?m\s+(viewing|reading)/i,
        /page\s+i'?m\s+on/i
    ];

    const referencesCurrentContext = currentPagePatterns.some(pattern => pattern.test(text));

    if(referencesCurrentContext) {
        console.log("Detected reference to current page, adding current page to ChromaDB.");
        await addCurrentPageToChroma(text);
        // add to the message the file name and page number for context
        const currentPageNumber = viewState.currentPage ?? 0;
        const currentFileName = fileInput[currFileIndex]?.name || "Unknown File";
        const currentPageText = getCurrentPageText();
        const contextMessage = `\nContext: ${currentFileName}, Page ${currentPageNumber}], Text: ${currentPageText}`;
        messageText += contextMessage;
    }

    messages.prepend(createMsg("message", text));
    input.value = "";

    chatHistory.push({ role: "user", content: messageText });
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
        let buffer = "";
        let sources = [];

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop();
            for (const line of lines) {
                // Debug Data
                if (line.startsWith("__DEBUG__")) {

                    try {
                        const debug = JSON.parse(
                            line.substring("__DEBUG__".length)
                        );

                        if (debug.type === "context_message") {
                            console.log("--- Context Message ---");
                            console.log(debug.content);
                            console.log("-----------------------");
                        } else {
                            console.log("--- Chroma Chunk ---");
                            console.log("Type:", debug.type);
                            console.log("Distance:", debug.distance);
                            console.log("Adjusted Distance:", debug.adjusted_distance);
                            console.log("Document:", debug.document);
                            console.log("Metadata:", debug.metadata);
                            console.log("--------------------");
                        }

                    } catch (err) {
                        console.error(
                            "Failed to parse debug data:",
                            err
                        );
                    }
                }
                // Source Data
                else if (line.startsWith("__SOURCE__")) {

                    try {
                        const source = JSON.parse(
                            line.substring("__SOURCE__".length)
                        );

                        sources.push(source);

                        console.log("Source:", source);

                    } catch (err) {
                        console.error(
                            "Failed to parse source:",
                            err
                        );
                    }
                }
                //Regular text
                else {
                    fullReply += line + "\n";

                    msg.innerHTML = cleanText(fullReply);
                }
            }

        }

        // Handle any remaining buffer after the stream ends
        if (buffer) {

            if (buffer.startsWith("__SOURCE__")) {

                try {
                    const source = JSON.parse(
                        buffer.substring("__SOURCE__".length)
                    );

                    sources.push(source);

                } catch (err) {
                    console.error(
                        "Failed to parse source:",
                        err
                    );
                }

            } else if (!buffer.startsWith("__DEBUG__")) {

                fullReply += buffer;

                msg.innerHTML = cleanText(fullReply);
            }
        }

        // Display sources
        if (sources.length > 0) {

            const sourceContainer =
                document.createElement("div");

            sourceContainer.className =
                "message-sources";

            const title =
                document.createElement("div");

            title.className = "sources-title";
            title.textContent = "Sources:";

            sourceContainer.appendChild(title);

            sources.forEach(source => {

                const sourceItem =
                    document.createElement("div");

                sourceItem.className = "source-item";

                if (source.url) {

                    const link =
                        document.createElement("a");

                    link.href = source.url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";

                    link.textContent =
                        source.name || source.url;

                    sourceItem.appendChild(link);

                } else {

                    const link = document.createElement("a");
                    link.href = "#";
                    link.textContent = source.name || "Current Page";

                    link.addEventListener("click", (e) => {
                        e.preventDefault();

                        const index = fileInput.findIndex(
                            file => file.name === source.name
                        );

                        if (index !== -1) {
                            if (index !== currFileIndex) {
                                loadFileByIndex(index);
                                navToPage(source.page, { restoreHighlight: true });
                            } else {
                                navToPage(source.page, { restoreHighlight: true });
                            } 
                        }
                    });

                    sourceItem.appendChild(link);
                }

                if (source.page) {
                    sourceItem.append(
                        ` - Page ${source.page}`
                    );
                }

                sourceContainer.appendChild(sourceItem);
            });

            msg.appendChild(sourceContainer);
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

async function addCurrentPageToChroma(text) {
    const currentPageText = getCurrentPageText();

    if (!currentPageText.trim()) {
        sendOutput("Unable to get text from the current page.");
        return;
    }

    try {
        const currentPageNumber = viewState.currentPage ?? 0;

        const response = await fetch("/add-page-to-chroma", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: currentPageText,
                source: fileInput[currFileIndex].name,
                page: currentPageNumber
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Failed to add page to ChromaDB");
        }

        const result = await response.json();

        if (result.alreadyExists) {
            console.log("Current page already exists in context");
        } else {
            console.log(
                `Current page added to context (${result.chunks} chunks)`
            );
        }
        
        input.value = "";

    } catch (err) {
        console.error("chromaDB error:",err);
        sendOutput("Error adding page to ChromaDB: " + err.message);
    }

}

// Create message Right Bubble
function createMsg(className, text) {
    const div = document.createElement("div");
    div.className = className;
    div.textContent = text;
    return div;
}

// Send Output to message Left Bubble (test)
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


input.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !activeChatController) {
        sendMessage();
    }
});

// Resize sidebar by dragging left edge
let isResizing = false;

resizeHandle.addEventListener("mousedown", function (e) {
    e.preventDefault();
    isResizing = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
});

document.addEventListener("mousemove", function (e) {
    if (!isResizing) return;

    e.preventDefault();

    const minWidth = 250;
    const maxWidth = window.innerWidth * 0.8;
    let newWidth = window.innerWidth - e.clientX;

    if (newWidth < minWidth) newWidth = minWidth;
    if (newWidth > maxWidth) newWidth = maxWidth;

    sidebar.style.width = newWidth + "px";
});

document.addEventListener("mouseup", function () {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
});






// fetch URL and convert to PDF
const fetchBtn = document.getElementById('fetch-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const fetchUrlInput = document.getElementById('fetch-url');
const fetchStatus = document.getElementById('fetch-status');

fetchBtn.addEventListener('click', async () => {
    const url = fetchUrlInput.value.trim();
    if (!url) { fetchStatus.textContent = 'Please enter a URL.'; return; }

    fetchBtn.disabled = true;
    exportPdfBtn.disabled = true;
    document.getElementById("add-to-list-btn").disabled = true;
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
        document.getElementById("add-to-list-btn").disabled = false;
        fetchStatus.textContent = 'Page fetched! Ready to export.';

    } catch (err) {
        fetchStatus.textContent = 'Error: ' + err.message;
    } finally {
        fetchBtn.disabled = false;
    }
});

exportPdfBtn.addEventListener('click', () => {
    if (!window._fetchedPdfBlob)
        return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(window._fetchedPdfBlob);
    const filename = fetchUrlInput.value.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '_').slice(0, 50) + '.pdf';
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    fetchStatus.textContent = 'PDF exported!';
});

document.getElementById("add-to-list-btn").addEventListener("click", async () => {
    if (!window._fetchedPdfBlob) {
        fetchStatus.textContent = 'No fetched PDF to add.';
        return;
    }

    const filename = fetchUrlInput.value
        .replace(/https?:\/\//, '')
        .replace(/[^a-z0-9]/gi, '_')
        .slice(0, 50) + '.pdf';

    //dupe check
    const exists = fileInput.some(f => f.name === filename);
    if (exists) {
        fetchStatus.textContent = "Error: Already added to file list.";
        document.getElementById("add-to-list-btn").disabled = true;
        return;
    }

    try {
        const formData = new FormData();
        const fileObject = new File([window._fetchedPdfBlob], filename, { type: 'application/pdf' });
        formData.append("file", fileObject);
        formData.append("name", filename);

        const uploadResponse = await fetch("http://127.0.0.1:5000/upload-pdf", {
            method: "POST",
            body: formData
        });

        if (!uploadResponse.ok) {
            const err = await uploadResponse.json();
            fetchStatus.textContent = 'Error uploading PDF: ' + (err.error || 'Unknown error');
            return;
        }

        const entry = {
            id: crypto.randomUUID(),
            type: "default",
            name: filename,
            file: null
        };

        fileInput.push(entry);
        fileStates.push({
            pdf: null,
            text: null,
            page: 1,
            line: -1,
            scroll: 0,
            pdfVisible: true,
            relevance: [],
            originLine: null
        });

        const newIndex = fileInput.length - 1;
        setCurrFileIndex(newIndex);
        updateViewState({ currentFile: fileInput[newIndex] });
        const dropdown = document.getElementById("file-dropdown");
        dropdown.value = newIndex;
        showFilesList();
        highlightSelectedFile();
        updateButtons();
        console.log("ADD-TO-LIST: newIndex =", newIndex);
        console.log("ADD-TO-LIST: entry =", entry);
        console.log("ADD-TO-LIST: currFileIndex BEFORE =", currFileIndex);
        console.log("ADD-TO-LIST: fileInput =", fileInput.map(f => f.name));
        loadFileByIndex(newIndex);
        fetchStatus.textContent = 'PDF saved!';
        document.getElementById("add-to-list-btn").disabled = true;
    } catch (err) {
        fetchStatus.textContent = 'Error uploading PDF: ' + err.message;
    }
});