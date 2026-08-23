//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
// get the worker code as well
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
import { fileInput, currFileIndex, registerLoadFileCallback, highlightSelectedFile, setCurrFileIndex, registerResetViewCallback } from "./filepanelupload.js";
registerLoadFileCallback(loadFile); // Register the loadFile function as a callback
registerResetViewCallback(resetViewState); // Register the resetViewState function as a callback
 
let pdf, page, text;
let num = 1;
let numTimes = -1;
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
    if (numTimes >= 0) {
        stepInText = textDiv.childNodes[numTimes].innerText;
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
    var newPage = page;
    var count = 0;
    var newPageText = text;
    while (jIn < arr.length && ind <= pdf.numPages) {
        for (let i = 0; i < newPageText.items.length; i++) {
            if (newPageText.items[i].str.includes(arr[jIn])) {
                console.log("found: " + newPageText.items[i].str);
                page = newPage;
                text = newPageText;
                numTimes = -1;
                num = ind;
                addText(text);
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
                const viewport = page.getViewport({ scale });
                page.render({ canvasContext: context, viewport });
            }
        }
        ind = ind + 1;
        if (ind <= pdf.numPages) {
            newPage = await pdf.getPage(ind)
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
    pdf = await loadingDoc.promise;
    num = 1;
    numTimes = -1;
    page = await pdf.getPage(num);
    text = await page.getTextContent();
    addText(text);
    /*const firstLine = textDiv.childNodes[0];
    if (firstLine) {
        firstLine.scrollIntoView({behavior: "smooth", block: "center"});
    }
    */
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    page.render({ canvasContext: context, viewport });
    updateNavButtons();
    updateNavandStepButtons();
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
    if (!text || !text.items || text.items.length === 0) {
        return; // No text to navigate through
    }
    //this prints the line
    if (numTimes < textDiv.childNodes.length - 1) {
        console.log(numTimes);
        if (numTimes >= 0) {
            textDiv.childNodes[numTimes].style.backgroundColor = "transparent";
        }
        numTimes++;
        textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
        textDiv.childNodes[numTimes].scrollIntoView({ behavior: "smooth", block: "center" });
    }

});

let prevLineBtn = document.getElementById("prevLine");
prevLineBtn.addEventListener("click", function () {
    if (!text || !text.items || text.items.length === 0) {
        return; // No text to navigate through
    }
    if (numTimes > 0) {
        textDiv.childNodes[numTimes].style.backgroundColor = "transparent";
        numTimes--;
        textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
        textDiv.childNodes[numTimes].scrollIntoView({ behavior: "smooth", block: "center" });
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
    if (num > 1) {
        num -= 1;
        page = await pdf.getPage(num);
        text = await page.getTextContent();
        numTimes = -1;
        addText(text);
        const viewport = page.getViewport({ scale });
        page.render({ canvasContext: context, viewport });
        updateNavButtons();
        updateNavandStepButtons();
    }
}

export function getCurrentPageText() {
    if (!text || !text.items) return "";

    return text.items
        .map(item => item.str?.trim() || "")
        .filter(str => str.length > 0)
        .join("\n");
}


async function getNextPage() {
    // if at last page, do nothing
    if (num >= pdf.numPages) {
        return;
    }

    num += 1;
    page = await pdf.getPage(num);
    text = await page.getTextContent();
    numTimes = -1;
    addText(text);
    const viewport = page.getViewport({ scale });
    page.render({ canvasContext: context, viewport });
    updateNavButtons();
    updateNavandStepButtons();
}

function updateNavButtons() {
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    if (!pdf) {
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }
    prevPageBtn.disabled = num <= 1;
    nextPageBtn.disabled = num >= pdf.numPages;
}

function updateNavandStepButtons() {
    console.log("updateNavandStepButtons CALLED");
    console.log("pdf:", pdf);
    console.log("text:", text);
    console.log("numTimes:", numTimes);
    const nextLineBtn = document.getElementById("NextLine");
    const prevLineBtn = document.getElementById("prevLine");
    const stepInBtn = document.getElementById("stepIn");
    const stepOutBtn = document.getElementById("stepOut");
    const hasPdf = !!pdf;
    const hasText = text && text.items && text.items.length > 0;
     console.log("hasPdf:", hasPdf, "hasText:", hasText);
    nextLineBtn.disabled = !hasText;
    prevLineBtn.disabled = !hasText;
    stepInBtn.disabled = !hasPdf;
    stepOutBtn.disabled = !hasPdf;
    console.log("nextLineBtn.disabled:", nextLineBtn.disabled);
    console.log("prevLineBtn.disabled:", prevLineBtn.disabled);
    console.log("stepInBtn.disabled:", stepInBtn.disabled);
    console.log("stepOutBtn.disabled:", stepOutBtn.disabled);
}

export function resetViewState() {
    pdf = null;
    page = null;
    text = null;
    num = 0;
    numTimes = -1;
    textDiv.innerHTML = "";
    updateNavButtons();
    updateNavandStepButtons();
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