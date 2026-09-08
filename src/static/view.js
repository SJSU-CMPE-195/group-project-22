//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
// get the worker code as well
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
import { fileInput, currFileIndex, registerLoadFileCallback, highlightSelectedFile, setCurrFileIndex, registerResetViewCallback } from "./filepanelupload.js";
registerLoadFileCallback(loadFile); // Register the loadFile function as a callback
registerResetViewCallback(resetView); // Register the resetViewState function as a callback
 
import { viewState, updateViewState, resetViewState as resetGlobalViewState, updateButtons } from "./viewState.js";
const scale = 1;
const canvas = document.getElementById("pdf");
const context = canvas.getContext("2d");
let nextLineBtn = document.getElementById("NextLine");
let nextPageBtn = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");
var stepInText;

document.getElementById("stepIn").addEventListener("click", stepIn);
document.getElementById("stepOut").addEventListener("click", stepOut);
export async function stepIn() {
    var stepInChanged = 0
    if (viewState.numTimes >= 0) {
        stepInText = textDiv.childNodes[viewState.numTimes].innerText;
        stepInChanged = 1
    }
    if (currFileIndex < fileInput.length - 1) {
        setCurrFileIndex(currFileIndex + 1);
        await loadFile(fileInput[currFileIndex].type === "default" ? fileInput[currFileIndex].name : fileInput[currFileIndex].file);
        highlightSelectedFile();
        if (stepInChanged == 1) {
            await getRelevantSection(stepInText, fileInput[currFileIndex].name);
        }
        else {
            alert("No line was selected from the previous file")
        }
    }
    // When out of files, request a webpage.
    else {
        await getWebPage();
    }
    updateButtons();
}

async function getRelevantSection(stepLine, file) {
    var obj = { line: stepLine, fileName: fileInput[currFileIndex].name };
    const response = await fetch("/stepIn", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(obj),
    });
    var res = await response.json()
    var string = JSON.parse(res);
    alert("Stepped in with: " + stepLine + "Relevant Text from this file: " + file + "\n" + string)
    // get the page.
    // highlight any that start with, what we have and end with
    var arr = string.trim().split("\n");
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].charAt(arr[i].length - 1) == ' ') {
            arr[i] = arr[i].substring(0, arr[i].length - 1);
            console.log("String: " + arr[i]);
        }
    }
    var ind = 1;
    var jIn = 0;
    var newPage = viewState.page;
    var count = 0;
    var newPageText = viewState.text;
    while (jIn < arr.length && ind <= viewState.totalPages) {
        for (let i = 0; i < newPageText.items.length; i++) {
            if (newPageText.items[i].str.includes(arr[jIn])) {
                console.log("found: " + newPageText.items[i].str);
                updateViewState({
                    page: newPage,
                    text: newPageText,
                    currentPage: ind,
                    numTimes: -1,
                })
                addText(newPageText);
                for (let i = 0; i < textDiv.childNodes.length; i++) {
                    console.log("textDiv:" + textDiv.childNodes[i].innerText);
                    if (textDiv.childNodes[i].innerText.includes(arr[jIn])) {
                        console.log("Highlighted!")
                        textDiv.childNodes[i].style.backgroundColor = "lightgrey"
                        jIn += 1;
                    }
                    if (jIn >= arr.length) {
                        console.log("found");
                        break;
                    }
                }
                count += 1;
                console.log(count);
                const viewport = newPage.getViewport({ scale });
                newPage.render({ canvasContext: context, viewport });
                updateButtons();
            }
        }
        ind = ind + 1;
        if (ind <= viewState.totalPages) {
            newPage = await viewState.pdf.getPage(ind)
            newPageText = await newPage.getTextContent();
        }
    }
}

export async function stepOut() {
    if (currFileIndex > 0) {
        setCurrFileIndex(currFileIndex - 1);
        await loadFile(fileInput[currFileIndex].type === "default" ? fileInput[currFileIndex].name : fileInput[currFileIndex].file);
        highlightSelectedFile();
    }
    updateButtons();
}

export async function loadFile(input) {
    let params = {};

    if (typeof input === "string") {
        params.url = `/static/${input}`;
    }
    else if (input instanceof File) {
        params.url = URL.createObjectURL(input);
    }

    // loading document
    const loadingDoc = pdfjsLib.getDocument(params);
    const loadedPdf = await loadingDoc.promise;
    const firstPage = await loadedPdf.getPage(1);
    const extractedText = await firstPage.getTextContent();
    updateViewState({
        pdf: loadedPdf,
        page: firstPage,
        text: extractedText,
        currentPage: 1,
        currentLine: 0,
        numTimes: -1,
        totalPages: loadedPdf.numPages,
        mode: "viewing"
    });
    addText(extractedText);
    const viewport = firstPage.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    firstPage.render({ canvasContext: context, viewport });
    updateButtons();
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

nextLineBtn.addEventListener("click", function () {
    if (!viewState.text || !viewState.text.items || viewState.text.items.length === 0) {
        return; // No text to navigate through
    }
    //this prints the line
    if (viewState.numTimes < textDiv.childNodes.length - 1) {
        console.log(viewState.numTimes);
        if (viewState.numTimes >= 0) {
            textDiv.childNodes[viewState.numTimes].style.backgroundColor = "transparent";
        }
        updateViewState({ numTimes: viewState.numTimes + 1 });
        textDiv.childNodes[viewState.numTimes].style.backgroundColor = "yellow";
        textDiv.childNodes[viewState.numTimes].scrollIntoView({ behavior: "smooth", block: "center" });
        updateButtons();
    }
});

let prevLineBtn = document.getElementById("prevLine");
prevLineBtn.addEventListener("click", function () {
    if (!viewState.text || !viewState.text.items || viewState.text.items.length === 0) {
        return; // No text to navigate through
    }
    if (viewState.numTimes > 0) {
        textDiv.childNodes[viewState.numTimes].style.backgroundColor = "transparent";
        updateViewState({ numTimes: viewState.numTimes - 1 });
        textDiv.childNodes[viewState.numTimes].style.backgroundColor = "yellow";
        textDiv.childNodes[viewState.numTimes].scrollIntoView({ behavior: "smooth", block: "center" });
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
        const newPageNum = viewState.currentPage - 1;
        const newPage = await viewState.pdf.getPage(newPageNum);
        const newText = await newPage.getTextContent();
        updateViewState({
            currentPage: newPageNum,
            page: newPage,
            text: newText,
            currentLine: 0,
            numTimes: -1
        });
        addText(newText);
        const viewport = newPage.getViewport({ scale });
        newPage.render({ canvasContext: context, viewport });
        updateButtons();
    }
}

export function getCurrentPageText() {
    if (!viewState.text || !viewState.text.items) return "";

    return viewState.text.items
        .map(item => item.str?.trim() || "")
        .filter(str => str.length > 0)
        .join("\n");
}


async function getNextPage() {
    // if at last page, do nothing
    if (viewState.currentPage >= viewState.pdf.numPages) {
        return;
    }

    const newPageNum = viewState.currentPage + 1;
    const newPage = await viewState.pdf.getPage(newPageNum);
    const newText = await newPage.getTextContent();
    updateViewState({
        currentPage: newPageNum,
        page: newPage,
        text: newText,
        currentLine: 0,
        numTimes: -1
    });
    addText(newText);
    const viewport = newPage.getViewport({ scale });
    newPage.render({ canvasContext: context, viewport });
    updateButtons();
}

export function resetView() {
    resetGlobalViewState();
    textDiv.innerHTML = "";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    updateButtons();
}

async function getWebPage() {
    // add a branch to check if there are no stepins.
    const response = await fetch("/getWebpage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(stepInText),

    });
    var result = await response.json();
    var resultObj = JSON.parse(result);
    // generate the pdf and load the file.
    alert("link:" + resultObj.link + "text: " + resultObj.text)

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

const toggleBtn = document.getElementById("togglePdf");
const pdfContainer = document.getElementById("pdf");
const viewer = document.querySelector(".viewer-container");

toggleBtn.addEventListener("click", function () {
    if (pdfContainer.style.display === "none") {
        pdfContainer.style.display = "block";
        viewer.classList.remove("single-column");
    } else {
        pdfContainer.style.display = "none";
        viewer.classList.add("single-column");
    }
});
loadFile(fileInput[currFileIndex].type === "default" ? fileInput[currFileIndex].name : fileInput[currFileIndex].file);