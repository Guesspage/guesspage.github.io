import { initializeGoogleDrive, handleAuthClick, handleSave, handleLoad } from './google-drive.js';
import { parseInput, generateResults } from './calculator.js';
import { parseMarkdown, updateCellValues, createDistributionChart, createFloatingCellContent, createSensitivityChart, createModalChart } from './ui.js';
import { debounce, showNotification, generatePastelColor } from './utils.js';

const rawInput = document.getElementById('raw-input');
const viewMode = document.getElementById('view-mode');
const rawEditor = document.getElementById('raw-editor');
const editModeBtn = document.getElementById('edit-mode-btn');
const viewModeBtn = document.getElementById('view-mode-btn');
const saveBtn = document.getElementById('save-btn');
const signinBtn = document.getElementById('signin-btn');
const themeToggle = document.getElementById('theme-toggle');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = document.getElementById('close-help-modal');

let currentFileId = null;
let targetCell = null;
let popupTimeout;
let activePopup;

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

function switchToEditMode() {
    rawEditor.classList.remove('hidden');
    viewMode.classList.add('hidden');
    editModeBtn.setAttribute('aria-pressed', 'true');
    viewModeBtn.setAttribute('aria-pressed', 'false');
    clearArrows();
}

function switchToViewMode() {
    rawEditor.classList.add('hidden');
    viewMode.classList.remove('hidden');
    editModeBtn.setAttribute('aria-pressed', 'false');
    viewModeBtn.setAttribute('aria-pressed', 'true');
    updateView();
}

function updateView() {
    const input = rawInput.value;
    const cells = parseInput(input);
    const { results, sensitivities } = generateResults(cells, 10000, targetCell);

    let html = parseMarkdown(input);
    html = updateCellValues(html, results, sensitivities, targetCell);

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
            if (targetCell && name !== targetCell) {
                createSensitivityChart(`chart-${name}`, results[targetCell], results[name], sensitivities?.[name], name, targetCell);
            } else {
                createDistributionChart(`chart-${name}`, results[name], cellColor, name);
            }
        }

        if (!floatingCells[name]) {
            const floatingCell = document.createElement('div');
            floatingCell.className = 'floating-cell';
            floatingCell.id = `floating-${name}`;
            floatingCell.innerHTML = createFloatingCellContent(name, cells[name], results, sensitivities?.[name]);

            const setTargetBtn = document.createElement('button');
            setTargetBtn.className = 'set-target-btn';
            setTargetBtn.textContent = targetCell === name ? 'Unset Target' : 'Set as Target';
            setTargetBtn.addEventListener('click', () => {
                targetCell = targetCell === name ? null : name;
                updateView();
            });
            floatingCell.appendChild(setTargetBtn);

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

        const viewMode = document.getElementById('view-mode');
        const viewModeRect = viewMode.getBoundingClientRect();

        cellElements.forEach(cell => {
            const name = cell.id.replace('cell-', '');

            if (clickActiveCells[name] || hoverActiveCells[name]) {
                const cellRect = cell.getBoundingClientRect();
                const cellTop = cellRect.top - viewModeRect.top + viewMode.scrollTop;
                const cellCenterY = cellTop + cellRect.height / 2;

                const chartContainer = chartContainers[name];
                const floatingCell = floatingCells[name];

                if (chartContainer && floatingCell) {
                    const chartHeight = 200;
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
                } else {
                    console.log(`Missing chartContainer or floatingCell for ${name}`);
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
            clearTimeout(popupTimeout);
            popupTimeout = setTimeout(() => {
                showPopupMenu(cell, name);
            }, 500); // Show popup after 500ms
        });

        cell.addEventListener('mouseleave', () => {
            setCellHoverActive(name, false);
            clearTimeout(popupTimeout);
            // Hide popup after a short delay to allow moving to the popup
            setTimeout(() => {
                if (activePopup && !activePopup.matches(':hover')) {
                    activePopup.style.display = 'none';
                }
            }, 100);
        });
    });

    function showPopupMenu(cell, name) {
        if (activePopup) {
            activePopup.style.display = 'none';
        }

        const popup = document.createElement('div');
        popup.className = 'cell-popup';
        popup.innerHTML = `
            <button class="expand-btn">Expand</button>
            <button class="sensitivity-btn">${targetCell === name ? 'Unset Target' : 'Set as Target'}</button>
        `;

        document.body.appendChild(popup);

        const expandBtn = popup.querySelector('.expand-btn');
        const sensitivityBtn = popup.querySelector('.sensitivity-btn');

        expandBtn.addEventListener('click', () => {
            showModalChart(name, results[name], generatePastelColor(name), sensitivities?.[name]);
            popup.style.display = 'none';
        });

        sensitivityBtn.addEventListener('click', () => {
            targetCell = targetCell === name ? null : name;
            updateView();
            popup.style.display = 'none';
        });

        const cellRect = cell.getBoundingClientRect();
        popup.style.left = `${(cellRect.right + cellRect.left) / 2}px`;
        popup.style.top = `${cellRect.bottom}px`;
        popup.style.display = 'block';

        activePopup = popup;

        popup.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!cell.matches(':hover')) {
                    popup.style.display = 'none';
                }
            }, 100);
        });
    }
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
    const viewAreaRect = document.getElementById('center-column').getBoundingClientRect();

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

function showModalChart(name, data, color, sensitivity) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${name}</h2>
            <canvas id="modal-chart-${name}"></canvas>
            <div class="sensitivity-info"></div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close');
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    });

    createModalChart(`modal-chart-${name}`, data, color, sensitivity);

    if (sensitivity) {
        const sensitivityInfo = modal.querySelector('.sensitivity-info');
        sensitivityInfo.innerHTML = `
            <p>r² = ${sensitivity.rSquared.toFixed(4)}</p>
            <p>Slope = ${sensitivity.slope.toFixed(4)}</p>
            <p>Intercept = ${sensitivity.intercept.toFixed(4)}</p>
            <p>Beta = ${sensitivity.beta.toFixed(4)}</p>
        `;
    }

    modal.style.display = 'block';
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

editModeBtn.addEventListener('click', switchToEditMode);
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

switchToEditMode();
