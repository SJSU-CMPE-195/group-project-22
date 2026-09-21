//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
// get the worker code as well
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
import { fileInput, currFileIndex, registerLoadFileCallback, highlightSelectedFile, setCurrFileIndex, registerResetViewCallback } from "./filepanelupload.js";
registerLoadFileCallback(loadFile); // Register the loadFile function as a callback
registerResetViewCallback(resetView); // Register the resetViewState function as a callback

import { viewState, updateViewState, resetViewState as resetGlobalViewState, updateButtons, fileStates } from "./viewState.js";
const scale = 1;
const canvas = document.getElementById("pdf");
const context = canvas.getContext("2d");
const pdfContainer = document.querySelector(".viewer-left");
let nextLineBtn = document.getElementById("NextLine");
let nextPageBtn = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");
var stepInText;

document.getElementById("stepIn").addEventListener("click", stepIn);
document.getElementById("stepOut").addEventListener("click", stepOut);
export async function stepIn() {
    fileStates[currFileIndex].originLine = viewState.numTimes;
    const prevLine = textDiv.childNodes[viewState.numTimes].innerText;
    if (currFileIndex < fileInput.length - 1) {
        const nextIndex = currFileIndex + 1;
        setCurrFileIndex(nextIndex);
        const nextFile = fileInput[nextIndex];
        if (!nextFile) {
            console.error("No file at index", nextIndex);
            return;
        }
        await loadFile(nextFile);
        highlightSelectedFile();
        const response = await fetch("/stepIn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                line: prevLine,
                fileName: fileInput[currFileIndex].name
            })
        });
        const resultObj = await response.json();
        if (resultObj.text.toLowerCase().includes("no relevant")) {
            alert("No relevant text found.");
            return;
        }
        const backendPageText = resultObj.pageText;
        const correctPage = await findPageByText(backendPageText);
        if (correctPage === -1) {
            alert("Relevant text found, but page could not be matched");
            return;
        }
        const relevantLines = resultObj.text
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0);
        fileStates[currFileIndex].line = 0;
        fileStates[currFileIndex].scroll = 0;
        await navToPage(correctPage, {
            restoreHighlight: false,
            resetLine: true
        });
        alert(
            "Stepped in with:\n" + prevLine +
            "\n\nRelevant text from " + fileInput[currFileIndex].name + ":\n\n" +
            resultObj.text
        );
        markRelevantLines(relevantLines);
        const pageLines = Array.from(textDiv.childNodes).map(n => n.innerText.trim());
        let matchIndex = -1;
        const normalizedRel = relevantLines.map(normalize);
        const normalizedPageLines = pageLines.map(normalize);
        for (let i = 0; i < normalizedPageLines.length; i++) {
            for (let j = 0; j < normalizedRel.length; j++){
                if (normalizedPageLines[i].includes(normalizedRel[j]) ||
                    normalizedRel[j].includes(normalizedPageLines[i])) 
                    {
                    matchIndex = i;
                    break;  
                }
            }
            if (matchIndex >= 0) break;
        }
        if (matchIndex >= 0) {
            textDiv.childNodes[matchIndex].scrollIntoView({ behavior: "smooth", block: "center" })
        }
        else {
            console.log(" no match found in frontend");
        }
    }
    updateButtons();
}

export async function stepOut() {
    clearRelevantLines();
    if (currFileIndex > 0) {
        const prevIndex = currFileIndex - 1;
        fileStates[prevIndex].line = fileStates[prevIndex].originLine;
        fileStates[prevIndex].scroll = textDiv.scrollTop;
        setCurrFileIndex(prevIndex);
        const prevFile = fileInput[prevIndex];
        await loadFile(prevFile, { restoreHighlight: true });
        highlightSelectedFile();
    }
    updateButtons();
}

async function getPageData(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    const text = await page.getTextContent();
    return { page, text };
}

async function findPageByText(backendPageText) {
    const normalizedBackend = normalize(backendPageText);
    const pdf = viewState.pdf;
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
        const { text } = await getPageData(pdf, i);
        const pageText = text.items
            .map(item => item.str.trim())
            .filter(str => str.length > 0)
            .join(" ");
        const normalizedPage = normalize(pageText);
        if (normalizedPage.includes(normalizedBackend) ||
        normalizedBackend.includes(normalizedPage)) {
            return i;
        }    
    }
    return -1;
}

function markRelevantLines(lines) {
    const normalized = lines.map(normalize);
    const textNodes = textDiv.childNodes;
    for (let i = 0; i < textNodes.length; i++) {
        const nodeText = normalize(textNodes[i].innerText);
        for (let j = 0; j < normalized.length; j++){
            if (nodeText.includes(normalized[j])||normalized[j].includes(nodeText)) {
                textNodes[i].classList.add("relevant-line");
                break;
            }
        }
    }
}

function clearRelevantLines() {
    const textNodes = textDiv.childNodes;
    for (let node of textNodes) {
        node.classList.remove("relevant-line");
    }
}

function normalize(str) {
    return str
        .replace(/\s+/g, " ")
        .replace(/[^\x00-\x7F]/g, "")
        .trim()
        .toLowerCase();
}

async function getRelevantSection(stepLine, file) {
    const obj = { line: stepLine, fileName: fileInput[currFileIndex].name };
    const response = await fetch("/stepIn", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(obj),
    });
    const res = await response.json()
    const string = JSON.parse(res);
    alert("Stepped in with: " + stepLine + "Relevant Text from this file: " + file + "\n" + string)
    // get the page.
    // highlight any that start with, what we have and end with
    const arr = string.trim().split("\n");
    for (let pageNum = 1; pageNum <= viewState.totalPages; pageNum++) {
        const { text: pageText } = await getPageData(viewState.pdf, pageNum);
        for (let line of arr) {
            if (pageText.items.some(item => item.str.trim() === line.trim())) {
                return pageNum;
            }
        }
    }
    return null; // No relevant page found
}

export async function loadFile(input, { restoreHighlight = false } = {}) {
    if (!input) return;
    let params = {};

    if (input.type === "default") {
        params.url = `/files/default/${input.name}`;
    }
    else if (input.type === "uploaded" && input.file instanceof File) {
        params.url = URL.createObjectURL(input.file);
    } else {
        console.error("Unknown entry type or missing file:", input);
        return;
    }

    // loading document
    const loadingDoc = pdfjsLib.getDocument(params);
    const loadedPdf = await loadingDoc.promise;
    const state = fileStates[currFileIndex];
    if (state.page == null || state.page < 1) {
        state.page = 1;
    }
    if (!restoreHighlight && state.pdf && state.pdf !== loadedPdf) {
        state.line = 0;
        state.scroll = 0;
    }
    state.pdf = loadedPdf;
    updateViewState({
        pdf: loadedPdf,
        totalPages: loadedPdf.numPages,
        mode: "viewing"
    });

    if (state.text) {
        addText(state.text);
    }
    await navToPage(state.page, { restoreHighlight })

    pdfContainer.style.display = state.pdfVisible ? "block" : "none";
}

function updatePageDisplay() {
    const display = document.getElementById("pageDisplay");
    display.textContent = `Page ${viewState.currentPage} of ${viewState.totalPages}`;
}

export async function renderPage(pageNum, restoreHighlight = false) {
    const pdf = viewState.pdf;
    const { page, text: extractedText } = await getPageData(pdf, pageNum);
    updateViewState({
        page: page,
        text: extractedText,
        currentPage: pageNum
    });
    const state = fileStates[currFileIndex];
    state.page = pageNum;
    state.text = extractedText;
    updatePageDisplay();
    addText(extractedText);

    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    page.render({ canvasContext: context, viewport });
    updateButtons();
    if (state.line >= 0 && restoreHighlight) {
        highlightLine(state.line, true);
    }
}

function highlightLine(lineIndex, silent = false) {
    const lines = textDiv.childNodes;
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    if (viewState.numTimes >= 0 && viewState.numTimes < lines.length) {
        lines[viewState.numTimes].style.backgroundColor = "transparent";
    }
    lines[lineIndex].style.backgroundColor = "yellow";
    updateViewState({ numTimes: lineIndex });
    if (!silent) {
        lines[lineIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

textDiv.addEventListener("scroll", () => {
    fileStates[currFileIndex].scroll = textDiv.scrollTop;
});

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

nextLineBtn.addEventListener("click", () => {
    const lines = textDiv.childNodes;
    if (viewState.numTimes < lines.length - 1) {
        const newIndex = viewState.numTimes + 1;
        highlightLine(newIndex);
        fileStates[currFileIndex].line = newIndex;
        updateButtons();
    }
});

let prevLineBtn = document.getElementById("prevLine");
prevLineBtn.addEventListener("click", () => {
    if (viewState.numTimes > 0) {
        const newIndex = viewState.numTimes - 1;
        highlightLine(newIndex);
        fileStates[currFileIndex].line = newIndex;
        updateButtons();
    }
});

let prevPageBtn = document.getElementById("prevPage");
prevPageBtn.addEventListener("click", function () {
    getPrevPage();
});

nextPageBtn.addEventListener("click", function () {
    getNextPage();
});

async function getPrevPage() {
    if (viewState.currentPage > 1) {
        navToPage(viewState.currentPage - 1, { restoreHighlight: false });
    }
}

async function getNextPage() {
    if (viewState.currentPage < viewState.totalPages) {
        navToPage(viewState.currentPage + 1, { restoreHighlight: false });
    }
}

export function getCurrentPageText() {
    if (!viewState.text || !viewState.text.items) return "";

    return viewState.text.items
        .map(item => item.str?.trim() || "")
        .filter(str => str.length > 0)
        .join("\n");
}

export function resetView() {
    resetGlobalViewState();
    textDiv.innerHTML = "";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    updateButtons();
}

document.getElementById("urlContext").addEventListener("click", getWebPage);

async function getWebPage() {
    const index = viewState.numTimes;
    const line = textDiv.childNodes[index];
    if (!line) {
        alert("No highlighted line.");
        return;
    }
    const lineTrimmed = line.innerText.trim();
    
    // add a branch to check if there are no stepins.
    const response = await fetch("/getWebpage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: lineTrimmed }),

    });
    const resultObj = await response.json();
    // generate the pdf and load the file.
    alert("link:" + resultObj.link + "text: " + resultObj.text)

}

function addText(text) {
    // clears the text div
    textDiv.innerHTML = "";

    if (typeof text === "string") {
        const lines = text.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;
            const p = document.createElement("p");
            p.textContent = trimmed;
            textDiv.appendChild(p);
        }
        return;
    }
    for (let item of text.items) {
        const str = item.str.trim();
        // skips empty lines 
        if (str.length == 0) {
            continue;
        }
        const p = document.createElement("p");
        p.textContent = str;
        // Now add to div
        textDiv.appendChild(p);

    }
}

async function navToPage(pageNum, { restoreHighlight = false, resetLine = false } = {}) {
    const state = fileStates[currFileIndex];
    if (resetLine) {
        state.line = 0;
        state.scroll = 0;
    }
    if (!restoreHighlight) {
        state.line = -1;
        state.scroll = 0;
        updateViewState({ numTimes: -1 });
    }
    updateViewState({currentPage: pageNum});
    state.page = pageNum;
    await renderPage(pageNum, restoreHighlight);
    if (restoreHighlight) {
        requestAnimationFrame(() => {
            textDiv.scrollTop = state.scroll;
        });
    }
}

document.getElementById("jumpBtn").addEventListener("click", function () {
    let target = parseInt(document.getElementById("jumpInput").value);
    if (isNaN(target)) return;
    if (target < 1) target = 1;
    if (target > viewState.totalPages) target = viewState.totalPages;
    navToPage(target, { restoreHighlight: false });
});

jumpInput.addEventListener("input", () => {
    let value = parseInt(jumpInput.value);
    if (isNaN(value)) return;
    if (value < 1) value = 1;
    if (value > viewState.totalPages) value = viewState.totalPages;
    jumpInput.value = value;
});

jumpInput.addEventListener("keydown", (e) => {
    const allowed = [
        "Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"
    ];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("togglePdf");
    const pdfContainer = document.querySelector(".viewer-left");
    const viewer = document.querySelector(".viewer-container");

    toggleBtn.addEventListener("click", function () {
        const hidden = pdfContainer.style.display === "none";
        pdfContainer.style.display = hidden ? "block" : "none";
        viewer.classList.toggle("single-column", !hidden);
    });
    loadFile(fileInput[currFileIndex]);
});
