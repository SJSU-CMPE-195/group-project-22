//Most of the setup code is from the setup code from helloWorld.html from the pdf.js library
// Import the pdjsLib module from the library (this is the only import that is working).
import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';
     // get the worker code as well
     pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';
     // setting our pdf url
     const url = window.pdf_URL;

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

let button =  document.getElementById("NextLine");
let pageButton = document.getElementById("nextPage");
var textDiv = document.getElementById("textDiv");

addText(text);
var numTimes = -1;
button.addEventListener("click", function() {
    //this prints the line
    if(numTimes < text.items.length){
       numTimes += 1;
       console.log(numTimes);
       if(numTimes > 0) {
          textDiv.childNodes[numTimes-1].style.backgroundColor = "transparent";
       }
       textDiv.childNodes[numTimes].style.backgroundColor = "yellow";
    }
});

pageButton.addEventListener("click", function() {
    getNextPage();
});


async function getNextPage() {
   num = num +1;
   page = await pdf.getPage(num);
   text = await page.getTextContent();
   numTimes = -1;
   addText(text)
   page.render(renderContext);
}

function addText(text) {
    // delete any existing child nodes.
    while(textDiv.hasChildNodes() && num > 1) {
        textDiv.removeChild(textDiv.lastChild);
    }
    for(let i = 0; i < text.items.length; i++) {
        // this creates the new <p> element.
         const newPtag = document.createElement("p");
         // now add text to the p tage.
         const tt = document.createTextNode(text.items[i].str);
         newPtag.appendChild(tt);
    
        // Now add to div
        textDiv.appendChild(newPtag);
    }
}



// frin
