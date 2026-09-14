import { fileStates, initFileStates } from "./viewState.js";

let draggingItem = null;
export let resetViewCallback = null;
export function registerResetViewCallback(callback) {
    resetViewCallback = callback;
}
export let loadFileCallback = null;
export function registerLoadFileCallback(callback) {
    loadFileCallback = callback;
}
export let currFileIndex = 0; // Initialize currFileIndex to 0
export function setCurrFileIndex(value) {
    currFileIndex = value;
}
const filesPanel = document.getElementById("fileUploadPanel");
const openUploadBtn = document.getElementById("openUploadBtn");
const defaultFiles = ["StanfordPaper1.pdf", "ConstitutionWords.pdf", "constitution.pdf", "holmes.pdf"];
export let fileInput = defaultFiles.map(name => ({
    id: crypto.randomUUID(),
    type: "default",
    name
})); // Initialize with default files
initFileStates(fileInput);

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
    setupUploadResize();
    setupZIndex();
    showFilesList();
    setupListEvents();
}

function showFilesList() {
    const list = document.getElementById("filesList");
    list.innerHTML = "";
    fileInput.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "file-item";
        item.draggable = true;
        item.dataset.id = file.id;
        item.innerHTML = `
        <span class="drag-handle">☰</span>
        <span class="file-order">${index + 1} -</span>
        <span class="file-name" title="${file.name}">
            ${file.name}
        </span>
        <input type="checkbox" class="file-checkbox" data-id="${file.id}" checked>
        <button class="move-up-btn" data-id="${file.id}">▲</button>
        <button class="move-down-btn" data-id="${file.id}">▼</button>
        <button class="remove-btn" data-id="${file.id}">✖</button>`;
        list.appendChild(item);
    });
    highlightSelectedFile();
}

function setupListEvents() {
    const list = document.getElementById("filesList");
    
    list.addEventListener("click", (e) => {
        const item = e.target.closest(".file-item");
        if (!item) return;
        const id = item.dataset.id;
        const index = fileInput.findIndex(f => f.id === id);
        if (index === -1) return;
        if (e.target.classList.contains("move-up-btn")) {
            if (index > 0) {
                [fileInput[index - 1], fileInput[index]] = [fileInput[index], fileInput[index - 1]];
                [fileStates[index - 1], fileStates[index]] = [fileStates[index], fileStates[index - 1]];
                currFileIndex = index - 1;
                showFilesList();
                loadFileByIndex(currFileIndex);
            }
            return;
        }
        if (e.target.classList.contains("move-down-btn")) {
            if (index < fileInput.length - 1) {
                [fileInput[index + 1], fileInput[index]] =
                    [fileInput[index], fileInput[index + 1]];

                [fileStates[index + 1], fileStates[index]] =
                    [fileStates[index], fileStates[index + 1]];

                currFileIndex = index + 1;
                showFilesList();
                loadFileByIndex(currFileIndex);
            }
            return;
        }
        if (e.target.classList.contains("remove-btn")) {
            removeFile(id);
            return;
        }
        if (e.target.classList.contains("file-checkbox")) {
            // Not implemented, maybe for enable/disable files that can be step in/out into
            // Might remove if can't think of good use case
            return;
        }
        loadFileByIndex(index);
    });
    list.addEventListener("dragstart", (e) => {
        const item = e.target.closest(".file-item");
        if (!item) return;
        draggingItem = item;
        item.classList.add("dragging");
    });

    list.addEventListener("dragend", (e) => {
        if (!draggingItem) return;
        draggingItem.classList.remove("dragging");

        const activeId = fileInput[currFileIndex]?.id;
        const items = [...list.querySelectorAll(".file-item")];
        const newIndex = items.findIndex(i => i.dataset.id === draggingItem.dataset.id);
        const oldIndex = fileInput.findIndex(f => f.id === draggingItem.dataset.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            draggingItem = null;
            return;
        }
        const [movedFile] = fileInput.splice(oldIndex, 1);
        fileInput.splice(newIndex, 0 , movedFile);
        const [movedState] = fileStates.splice(oldIndex, 1);
        fileStates.splice(newIndex, 0, movedState);
        currFileIndex = fileInput.findIndex(f => f.id === activeId);

        showFilesList();
        loadFileByIndex(currFileIndex);

        draggingItem = null;
    });

    list.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);

        if (!draggingItem) return;

        if (afterElement == null) {
            list.appendChild(draggingItem);
        } else {
            list.insertBefore(draggingItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".file-item:not(.dragging)")];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function removeFile(id) {
    const index = fileInput.findIndex(f => f.id === id);
    if (index === -1) return;
    fileInput.splice(index, 1);
    fileStates.splice(index, 1);
    if (fileInput.length === 0) {
        currFileIndex = 0;
        showFilesList();
        clearViewer();
        return;
    }
    if (index <= currFileIndex) {
        currFileIndex = Math.max(0, currFileIndex - 1);
    }
    showFilesList();
    loadFileByIndex(currFileIndex);
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
        const id = crypto.randomUUID();
        const file = files[i];
        fileInput.push({
            id,
            type: "uploaded",
            name: files[i].name,
            file,
        });
        fileStates.push({
            id,
            pdf: null,
            text: null,
            page: -1,
            line: -1,
            scroll: 0,
            pdfVisible: true
        });
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
    if (!entry) return;
    if (entry.file instanceof File && entry.type !== "uploaded") {
        entry.type = "uploaded";
    }
    currFileIndex = index;
    if (!fileStates[index]) {
        fileStates[index] = {
            id: entry.id,
            pdf: null,
            text: null,
            page: 1,
            line: -1,
            scroll: 0,
            pdfVisible: true
        };
    }

    if (fileStates[index].page == null || fileStates[index].page < 1) {
        fileStates[index].page = 1;
    }
    if (typeof resetViewCallback === "function") {
        resetViewCallback(); // Reset the view state when a new file is selected
    }
    loadFileCallback(entry);
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
openUploadBtn.addEventListener("click", openUpload);
