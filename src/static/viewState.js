import { currFileIndex, fileInput, setCurrFileIndex, loadFileByIndex, showFilesList } from './filepanelupload.js';
import { loadFile } from './view.js';

export const viewState = {
    pdf: null,
    text: null,
    currentPage: 1,
    currentFile: null,
    totalPages: 0,
    currentLine: 0,
    numTimes: -1,
    mode: "empty"
};

export const fileStates = [];

export function initFileStates(fileInput) {
    fileStates.length = 0;
    for (let i = 0; i < fileInput.length; i++) {
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
    }
}

export function updateViewState(newState) {
    Object.assign(viewState, newState);
}

export function resetViewState() {
    viewState.pdf = null;
    viewState.text = null;
    viewState.currentPage = 1;
    viewState.currentFile = null;
    viewState.totalPages = 0;
    viewState.currentLine = 0;
    viewState.numTimes = -1;
    viewState.mode = "empty";
}

export function updateButtons() {
    const nextLineBtn = document.getElementById("NextLine");
    const prevLineBtn = document.getElementById("prevLine");
    const stepInBtn = document.getElementById("stepIn");
    const stepOutBtn = document.getElementById("stepOut");
    const nextPageBtn = document.getElementById("nextPage");
    const prevPageBtn = document.getElementById("prevPage");
    const menuStepIn = document.getElementById("menu-stepin");
    const menuStepOut = document.getElementById("menu-stepout");
    const menuNextLine = document.getElementById("menu-nextline");
    const menuPrevLine = document.getElementById("menu-prevline");
    const menuNextPage = document.getElementById("menu-nextpage");
    const menuPrevPage = document.getElementById("menu-prevpage");
    const menuNextRelevant = document.getElementById("menu-nextrelevant");
    const menuPrevRelevant = document.getElementById("menu-prevrelevant");
    const hasRelevant = document.querySelectorAll(".relevant-line").length > 0;
    const hasPdf = !!viewState.pdf;
    const hasText = viewState.text && viewState.text.items?.length > 0;
    const textDiv = document.getElementById("textDiv");
    const maxLinesIndex = textDiv.childNodes.length - 1;
    const LineIndex = viewState.numTimes;
    prevPageBtn.disabled = !hasPdf || viewState.currentPage <= 1;
    nextPageBtn.disabled = !hasPdf || viewState.currentPage >= viewState.totalPages;
    nextLineBtn.disabled = !hasText || LineIndex >= maxLinesIndex;
    prevLineBtn.disabled = !hasText || LineIndex <= 0;
    stepInBtn.disabled = !hasText || LineIndex < 0 || currFileIndex >= fileInput.length - 1;
    stepOutBtn.disabled = currFileIndex <= 0;
    menuStepIn.classList.toggle(
        "context-disabled",
        stepInBtn.disabled
    );
    menuStepOut.classList.toggle(
        "context-disabled",
        stepOutBtn.disabled
    );
    menuNextLine.classList.toggle(
        "context-disabled",
        nextLineBtn.disabled
    );
    menuPrevLine.classList.toggle(
        "context-disabled",
        prevLineBtn.disabled
    );
    menuNextPage.classList.toggle(
        "context-disabled",
        nextPageBtn.disabled
    );
    menuPrevPage.classList.toggle(
        "context-disabled",
        prevPageBtn.disabled
    );
    menuNextRelevant.classList.toggle(
        "context-disabled",
        !hasRelevant
    );
    menuPrevRelevant.classList.toggle(
        "context-disabled",
        !hasRelevant
    );
}

export function saveSession() {
    console.log("Saving session");
    localStorage.setItem("LD-Session", JSON.stringify({
        currentFileIndex: currFileIndex,
        fileOrder: fileInput.map(f => ({
            name: f.name, type: f.type
        })),
        fileStates: fileStates.map(state => ({
            page: state.page,
            line: state.line,
            scroll: state.scroll,
            pdfVisible: state.pdfVisible
        }))
    }));
}

export function loadSession() {
    const saved = localStorage.getItem("LD-Session");
    if (!saved) return null;
    return JSON.parse(saved);
}

export async function restoreSession() {
    const session = loadSession();
    if (!session) {
        if (fileInput.length > 0) {
            await loadFileByIndex(0);
        }
        return;
    }
    const reorderedFiles = [];
    session.fileOrder.forEach(savedFile => {
        const found = fileInput.find(
            f =>
                f.name === savedFile.name &&
                f.type === savedFile.type
        );
        if (found) {
            reorderedFiles.push(found);
        }
    });
    fileInput.forEach(file => {
        if (!reorderedFiles.includes(file)) {
            reorderedFiles.push(file);
        }
    });
    fileInput.length = 0;
    fileInput.push(...reorderedFiles);
    session.fileStates.forEach((savedState, i) => {
        if (!fileStates[i]) return;
        Object.assign(fileStates[i], savedState);
    });
    showFilesList();
    setCurrFileIndex(session.currentFileIndex);
    console.log(
        "Restoring state:",
        session.fileStates[session.currentFileIndex]
    );
    await loadFileByIndex(session.currentFileIndex, { restoreHighlight: true });
    console.log("Restoring:", session.currentFileIndex);
    console.log("Restoring states:", fileStates[session.currentFileIndex]);
}

export function clearSession() {
    localStorage.removeItem("LD-Session");
}

window.clearSession = clearSession;
window.saveSession = saveSession;
window.loadSession = loadSession;