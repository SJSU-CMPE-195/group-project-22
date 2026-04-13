//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
     // get the worker code as well
     pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
     // setting our pdf url
     const url = "../static/StanfordPaper1.pdf"

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
     
 //This is the end of the setup code.   

let nextLineBtn =  document.getElementById("NextLine");
let nextPageBtn = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");
var stepInBtn = document.getElementById("StepIn")
var currentText = null;
addText(text);
var numTimes = -1;
nextLineBtn.addEventListener("click", function() {
    //this prints the line
    if(numTimes < text.items.length){
       numTimes++;
       console.log(numTimes);
       if(numTimes > 0) {
          textDiv.childNodes[numTimes-1].style.backgroundColor = "transparent";
       }
       textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
       currentText = textDiv.childNodes[numTimes].innerText;
    }
    lines[numTimes].scrollIntoView({behavior: "smooth", block: "center"});
});

let prevLineBtn = document.getElementById("prevLine");
prevLineBtn.addEventListener("click", function() {
    if(numTimes >= 0){
        textDiv.childNodes[numTimes].style.backgroundColor = "transparent";
        numTimes -= 1;
        textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
    }
        lines[numTimes].scrollIntoView({behavior: "smooth", block: "center"});
});

stepInBtn.addEventListener("click", function() {
    // add a branch to check if they have documents left to step into before requesting a webpage.
    getWebPage();
});
let prevPageBtn = document.getElementById("prevPage");
prevPageBtn.addEventListener("click", function() {
    getPrevPage();
});

nextPageBtn.addEventListener("click", function() {
    getNextPage();
});

async function getPrevPage() {
    if(num > 1) {
        num -= 1;
        page = await pdf.getPage(num);
        text = await page.getTextContent();
        numTimes = -1;
        addText(text);
        page.render(renderContext);
    }
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
   addText(text)
   page.render(renderContext);
}
async function getWebPage() {
    // add a branch to check if there are no stepins.
    const response = await fetch("/getWebpage", {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
      },
      body: JSON.stringify(currentText),

    });
    var result = await response.json();
    var resultObj = JSON.parse(result);
    alert(resultObj.link)
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

toggleBtn.addEventListener("click", function() {
    if (pdfContainer.style.display === "none") {
        pdfContainer.style.display = "block";
    } else {
        pdfContainer.style.display = "none";
    }
});
// frin
