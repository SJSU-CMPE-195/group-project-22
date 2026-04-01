let fileOrder = [];
let currFileIndex = 0;

export function setFileOrder(files){
    fileOrder = [...files];
    currFileIndex = 0;
}

export function loadFileByIndex(index){
    if (index < 0 || index >= fileOrder.length) return;
    currFileIndex = index;
    const file = fileOrder[index];
    const fileURL = URL.createObjectURL(file);
    loadPDF(fileURL);
}

export function stepInNextFile(){
    if (currFileIndex < fileOrder.length - 1) {
        loadFileByIndex(currFileIndex + 1);
    }
}

export function stepInPrevFile(){
    if (currFileIndex > 0) {
        loadFileByIndex(currFileIndex - 1);
    }
}

