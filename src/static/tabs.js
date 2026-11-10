import { currFileIndex, loadFileByIndex, setCurrFileIndex, fileInput } from "./filepanelupload.js";
import { fileStates } from "./viewState.js";
import { saveSession } from "./viewState.js";

export let tabs = [];
export let activeTabId = null;

export function createTab(name) {

    const tab = {
        id: crypto.randomUUID(),
        name,
        fileId: fileInput[currFileIndex]?.id || null,
        page: fileStates[currFileIndex]?.page ?? 1,
        line: fileStates[currFileIndex]?.line ?? -1,
        scroll: fileStates[currFileIndex]?.scroll ?? 0
    };

    tabs.push(tab);
    activeTabId = tab.id;
    saveCurrentTabState();
    return tab;
}

export function restoreTabs(restoredTabs, restoredActiveTabId) {

    tabs.length = 0;

    if (restoredTabs) {
        tabs.push(...restoredTabs);
    }

    setActiveTabId(restoredActiveTabId);
}

export function setActiveTabId(id) {
    activeTabId = id;
}

export async function switchTab(tabId) {

    saveCurrentTabState();
    const tab =
        tabs.find(
            t => t.id === tabId
        );
    if (!tab) {
        return;
    }
    activeTabId = tabId;
    const fileIndex =
        fileInput.findIndex(
            f => f.id === tab.fileId
        );
    if (fileIndex >= 0) {
        fileStates[fileIndex].page = tab.page;
        fileStates[fileIndex].line = tab.line;
        fileStates[fileIndex].scroll = tab.scroll;
        setCurrFileIndex(fileIndex);
        await loadFileByIndex(fileIndex);
    }
    return tab;
}

export function updateActiveTabState(data) {

    const tab =
        tabs.find(
            t => t.id === activeTabId
        );

    if (!tab) {
        return;
    }

    Object.assign(
        tab,
        data
    );
}

export function renderTabs(container) {

    container.innerHTML = "";

    tabs.forEach(tab => {

        const tabDiv =
            document.createElement("div");

        const tabBtn =
            document.createElement("button");

        const closeBtn =
            document.createElement("button");

        tabBtn.textContent =
            tab.name;

        closeBtn.textContent =
            "✕";

        if (tab.id === activeTabId) {
            tabBtn.classList.add(
                "active-tab"
            );
        }

        tabBtn.addEventListener(
            "click",
            async () => {

                await switchTab(tab.id);

                renderTabs(container);

            }
        );

        closeBtn.addEventListener(
            "click",
            e => {

                e.stopPropagation();

                removeTab(tab.id);

                renderTabs(container);

            }
        );

        tabDiv.appendChild(tabBtn);
        tabDiv.appendChild(closeBtn);

        container.appendChild(tabDiv);

    });
}

export function saveCurrentTabState() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) { return; }
    tab.fileId = fileInput[currFileIndex]?.id ?? null;
    tab.page = fileStates[currFileIndex]?.page ?? 1;
    tab.line = fileStates[currFileIndex]?.line ?? -1;
    tab.scroll = fileStates[currFileIndex]?.scroll ?? 0;
}

export function removeTab(tabId) {
    if (tabs.length <= 1) {
        return;
    }

    const index =
        tabs.findIndex(
            t => t.id === tabId
        );

    if (index < 0) {
        return;
    }

    tabs.splice(index, 1);

    const nextTabId =
        tabs[0]?.id;

    activeTabId = nextTabId;

    if (nextTabId) {
        switchTab(nextTabId);
    }
    saveSession();
}

window.createTab = createTab;
window.tabs = tabs;