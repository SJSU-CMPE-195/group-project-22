
export let resetViewCallback = null;
export function registerResetViewCallback(callback) {
    resetViewCallback = callback;
}
export let loadFileCallback = null;
export function registerLoadFileCallback(callback) {
    loadFileCallback = callback;
}
export let currFileIndex = 0; // Initialize currFileIndex to 0

const filesPanel = document.getElementById("fileUploadPanel");
const openUploadBtn = document.getElementById("openUploadBtn");
const defaultFiles = ["StanfordPaper1.pdf", "ConstitutionWords.pdf", "constitution.pdf", "holmes.pdf"];
export let fileInput = defaultFiles.map(name => ({id: crypto.randomUUID(), type: "default", name })); // Initialize with default files

function openUpload() {
    filesPanel.classList.add("open");
    openUploadBtn.classList.add("hidden");
}

function closeUpload() {
    filesPanel.classList.remove("open");
    openUploadBtn.classList.remove("hidden");
}

function initToggle() {
    filesPanel.innerHTML = `
    <div class="upload-panel">
        <div class="upload-resize-handle"></div>
        <div class="upload-panel-header">
            <button class="close-upload-btn" id="closeUploadBtn">×</button>
            <div class="upload-panel-title">Upload Files</div>
        </div>
        <div class="upload-droparea" id="dropArea">Drag & Drop files here or click to select</div>
        <input type="file" id="fileInput" multiple style="display: none;">
        <div class="upload-fileslist" id="filesList"></div>
    </div>`;

    document.getElementById("closeUploadBtn").addEventListener("click", closeUpload);

    setupFileUpload();
    showFilesList();
}

function showFilesList() {
    const list = document.getElementById("filesList");
    list.innerHTML = "";
    fileInput.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "file-item";
        item.draggable = true;
        item.dataset.index = index;
        item.dataset.id = file.id;
        item.innerHTML = `
        <span class="drag-handle">☰</span>
        <span class="file-order">${index + 1} -</span>
        <span class="file-name" title="${file.name}">
            ${file.name}
        </span>
        <input type="checkbox" class="file-checkbox" data-index="${index}" checked>
        <button class="move-up-btn" data-index="${index}">▲</button>
        <button class="move-down-btn" data-index="${index}">▼</button>
        <button class="remove-btn" data-index="${index}">✖</button>`;
        list.appendChild(item);
        item.addEventListener("click", (e) => {
            if (
                e.target.classList.contains("move-up-btn") ||
                e.target.classList.contains("move-down-btn") ||
                e.target.classList.contains("remove-btn") ||
                e.target.classList.contains("file-checkbox")
            ) {
                return; // Ignore clicks on buttons and checkboxes
            }

            loadFileByIndex(index);
        });
    });

    document.querySelectorAll(".move-up-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            if (index > 0) {
                [fileInput[index - 1], fileInput[index]] = [fileInput[index], fileInput[index - 1]];
                currFileIndex = index - 1; // Update currFileIndex to the new position
                const entry = fileInput[currFileIndex];
                resetViewCallback(); // Reset the view state when files are reordered
                loadFileCallback(entry.type === "default" ? entry.name : entry.file);
                showFilesList();
                highlightSelectedFile();
            }
        };
    });

    document.querySelectorAll(".move-down-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            if (index < fileInput.length - 1) {
                [fileInput[index + 1], fileInput[index]] = [fileInput[index], fileInput[index + 1]];
                currFileIndex = index + 1; // Update currFileIndex to the new position
                const entry = fileInput[currFileIndex];
                resetViewCallback(); // Reset the view state when files are reordered
                loadFileCallback(entry.type === "default" ? entry.name : entry.file);
                showFilesList();
                highlightSelectedFile();
            }
        }
    });

    document.querySelectorAll(".remove-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            removeFile(index);
        };
    });
    enableDragAndDrop();
}

function enableDragAndDrop() {
    const list = document.getElementById("filesList");
    let draggingItem = null;
    list.querySelectorAll(".file-item").forEach(item => {
        item.addEventListener("dragstart", () => {
            draggingItem = item;
            item.classList.add("dragging");
        });
        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");            
            const activeId = fileInput[currFileIndex]?.id;
            const items = [...list.querySelectorAll(".file-item")];
            fileInput = items.map(item => {
                const id = item.dataset.id;
                return fileInput.find(file => file.id === id);
            });
            currFileIndex = fileInput.findIndex(file => file.id === activeId);
            showFilesList();
            highlightSelectedFile();
            const entry = fileInput[currFileIndex];
            resetViewCallback(); // Reset the view state when files are reordered
            loadFileCallback(entry.type === "default" ? entry.name : entry.file);
            draggingItem = null;
        });
    });
    list.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (!draggingItem) {
            return;
        }
        if (afterElement == null) {
            list.appendChild(draggingItem);
        } else {
                list.insertBefore(draggingItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const items = [...container.querySelectorAll(".file-item:not(.dragging)")];
    return items.find
        (item => {
            const box = item.getBoundingClientRect();
            return y < box.top + box.height / 2;
        });
}

function removeFile(index) {
    fileInput.splice(index, 1);
    if (index === currFileIndex) {
        if (fileInput.length > 0) {
            const newIndex = Math.min(currFileIndex, fileInput.length - 1);
            currFileIndex = newIndex;
            resetViewCallback(); // Reset the view state when a file is removed
            showFilesList();
            highlightSelectedFile();
            const entry = fileInput[currFileIndex];
            loadFileCallback(entry.type === "default" ? entry.name : entry.file);
        } else {
            currFileIndex = 0;
            showFilesList();
            clearViewer();
        }
    }
    else if (index < currFileIndex) {
        currFileIndex--;
        showFilesList();
        highlightSelectedFile();
    }
    else {
        showFilesList();
        highlightSelectedFile();
    }
}

function clearViewer() {
    const canvas = document.getElementById("pdf");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const textDiv = document.getElementById("textDiv");
    textDiv.innerHTML = "";
    textDiv.innerHTML = `<div class="no-file-loaded">No file loaded. Please select a file from the list or upload a new one.</div>`;
    if (typeof resetViewCallback === "function") {
        resetViewCallback();
    }
}

function handleFileSelect(event) {
    event.preventDefault();
    const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
    for (let i = 0; i < files.length; i++) {
        fileInput.push({id: crypto.randomUUID(), type: "uploaded", name: files[i].name, file: files[i] });
    }
    showFilesList();
}

function setupFileUpload() {
    const dropArea = document.getElementById("dropArea");
    const fileInputElem = document.getElementById("fileInput");
    dropArea.addEventListener("click", () => fileInputElem.click());
    dropArea.addEventListener("dragover", (e) => e.preventDefault());
    dropArea.addEventListener("drop", handleFileSelect);
    fileInputElem.addEventListener("change", handleFileSelect);
}

function loadFileByIndex(index) {
    const entry = fileInput[index];
    currFileIndex = index;
    resetViewCallback(); // Reset the view state when a new file is selected
    loadFileCallback(entry.type === "default" ? entry.name : entry.file);
    highlightSelectedFile();
    console.log(`Loading file: ${entry.name}`);
    
}

export function highlightSelectedFile() {
    const activeId = fileInput[currFileIndex]?.id;
    const items = document.querySelectorAll(".file-item");
    items.forEach(item => {
        if (item.dataset.id === activeId) {
            item.classList.add("selected");
        } else {
            item.classList.remove("selected");
        }
    });
}

export function setCurrFileIndex(index) {
    currFileIndex = index;
}

function setupUploadResize() {
    const sidebar = document.getElementById("fileUploadPanel");
    const resizeHandle = sidebar.querySelector(".upload-resize-handle");
    let isResizing = false;

    resizeHandle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizing) return;

        e.preventDefault();
        const minWidth = 250;
        const maxWidth = window.innerWidth * 0.8;
        let newWidth = e.clientX;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        sidebar.style.width = newWidth + "px";
    });

    document.addEventListener("mouseup", () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
}

function setupZIndex() {
    const leftSidebar = document.getElementById("fileUploadPanel");
    const rightSidebar = document.querySelector(".sidebar-right");
    if (!leftSidebar || !rightSidebar) return;
    leftSidebar.addEventListener("mousedown", () => {
        leftSidebar.style.zIndex = "1000";
        rightSidebar.style.zIndex = "900";
    });
    rightSidebar.addEventListener("mousedown", () => {
        rightSidebar.style.zIndex = "1000";
        leftSidebar.style.zIndex = "900";
    });
}

initToggle();
setupUploadResize();
setupZIndex();

openUploadBtn.addEventListener("click", openUpload);
