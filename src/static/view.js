import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
import { fileInput, currFileIndex, registerLoadFileCallback, highlightSelectedFile, setCurrFileIndex, registerResetViewCallback } from "./filepanelupload.js";
import { viewState, updateViewState, resetViewState as resetGlobalViewState, updateButtons, fileStates, saveSession, restoreSession } from "./viewState.js";

const scale = 1;
const canvas = document.getElementById("pdf");
const context = canvas.getContext("2d");
const pdfContainer = document.querySelector(".viewer-left");
let nextLineBtn = document.getElementById("NextLine");
let nextPageBtn = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");
let activeController = null;

document.getElementById("stepIn").addEventListener("click", stepIn);
document.getElementById("stepOut").addEventListener("click", stepOut);
/* 
Step in workflow: 
Saves current nav state + selected line, 
Move to next file in line, 
Asks backend for relevant text to selected line,
Nav to page with the text in destination file,
Highlight/mark relevant lines on page,
Preserves state for stepOut to return back to original location
*/
export async function stepIn() {
    // disable until line is highlighted
    const cancelBtn = document.getElementById("cancelStepIn");
    cancelBtn.classList.remove("hidden");
    const stepInBtn = document.getElementById("stepIn");
    stepInBtn.disabled = true;
    showLoadingOverlay("Stepping in");
    document.querySelector(".stepin-text").style.opacity = "0";
    document.querySelector(".stepin-spinner").classList.remove("hidden");
    activeController = new AbortController();
    const signal = activeController.signal;
    try {
        // saves currently highlighted line to go back to later
        fileStates[currFileIndex].originLine = viewState.numTimes;
        const prevLine = viewState.numTimes;
        // if line doesnt exist
        if (
            prevLine == null ||
            prevLine < 0 ||
            prevLine >= textDiv.childNodes.length
        ) {
            alert("Cannot step in: the selected line does not exist in this file.");
            return;
        }
        // taking selected line for query, moving to next file
        var stepInLine = textDiv.childNodes[prevLine].innerText
        if (currFileIndex < fileInput.length - 1) {
            const nextIndex = currFileIndex + 1;
            setCurrFileIndex(nextIndex);
            saveSession();
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
                    line: stepInLine,
                    fileName: fileInput[currFileIndex].name
                }),
                signal
            });
            const resultObj = await response.json();
            console.log("pageNum:", resultObj.pageNum);
            console.log("pageText:", resultObj.pageText);
            console.log("relevantText:", resultObj.text);

            if (!resultObj || typeof resultObj.text !== "string") {
                alert("Invalid response from server.");
                return;
            }

            if (resultObj.text.toLowerCase().includes("no mention")) {
                alert(resultObj.text);
                return;
            }

            const correctPage = resultObj.pageNum;
            if (correctPage === null || correctPage < 0) {
                alert("Relevant text found, but page could not be matched");
                return;
            }
            const relevantLines = resultObj.text
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0);
            fileStates[currFileIndex].line = 0;
            fileStates[currFileIndex].scroll = 0;
            // navigates to page with the relevant text, marks them in gray + scrolls
            await navToPage(correctPage, {
                restoreHighlight: false,
                resetLine: true
            });
            alert(
                "Stepped in with:\n" + stepInLine +
                "\n\nRelevant text from " + fileInput[currFileIndex].name + ":\n\n" +
                resultObj.text
            );
            markRelevantLines(relevantLines);
            const pageLines = Array.from(textDiv.childNodes).map(n => n.innerText.trim());
            let matchIndex = -1;
            const normalizedRel = relevantLines.map(normalize);
            const normalizedPageLines = pageLines.map(normalize);
            for (let i = 0; i < normalizedPageLines.length; i++) {
                for (let j = 0; j < normalizedRel.length; j++) {
                    if (normalizedPageLines[i].includes(normalizedRel[j]) ||
                        normalizedRel[j].includes(normalizedPageLines[i])) {
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
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Step-in operation was aborted.");
        } else {
            console.error("Error during step-in:", error);
            alert("An error occurred during step-in. Please check the console for details.");
        }
    }
    finally {
        activeController = null;
        stepInBtn.disabled = true;
        document.querySelector(".stepin-text").style.opacity = "1";
        document.querySelector(".stepin-spinner").classList.add("hidden");
        cancelBtn.classList.add("hidden");
        hideLoadingOverlay();
    }
}

document.getElementById("cancelStepIn").addEventListener("click", cancelStepIn);
function cancelStepIn() {
    if (!activeController) return;

    if (activeController) {
        activeController.abort();
        activeController = null;
        document.getElementById("stepIn").disabled = false;
        document.querySelector(".stepin-text").style.opacity = "1";
        document.querySelector(".stepin-spinner").classList.add("hidden");
        document.getElementById("cancelStepIn").classList.add("hidden");
    }
}

export async function stepOut() {
    clearRelevantLines();
    if (currFileIndex > 0) {
        const prevIndex = currFileIndex - 1;
        fileStates[prevIndex].line = fileStates[prevIndex].originLine;
        fileStates[prevIndex].scroll = viewerRight.scrollTop;
        setCurrFileIndex(prevIndex);
        saveSession();
        const prevFile = fileInput[prevIndex];
        await loadFile(prevFile, { restoreHighlight: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        highlightSelectedFile();
    }
    updateButtons();
}

function showLoadingOverlay(message = "Loading") {
    document.getElementById("interaction-blocker").classList.remove("hidden");

    const indicator = document.getElementById("loading-indicator");
    const text = document.getElementById("loading-text");
    text.textContent = message;

    indicator.classList.remove("hidden");
}

function hideLoadingOverlay() {
    document.getElementById("interaction-blocker").classList.add("hidden");
    document.getElementById("loading-indicator").classList.add("hidden");
}

async function getPageData(pdf, pageNum) {
    const page = await pdf.getPage(pageNum);
    const text = await page.getTextContent();
    return { page, text };
}

function markRelevantLines(lines) {
    const normalized = lines.map(normalize);

    const textNodes = textDiv.childNodes;

    for (let i = 0; i < textNodes.length; i++) {
        const nodeText = normalize(textNodes[i].innerText);

        for (let j = 0; j < normalized.length; j++) {
            if (
                nodeText.includes(normalized[j]) ||
                normalized[j].includes(nodeText)
            ) {
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
        node.classList.remove("highlight-overlap");
    }
}

function normalize(str) {
    return str
        .replace(/\s+/g, " ")
        .replace(/[^\x00-\x7F]/g, "")
        .trim()
        .toLowerCase();
}

export async function loadFile(input, { restoreHighlight = false } = {}) {
    console.log("Blocker active at loadFile:",
        !document.getElementById("interaction-blocker").classList.contains("hidden")
    );

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
    if (state.page < 1) {
        state.page = 1;
    }

    if (state.page > loadedPdf.numPages) {
        console.warn(
            `Page ${state.page} exceeds max ${loadedPdf.numPages} for ${input.name}`
        );
        state.page = 1;
    }
    await navToPage(state.page, { restoreHighlight })

    pdfContainer.style.display = state.pdfVisible ? "block" : "none";
}

function updatePageDisplay() {
    const display = document.getElementById("pageDisplay");
    display.textContent = `${viewState.currentPage} of ${viewState.totalPages}`;
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
    if (state.line >= 0 && restoreHighlight) {
        console.log(
            "restore line:",
            state.line,
            "numTimes before:",
            viewState.numTimes
        );
        const lines = textDiv.childNodes;
        if (state.line < lines.length) {
            highlightLine(state.line);
        } else {
            state.line = -1;
            updateViewState({ numTimes: -1 });
        }
    }
    updateButtons();
}

function highlightLine(lineIndex, silent = false) {
    const lines = textDiv.childNodes;
    if (!lines || lines.length === 0) {
        console.warn("No lines available to highlight.");
        return;
    }
    if (lineIndex < 0 || lineIndex >= lines.length) {
        console.warn("Line index out of bounds:", lineIndex);
        return;
    }
    if (viewState.numTimes >= 0 && viewState.numTimes < lines.length && viewState.numTimes !== lineIndex) {
        lines[viewState.numTimes].classList.remove("nav-highlight", "highlight-overlap");
    }
    const targetLine = lines[lineIndex];
    if (!targetLine) {
        console.warn("No line found at index:", lineIndex);
        return;
    }
    targetLine.classList.add("nav-highlight");
    if (targetLine.classList.contains("relevant-line")) {
        targetLine.classList.add("highlight-overlap");
    }
    updateViewState({ numTimes: lineIndex });
    fileStates[currFileIndex].line = lineIndex;
    if (!silent) {
        targetLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    saveSession();
}

const viewerRight = document.querySelector(".viewer-right");
viewerRight.addEventListener("scroll", () => {
    fileStates[currFileIndex].scroll = viewerRight.scrollTop;
    console.log("Saved scroll:", viewerRight.scrollTop);
});
window.addEventListener("beforeunload", () => {
    fileStates[currFileIndex].scroll = viewerRight.scrollTop;
    saveSession();
});

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
    const btn = document.getElementById("urlContext");
    const spinner = btn.querySelector(".spinner");
    const text = btn.querySelector(".btn-text");
    const cancelBtn = document.getElementById("cancelStepIn");
    cancelBtn.classList.remove("hidden");
    activeController = new AbortController();
    const signal = activeController.signal;
    btn.disabled = true;
    showLoadingOverlay("Fetching webpage");
    spinner.classList.remove("hidden");
    text.style.opacity = "0.4";
    try {
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
            signal
        });
        const resultObj = await response.json();
        // generate the pdf and load the file.
        alert("link:" + resultObj.link + "text: " + resultObj.text)
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Get webpage operation was aborted.");
            return;
        }
        console.error("Error during getWebPage:", error);
    }
    finally {
        activeController = null;
        cancelBtn.classList.add("hidden");
        btn.disabled = false;
        spinner.classList.add("hidden");
        text.style.opacity = "1";
        hideLoadingOverlay();
    }
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

export async function navToPage(pageNum, { restoreHighlight = false, resetLine = false } = {}) {
    const state = fileStates[currFileIndex];
    if (resetLine) {
        state.line = 0;
        state.scroll = 0;
    }
    if (!restoreHighlight) {
        state.line = -1;
        updateViewState({ numTimes: -1 });
    }
    updateViewState({ currentPage: pageNum });
    state.page = pageNum;
    await renderPage(pageNum, restoreHighlight);
    if (restoreHighlight) {
        requestAnimationFrame(() => {
            viewerRight.scrollTop = state.scroll;
        });
    }
    saveSession();
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
    registerLoadFileCallback(loadFile); // Register the loadFile function as a callback
    registerResetViewCallback(resetView); // Register the resetViewState function as a callback
    const toggleBtn = document.getElementById("togglePdf");
    const pdfContainer = document.querySelector(".viewer-left");
    const viewer = document.querySelector(".viewer-container");

    toggleBtn.addEventListener("click", function () {
        const hidden = pdfContainer.style.display === "none";
        pdfContainer.style.display = hidden ? "block" : "none";
        viewer.classList.toggle("single-column", !hidden);
    });
    const waitForPdf = setInterval(async () => {
        if (fileInput && fileInput.length > 0) {
            clearInterval(waitForPdf);
            await restoreSession();
        }
    }, 50);
});

document.getElementById("themeToggle").addEventListener("click", () => {
    const body = document.body;
    const sun = document.querySelector(".sun");
    const moon = document.querySelector(".moon");
    body.classList.toggle("dark");
    const dark = body.classList.contains("dark");
    sun.classList.toggle("hidden", dark);
    moon.classList.toggle("hidden", !dark);
});

const contextMenu = document.getElementById("contextMenu");
textDiv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.classList.remove("hidden");
});

document.addEventListener("click", () => {
    contextMenu.classList.add("hidden");
});

document.getElementById("menu-stepin")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        stepIn();
    });

document.getElementById("menu-stepout")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        stepOut();
    });

document.getElementById("menu-nextline")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        nextLineBtn.click();
    });

document.getElementById("menu-prevline")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        prevLineBtn.click();
    });

document.getElementById("menu-nextpage")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        nextPageBtn.click();
    });

document.getElementById("menu-prevpage")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        prevPageBtn.click();
    });

document.getElementById("menu-btn-text")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        getWebPage();
    });

let currRelevantIndex = 0;
function nextRelevant() {
    const relevant = document.querySelectorAll(".relevant-line");
    if (!relevant.length) return;
    currRelevantIndex = (currRelevantIndex + 1) % relevant.length;
    relevant[currRelevantIndex].scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    highlightLine(Array.from(textDiv.childNodes).indexOf(relevant[currRelevantIndex]));
}
function prevRelevant() {
    const relevant = document.querySelectorAll(".relevant-line");
    if (!relevant.length) return;
    currRelevantIndex = (currRelevantIndex - 1 + relevant.length) % relevant.length;
    relevant[currRelevantIndex].scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    highlightLine(Array.from(textDiv.childNodes).indexOf(relevant[currRelevantIndex]));
}

document.getElementById("menu-nextrelevant")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        nextRelevant();
    });

document.getElementById("menu-prevrelevant")
    .addEventListener("click", () => {
        contextMenu.classList.add("hidden");
        prevRelevant();
    });

export async function jumpTo(file, pageNum, lineNum) {
    const index = fileInput.findIndex(f => f.name === file);
    if (index === -1) {
        console.error("No file found:", file);
        return;
    }
    setCurrFileIndex(index);
    await loadFile(fileInput[index]);
    await navToPage(pageNum, { restoreHighlight: false });
    if (lineNum >= 0) {
        highlightLine(lineNum);
    }
}