import { initializeGoogleDrive, handleAuthClick, handleSave, handleLoad } from './google-drive.js';
import { parseInput, generateResults } from './calculator.js';
import { parseMarkdown, updateCellValues, createDistributionChart, createFloatingCellContent } from './ui.js';
import { debounce, showNotification, generatePastelColor } from './utils.js';

const rawInput = document.getElementById('raw-input');
const viewMode = document.getElementById('view-mode');
const rawEditor = document.getElementById('raw-editor');
const rawModeBtn = document.getElementById('raw-mode-btn');
const viewModeBtn = document.getElementById('view-mode-btn');
const saveBtn = document.getElementById('save-btn');
const signinBtn = document.getElementById('signin-btn');
const themeToggle = document.getElementById('theme-toggle');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = document.getElementById('close-help-modal');

let currentFileId = null;

function saveToLocalStorage() {
    localStorage.setItem('guessbook_content', rawInput.value);
}

function loadFromLocalStorage() {
    return localStorage.getItem('guessbook_content');
}

function updateURLWithFileId(fileId) {
    const url = new URL(window.location);
    url.searchParams.set('fileId', fileId);
    window.history.pushState({}, '', url);
}

function switchToRawMode() {
    rawEditor.classList.remove('hidden');
    viewMode.classList.add('hidden');
    rawModeBtn.setAttribute('aria-pressed', 'true');
    viewModeBtn.setAttribute('aria-pressed', 'false');
    clearArrows();
}

function switchToViewMode() {
    rawEditor.classList.add('hidden');
    viewMode.classList.remove('hidden');
    rawModeBtn.setAttribute('aria-pressed', 'false');
    viewModeBtn.setAttribute('aria-pressed', 'true');
    updateView();
}

function updateView() {
    const input = rawInput.value;
    const cells = parseInput(input);
    const results = generateResults(cells);

    let html = parseMarkdown(input);
    html = updateCellValues(html, results);

    const centerColumn = document.getElementById('center-column');
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');

    centerColumn.innerHTML = html;
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';

    clearArrows();
    const arrowsSVG = createArrowsSVG();
    createArrowheadMarker(arrowsSVG);

    const cellElements = Object.keys(results).map(name => document.getElementById(`cell-${name}`));
    const clickActiveCells = {};
    const hoverActiveCells = {};
    const chartContainers = {};
    const floatingCells = {};

    function createElementsForCell(name) {
        if (!chartContainers[name]) {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-container';
            chartContainer.innerHTML = `<canvas id="chart-${name}"></canvas>`;
            leftColumn.appendChild(chartContainer);
            chartContainers[name] = chartContainer;

            const cellColor = generatePastelColor(name);
            createDistributionChart(`chart-${name}`, results[name], cellColor);
        }

        if (!floatingCells[name]) {
            const floatingCell = document.createElement('div');
            floatingCell.className = 'floating-cell';
            floatingCell.id = `floating-${name}`;
            floatingCell.innerHTML = createFloatingCellContent(name, cells[name], results);
            rightColumn.appendChild(floatingCell);
            floatingCells[name] = floatingCell;

            const cellColor = generatePastelColor(name);
            floatingCell.style.borderLeft = `4px solid ${cellColor}`;
        }
    }

    function removeElementsForCell(name) {
        if (chartContainers[name]) {
            chartContainers[name].remove();
            delete chartContainers[name];
        }
        if (floatingCells[name]) {
            floatingCells[name].remove();
            delete floatingCells[name];
        }
    }

    function toggleCellClickActive(name) {
        clickActiveCells[name] = !clickActiveCells[name];
        hoverActiveCells[name] = false;
        updateCellVisibility(name);
        positionAllElements();
    }

    function setCellHoverActive(name, active) {
        hoverActiveCells[name] = active;
        updateCellVisibility(name);
        positionAllElements();
    }

    function updateCellVisibility(name) {
        if (clickActiveCells[name] || hoverActiveCells[name]) {
            createElementsForCell(name);
        } else {
            removeElementsForCell(name);
        }
    }

    function positionAllElements() {
        let nextChartY = 0;
        let nextBoxY = 0;
        arrowsSVG.innerHTML = '';
        createArrowheadMarker(arrowsSVG);

        const viewAreaRect = document.getElementById('view-mode').getBoundingClientRect();

        cellElements.forEach(cell => {
            const name = cell.id.replace('cell-', '');
            if (clickActiveCells[name] || hoverActiveCells[name]) {
                const cellRect = cell.getBoundingClientRect();
                const cellTop = cellRect.top - viewAreaRect.top;
                const cellCenterY = cellTop + cellRect.height / 2;

                const chartContainer = chartContainers[name];
                const floatingCell = floatingCells[name];

                if (chartContainer && floatingCell) {
                    const chartHeight = 150;
                    const chartTop = Math.max(cellCenterY - chartHeight / 2, nextChartY);
                    chartContainer.style.top = `${chartTop}px`;
                    chartContainer.style.height = `${chartHeight}px`;
                    nextChartY = chartTop + chartHeight + 10;

                    const boxHeight = floatingCell.offsetHeight;
                    const boxTop = Math.max(cellCenterY - boxHeight / 2, nextBoxY);
                    floatingCell.style.top = `${boxTop}px`;
                    nextBoxY = boxTop + boxHeight + 10;

                    drawArrow(arrowsSVG, cell, chartContainer, true);
                    drawArrow(arrowsSVG, cell, floatingCell, false);
                }
            }
        });
    }

    cellElements.forEach(cell => {
        const name = cell.id.replace('cell-', '');
        const cellColor = generatePastelColor(name);
        cell.style.backgroundColor = cellColor;

        cell.addEventListener('click', () => {
            toggleCellClickActive(name);
        });

        cell.addEventListener('mouseenter', () => {
            setCellHoverActive(name, true);
        });

        cell.addEventListener('mouseleave', () => {
            setCellHoverActive(name, false);
        });
    });
}

function createArrowsSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const viewMode = document.getElementById('view-mode');
    svg.id = 'arrows-svg';
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = "0";
    viewMode.appendChild(svg);
    return svg;
}

function drawArrow(svg, startEl, endEl, isLeftSide) {
    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();
    const viewAreaRect = document.getElementById('view-mode').getBoundingClientRect();

    const start = {
        x: startRect.left + startRect.width / 2,
        y: startRect.top - viewAreaRect.top + startRect.height / 2
    };

    let end = {
        x: isLeftSide ? endRect.right : endRect.left,
        y: endRect.top - viewAreaRect.top + endRect.height / 2
    };

    if (isLeftSide) {
        end.x += 40;
    } else {
        end.x -= 40;
    }

    const midX = (start.x + end.x) / 2;

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const path = `M ${start.x},${start.y}
                  C ${midX},${start.y} ${midX},${end.y} ${end.x},${end.y}`;
    arrow.setAttribute("d", path);
    arrow.setAttribute("fill", "none");
    arrow.setAttribute("stroke", "rgba(200, 200, 200, 0.3)");
    arrow.setAttribute("stroke-width", "10");
    arrow.setAttribute("marker-end", "url(#arrowhead)");
    svg.appendChild(arrow);
}

function clearArrows() {
    const existingSvg = document.querySelector('#view-mode svg');
    if (existingSvg) {
        existingSvg.remove();
    }
}

function createArrowheadMarker(svg) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "4");
    marker.setAttribute("markerHeight", "4");
    marker.setAttribute("refX", "0");
    marker.setAttribute("refY", "2");
    marker.setAttribute("orient", "auto");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 4 2, 0 4");
    polygon.setAttribute("fill", "rgba(200, 200, 200, 0.3)");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
}

rawInput.addEventListener('input', debounce(() => {
    saveToLocalStorage();
}, 1000));

window.addEventListener('load', async () => {
    const isLocalFile = window.location.protocol === 'file:';

    if (!isLocalFile) {
        try {
            await initializeGoogleDrive();
        } catch (error) {
            console.error("Error during initialization:", error);
            showNotification('Error: ' + error.message, 'error');
        }
    } else {
        console.log("Running locally, Google Drive integration disabled.");
        document.getElementById('signin-btn').style.display = 'none';
        document.getElementById('save-btn').style.display = 'none';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileId');
    if (fileId && !isLocalFile) {
        handleLoad(fileId);
    } else {
        const savedContent = loadFromLocalStorage();
        if (savedContent) {
            rawInput.value = savedContent;
            updateView();
        }
    }
});

window.addEventListener('beforeunload', (event) => {
    if (rawInput.value !== loadFromLocalStorage()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

rawModeBtn.addEventListener('click', switchToRawMode);
viewModeBtn.addEventListener('click', switchToViewMode);
saveBtn.addEventListener('click', handleSave);
signinBtn.addEventListener('click', handleAuthClick);

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
});

function showModal() {
    helpModal.style.display = 'block';
    helpModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    helpModal.style.display = 'none';
    helpModal.setAttribute('aria-hidden', 'true');
}

helpBtn.addEventListener('click', showModal);
closeHelpModal.addEventListener('click', closeModal);

window.addEventListener('click', (event) => {
    if (event.target === helpModal) {
        closeModal();
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
    }
});

const savedTheme = localStorage.getItem('darkMode');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
if (savedTheme === 'true' || (savedTheme === null && prefersDarkScheme.matches)) {
    document.body.classList.add('dark-mode');
}

switchToRawMode();
