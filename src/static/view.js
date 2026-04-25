//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
     // get the worker code as well
     pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
     /* setting our pdf url
     const url = "/static/StanfordPaper1.pdf"

     // getting the document object
     const doc = pdfjsLib.getDocument(url);
     const pdf = await doc.promise;
     console.log(pdf);

     // getting the page we want.
     var num = 1;
     var page = await pdf.getPage(num);

     // Setting the scale and the "viewport" property
     // Increase scale to make the canvas bigger.
     const scale = 1;
     const viewport = page.getViewport({scale});

     // get our canvas properties.
     const canvas = document.getElementById("pdf");
     const context = canvas.getContext("2d");

     // Get the viewport width and height to canvas.
     canvas.width = Math.floor(viewport.width);
     canvas.height = Math.floor(viewport.height);

     // Pass in the canvas context and viewport
     const renderContext = {
        canvasContext: context,
        viewport,
     }

     // this will actually put the page into the canvas.
     page.render(renderContext);

    var text = await page.getTextContent();
     */
 //This is the end of the setup code.   
let pdf, page, text;
let num = 1;
let numTimes = -1;
const scale = 1;
const canvas = document.getElementById("pdf");
const context = canvas.getContext("2d");


let nextLineBtn =  document.getElementById("NextLine");
let nextPageBtn = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");
let fileOrder = [];
let currFileIndex = 0;
var stepInText;

export function setFileOrder(inputStr) {
    fileOrder = inputStr.split(",").map(str => str.trim());

}

export function setCurrFile(fileName) {
    currFileIndex = fileOrder.indexOf(fileName);
}

document.getElementById("stepIn").addEventListener("click", stepIn);
document.getElementById("stepOut").addEventListener("click", stepOut);
export async function stepIn(){
    var stepInChanged = 0
    if (numTimes >= 0) {
        stepInText = textDiv.childNodes[numTimes].innerText;
        stepInChanged = 1
    }
    if (currFileIndex < fileOrder.length - 1) {
        currFileIndex++;
         await loadFile(fileOrder[currFileIndex]);
         if(stepInChanged == 1) {
          await getRelevantSection(stepInText, fileOrder[currFileIndex]);
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
    alert("Wait for Change, getting relevant text from next file");
     var obj = {line: stepLine, fileName: file}
     const response = await fetch("/stepIn", {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
      },
      body: JSON.stringify(obj),
    });
    var res = await response.json()
    var string = JSON.parse(res)
     alert("Stepped in with: " + stepLine + "Relevant Text from this file: " + file + "\n" + string)
    // get the page.
    // highlight any that start with, what we have and end with
    var fileName = fileOrder[currFileIndex];
    var ind = 1;
    var newPage = page;
    var textFound = false;
    var newPageText = text;
    while(!textFound && ind <= pdf.numPages) {
        for(let i  =0; i < newPageText.items.length; i++) {
             if(newPageText.items[i].str.includes(string)) {
                page = newPage;
                text = newPageText;
                numTimes = -1;
                addText(text);
                for(let i = 0; i < textDiv.childNodes.length; i++) {
                    if(textDiv.childNodes[i].innerText.includes(string)) {
                         textDiv.childNodes[i].style.backgroundColor = "lightgrey"
                    }
                }
                const viewport = page.getViewport({scale});
                page.render({ canvasContext: context, viewport});
             }
        }
        ind = ind + 1;
        if( ind <= pdf.numPages) {
            newPage = await pdf.getPage(ind)
            newPageText = await newPage.getTextContent();
        }
    }
 
}
export async function stepOut() {
    if (currFileIndex > 0) {
        currFileIndex--;
        await loadFile(fileOrder[currFileIndex]);
    }
}

async function loadFile(fileName) {
    const url = `/static/${fileName}`;

    // loading document
    const loadingDoc = pdfjsLib.getDocument(url);
    pdf = await loadingDoc.promise;
    num = 1;
    numTimes = -1;
    page = await pdf.getPage(num);
    text = await page.getTextContent();
    addText(text);
    const firstLine = textDiv.childNodes[0];
    if (firstLine) {
        firstLine.scrollIntoView({behavior: "smooth", block: "center"});
    }
    const viewport = page.getViewport({scale});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    page.render({ canvasContext: context, viewport});

}



nextLineBtn.addEventListener("click", function() {
    if (!text || !text.items || text.items.length === 0) {
        return; // No text to navigate through
    }
    //this prints the line
    if(numTimes < textDiv.childNodes.length - 1){
       console.log(numTimes);
       if(numTimes >= 0) {
          textDiv.childNodes[numTimes].style.backgroundColor = "transparent";
       }
       numTimes++;
    textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
    textDiv.childNodes[numTimes].scrollIntoView({behavior: "smooth", block: "center"});
    }

});

let prevLineBtn = document.getElementById("prevLine");
prevLineBtn.addEventListener("click", function() {
    if (!text || !text.items || text.items.length === 0) {
        return; // No text to navigate through
    }
    if(numTimes > 0){
        textDiv.childNodes[numTimes].style.backgroundColor = "transparent";
        numTimes--;
        textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
        textDiv.childNodes[numTimes].scrollIntoView({behavior: "smooth", block: "center"});
    }
});

let prevPageBtn = document.getElementById("prevPage");
prevPageBtn.addEventListener("click", function() {
    getPrevPage();
});

nextPageBtn.addEventListener("click", function() {
    getNextPage();
});

async function getPrevPage() {
    if (num > 1) {
        num -= 1;
        page = await pdf.getPage(num);
        text = await page.getTextContent();
        numTimes = -1;
        addText(text);
        const viewport = page.getViewport({scale});
        page.render({ canvasContext: context, viewport});
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
    const viewport = page.getViewport({scale});
    page.render({ canvasContext: context, viewport});
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
    for(let item of text.items) {
        const str = item.str.trim();
        // skips empty lines 
        if (str.length == 0){
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

toggleBtn.addEventListener("click", function() {
    if (pdfContainer.style.display === "none") {
        pdfContainer.style.display = "block";
        viewer.classList.remove("single-column");
    } else {
        pdfContainer.style.display = "none";
        viewer.classList.add("single-column");
    }
});

setFileOrder("StanfordPaper1.pdf, ConstitutionWords.pdf, constitution.pdf, holmes.pdf");
setCurrFile("StanfordPaper1.pdf");
await loadFile("StanfordPaper1.pdf");
// frin
