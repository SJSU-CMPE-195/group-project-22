const filesPanel = document.getElementById("fileUploadPanel");
const openUploadBtn = document.getElementById("openUploadBtn");

let fileInput = [];

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
        item.innerHTML = `
        <span class="drag-handle">☰</span>
        <span class="file-order">${index + 1}</span>
        <span class="file-name">${file.name}</span>
        <input type="checkbox" class="file-checkbox" data-index="${index}" checked>
        <button class="move-up-btn" data-index="${index}">↑</button>
        <button class="move-down-btn" data-index="${index}">↓</button>
        <button class="remove-btn" data-index="${index}">✖</button>`;
        list.appendChild(item);
    });

    document.querySelectorAll(".move-up-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            if (index > 0) {
                [fileInput[index - 1], fileInput[index]] = [fileInput[index], fileInput[index - 1]];
                showFilesList();
            }
        };
    });

    document.querySelectorAll(".move-down-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            if (index < fileInput.length - 1) {
                [fileInput[index + 1], fileInput[index]] = [fileInput[index], fileInput[index + 1]];
                showFilesList();
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
            draggingItem = null;
        const newOrder = [...list.querySelectorAll(".file-item")].map(el => el.querySelector(".file-name").textContent);
        fileInput = newOrder.map(name => fileInput.find(file => file.name === name));
        showFilesList();
        });
    });
    list.addEventListener("dragover", (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
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
    showFilesList();
}

function handleFileSelect(event) {
    event.preventDefault();
    const files = event.dataTransfer ? event.dataTransfer.files : event.target.files;
    for (let i = 0; i < files.length; i++) {
        fileInput.push(files[i]);
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

initToggle();

openUploadBtn.addEventListener("click", openUpload);
