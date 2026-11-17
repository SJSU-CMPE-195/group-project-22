import { saveSession } from "./viewState.js";

export let folders = [];
export const expandedFolders = new Set();

//Extracts courses from canvas schedule text, creates folder for each course, somewhat restricted to courses in the format of "FA25: DEPT-123" or "DEPT-123A" (e.g., "CS-101", "MATH-202B")
export function extractCourses(text) {

    // regex use throughout may be too or not restrictive enough, should work for most cases, but may need to be adjusted if it fails to extract courses correctly
    const matches =
        text.match(
            /[A-Z]{2,4}\d{0,2}:\s*[A-Z]{2,5}-\d+[A-Z]?/gi
        ) || [];

    const courses = matches.map(match => {

        const courseMatch =
            match.match(
                /([A-Z]{2,5})-(\d+[A-Z]?)/i
            );

        if (!courseMatch) {
            return null;
        }

        return `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`;
    });

    return [
        ...new Set(
            courses.filter(Boolean)
        )
    ];
}

// Extracts courses from study files based on names currently, less restictive than the schedule text extraction, but still looks for patterns like "DEPT-123" or "DEPT-123A"
export function extractCoursesFromFileName(fileName) {
    const courseMatch =
        fileName.match(
            /(?:^|[\s_-])([A-Z]{2,5})[\s_-]?(\d+[A-Z]?)/i
        );

    if (!courseMatch) {
        return null;
    }

    return `${courseMatch[1].toUpperCase()} ${courseMatch[2].toUpperCase()}`;
}

export function ensureFolderExists(course) {
    if (!course) { return;}
    if (
        folders.some(
            f => f.name === course
        )
    ) {
        return;
    }

    folders.splice(
        Math.max(
            folders.length - 1,
            0
        ),
        0,
        {
            name: course,
            files: []
        }
    );
}

export function createFolders(courseList) {
    const existing =
        new Set(
            folders.map(f => f.name)
        );

    courseList.forEach(course => {

        if (!existing.has(course)) {
            folders.push({
                name: course,
                files: []
            });
        }
    });

    if (!folders.find(
        f => f.name === "Unsorted"
    )) {
        folders.push({
            name: "Unsorted",
            files: []
        });
    }
}

export async function extractTextFromPDF(pdfFile) {
    const arrayBuffer =
        await pdfFile.arrayBuffer();

    const pdf =
        await pdfjsLib.getDocument({
            data: arrayBuffer
        }).promise;

    let text = "";

    for (
        let pageNum = 1;
        pageNum <= pdf.numPages;
        pageNum++
    ) {
        const page =
            await pdf.getPage(pageNum);

        const content =
            await page.getTextContent();

        text += content.items
            .map(item => item.str)
            .join(" ");

        text += "\n";
    }
    return text;
}

export async function genFoldersFromPDF(pdfFile) {
    const text = await extractTextFromPDF(pdfFile);
    return genFoldersFromText(text);
}


export function genFoldersFromText(scheduleText) {
    const courses = extractCourses(scheduleText);
    console.log("Extracted:", courses);
    console.log("Before:", folders.map(f => f.name));
    createFolders(courses);
    console.log("After:", folders.map(f => f.name));
    return folders;
}

function normalizeCourse(str) {
    return str.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function assignFileToFolder(file) {
    const detectedCourse = extractCoursesFromFileName(file.name);
    ensureFolderExists(detectedCourse);
    const normalizedFile = normalizeCourse(file.name);

    const folder = folders.find(folder =>
        folder.name !== "Unsorted" &&
        normalizedFile.includes(normalizeCourse(folder.name))
    );

    if (folder) {
        folder.files.push(file);
        return folder.name;
    }

    const unsorted = folders.find(
        folder => folder.name === "Unsorted"
    );

    if (unsorted) {
        unsorted.files.push(file);
    }

    return "Unsorted";
}

export function assignAllFiles(fileList) {
    clearFolderAssignments();
    fileList.forEach(file => {
        assignFileToFolder(file);
    });
}

export function buildCourseWorkspace(scheduleText, fileList) {
    genFoldersFromText(scheduleText);
    assignAllFiles(fileList);
    return folders;
}

export function renderFolders(container, onFileClick, onDeleteFile, onMoveUp, onMoveDown) {
    container.innerHTML = "";

    folders.forEach(folder => {
        const folderDiv = document.createElement("div");
        folderDiv.className = "course-folder";
        const header = document.createElement("div");
        header.className = "folder-name";
        const title = document.createElement("span");
        title.textContent = `📁 ${folder.name}`;
        const fileList = document.createElement("div");
        fileList.className = "folder-files";
        const isExpanded = expandedFolders.has(folder.name);
        fileList.style.display = isExpanded ? "block" : "none";
        title.textContent =
            `${isExpanded ? "📂" : "📁"} ${folder.name}`;
        const removeBtn =document.createElement("button");
        removeBtn.textContent = "✖";
        removeBtn.className = "remove-folder-btn";
        removeBtn.addEventListener("click", e => {

            e.stopPropagation();
            expandedFolders.delete(folder.name);
            removeFolder(folder.name);
            saveSession();
            renderFolders(
                container,
                onFileClick,
                onDeleteFile,
                onMoveUp,
                onMoveDown
            );
        });
        header.appendChild(title);
        if (folder.name !== "Unsorted") {
            header.appendChild(removeBtn);
        }

        header.addEventListener("click", () => {

            const expanded =
                fileList.style.display === "block";

            if (expanded) {
                expandedFolders.delete(folder.name);
            } else {
                expandedFolders.add(folder.name);
            }

            fileList.style.display =
                expanded ? "none" : "block";

            title.textContent =
                `${expanded ? "📁" : "📂"} ${folder.name}`;
        });

        folder.files.forEach(file => {
            const fileDiv = document.createElement("div");
            fileDiv.className = "file-item";
            fileDiv.dataset.id = file.id;
            fileDiv.innerHTML = `
                <span class="file-name">
                    ${file.name}
                </span>

                <button class="folder-up-btn">
                    ▲
                </button>

                <button class="folder-down-btn">
                    ▼
                </button>

                <button class="folder-remove-btn">
                    ✖
                </button>
            `;
            console.log(
                fileDiv.querySelector(".folder-up-btn")
            );
            fileDiv.querySelector(
                ".folder-remove-btn"
            ).addEventListener("click", e => {

                e.stopPropagation();

                if (onDeleteFile) {
                    onDeleteFile(file);
                }
            });
            fileDiv.querySelector(
                ".folder-up-btn"
            ).addEventListener("click", e => {

                e.stopPropagation();
                console.log("UP CLICK", file.id, file.name);
                if (onMoveUp) {
                    onMoveUp(file);
                }
            });
            fileDiv.querySelector(
                ".folder-down-btn"
            ).addEventListener("click", e => {

                e.stopPropagation();

                if (onMoveDown) {
                    onMoveDown(file);
                }
            });
            fileDiv.addEventListener("click", () => {
                if (onFileClick) {
                    onFileClick(file);
                }
            });
            fileList.appendChild(fileDiv);
        });

        folderDiv.appendChild(header);
        folderDiv.appendChild(fileList);

        container.appendChild(folderDiv);
    });
}

export function getFolderData() {
    return folders.map(folder => ({
        name: folder.name
    }));
}

export function restoreFolders(folderData) {
    folders.length = 0;

    folderData.forEach(folder => {
        folders.push({
            name: folder.name,
            files: []
        });
    });
}

export function clearFolderAssignments() {
    folders.forEach(folder => {
        folder.files = [];
    });
}

export function clearFolders() {
    folders.length = 0;
    expandedFolders.clear();
}

export function removeFolder(folderName) {

    const index =
        folders.findIndex(
            f =>
                f.name ===
                folderName
        );

    if (index >= 0 && folderName !== "Unsorted") {
        folders.splice(
            index,
            1
        );

    }
}

export function replaceFolders(courseList) {
    folders.length = 0;
    createFolders(courseList);
}
