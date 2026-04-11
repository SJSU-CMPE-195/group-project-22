const filesPanel   = document.getElementById("fileUploadPanel");
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
        item.innerHTML = `${file.name} <button class="remove-btn" data-index="${index}">Remove</button>`;
        list.appendChild(item);
    });

    document.querySelectorAll(".remove-btn").forEach(btn => {
        btn.onclick = () => {
            const index = parseInt(btn.getAttribute("data-index"));
            removeFile(index);
        };
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
    const dropArea    = document.getElementById("dropArea");
    const fileInputElem = document.getElementById("fileInput");
    dropArea.addEventListener("click", () => fileInputElem.click());
    dropArea.addEventListener("dragover", (e) => e.preventDefault());
    dropArea.addEventListener("drop", handleFileSelect);
    fileInputElem.addEventListener("change", handleFileSelect);
}

initToggle();

openUploadBtn.addEventListener("click", openUpload);
