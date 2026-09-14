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
    const prevLine = viewState.numTimes;
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
        addText(resultObj.text);
        fileStates[currFileIndex].line = 0;
        fileStates[currFileIndex].scroll = 0;
        await navToPage(resultObj.pageNum, {
            restoreHighlight: false,
            resetLine: true
        });
        highlightLine(0);
    }
    updateButtons();
}

export async function stepOut() {
    if (currFileIndex > 0) {
        fileStates[currFileIndex].line = viewState.numTimes;
        fileStates[currFileIndex].scroll = textDiv.scrollTop;
        const prevIndex = currFileIndex - 1;
        setCurrFileIndex(prevIndex);
        const prevFile = fileInput[prevIndex];
        await loadFile(prevFile, {restoreHighlight: true});
        highlightSelectedFile();
    }
    updateButtons();
}

async function getPageData(pdf, pageNum) {
    console.log("DEBUG getPageData: pdf =", pdf);
    console.log("DEBUG getPageData: pageNum =", pageNum);
    const page = await pdf.getPage(pageNum);
    console.log("DEBUG getPageData: page =", page);
    const text = await page.getTextContent();
    return { page, text };
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

export async function loadFile(input, {restoreHighlight = false } = {}) {
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
    if (state.page == null || state.page < 1){
        state.page = 1;
    }
    if (!restoreHighlight && state.pdf && state.pdf !== loadedPdf) {
        state.page = 1;
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
    await navToPage(state.page, {restoreHighlight})

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

async function getWebPage(url) {
    // add a branch to check if there are no stepins.
    const response = await fetch("/getWebpage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),

    });
    const resultObj = await response.json();
    // generate the pdf and load the file.
    // alert("link:" + resultObj.link + "text: " + resultObj.text)
    addText(resultObj.text);
}

function addText(text) {
    // clears the text div
    textDiv.innerHTML = "";
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
        updateViewState({numTimes: -1});
    }
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
    navToPage(target, {restoreHighlight: false});
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
