import {currFileIndex, fileInput} from './filepanelupload.js';

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
}