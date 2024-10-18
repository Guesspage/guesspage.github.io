// Tokenizer
function tokenize(formula) {
    const regex = /([\+\-\*\/\(\)\,]|\s+|[A-Za-z_][A-Za-z0-9_]*|[0-9]*\.?[0-9]+)/g;
    return formula.match(regex)
        .filter(token => token.trim() !== '')
        .map(token => token.trim());
}

// Parser
function parse(tokens, definedVariables) {
    let current = 0;

    function parseNumber() {
        return {
            type: 'number',
            value: Number(tokens[current++]),
            repr: function() { return this.value.toString(); },
            calculate: function() { return this.value; }
        };
    }

    function parseIdentifier() {
        const name = tokens[current++];
        if (!definedVariables.has(name)) {
            throw new Error(`Variable "${name}" is used before it's defined`);
        }
        return {
            type: 'variable',
            name: name,
            repr: function() { return this.name; },
            calculate: function(context) {
                if (!(this.name in context)) {
                    throw new Error(`Undefined variable: ${this.name}`);
                }
                return context[this.name];
            }
        };
    }

    function parseParentheses() {
        current++; // Skip opening parenthesis
        const expr = parseExpression();
        if (tokens[current] !== ')') {
            throw new Error(`Expected closing parenthesis, found ${tokens[current] || 'end of input'}`);
        }
        current++; // Skip closing parenthesis
        return expr;
    }

    function parseFunction() {
        const name = tokens[current++];
        if (tokens[current] !== '(') {
            throw new Error(`Expected opening parenthesis after function name ${name}, found ${tokens[current] || 'end of input'}`);
        }
        current++; // Skip opening parenthesis
        const args = [];
        if (tokens[current] !== ')') {
            args.push(parseExpression());
            while (tokens[current] === ',') {
                current++; // Skip comma
                args.push(parseExpression());
            }
        }
        if (tokens[current] !== ')') {
            throw new Error(`Expected closing parenthesis, found ${tokens[current] || 'end of input'}`);
        }
        current++; // Skip closing parenthesis

        switch (name) {
            case 'normal':
                return {
                    type: 'function',
                    name: 'normal',
                    args: args,
                    repr: function() { return `normal(${this.args.map(arg => arg.repr()).join(', ')})`; },
                    calculate: function(context) {
                        if (this.args.length !== 2) {
                            throw new Error('normal function expects 2 arguments');
                        }
                        return normalRandom(this.args[0].calculate(context), this.args[1].calculate(context));
                    }
                };
            case 'min':
                return {
                    type: 'function',
                    name: 'min',
                    args: args,
                    repr: function() { return `min(${this.args.map(arg => arg.repr()).join(', ')})`; },
                    calculate: function(context) {
                        return Math.min(...this.args.map(arg => arg.calculate(context)));
                    }
                };
            case 'max':
                return {
                    type: 'function',
                    name: 'max',
                    args: args,
                    repr: function() { return `max(${this.args.map(arg => arg.repr()).join(', ')})`; },
                    calculate: function(context) {
                        return Math.max(...this.args.map(arg => arg.calculate(context)));
                    }
                };
            default:
                throw new Error(`Unknown function: ${name}`);
        }
    }

    function parseFactor() {
        if (current >= tokens.length) {
            throw new Error('Unexpected end of input');
        }
        if (tokens[current] === '(') {
            return parseParentheses();
        } else if (/^[A-Za-z_]/.test(tokens[current])) {
            return tokens[current + 1] === '(' ? parseFunction() : parseIdentifier();
        } else if (/^[0-9]*\.?[0-9]+$/.test(tokens[current])) {
            return parseNumber();
        } else {
            throw new Error(`Unexpected token: ${tokens[current]}`);
        }
    }

    function parseTerm() {
        let left = parseFactor();
        while (tokens[current] === '*' || tokens[current] === '/') {
            const operator = tokens[current++];
            const right = parseFactor();
            left = {
                type: 'operation',
                operator: operator,
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} ${this.operator} ${this.right.repr()}`; },
                calculate: function(context) {
                    if (this.operator === '*') {
                        return this.left.calculate(context) * this.right.calculate(context);
                    } else {
                        return this.left.calculate(context) / this.right.calculate(context);
                    }
                }
            };
        }
        return left;
    }

    function parseExpression() {
        let left = parseTerm();
        while (tokens[current] === '+' || tokens[current] === '-') {
            const operator = tokens[current++];
            const right = parseTerm();
            left = {
                type: 'operation',
                operator: operator,
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} ${this.operator} ${this.right.repr()}`; },
                calculate: function(context) {
                    if (this.operator === '+') {
                        return this.left.calculate(context) + this.right.calculate(context);
                    } else {
                        return this.left.calculate(context) - this.right.calculate(context);
                    }
                }
            };
        }
        return left;
    }

    const result = parseExpression();
    if (current < tokens.length) {
        throw new Error(`Unexpected token at end: ${tokens[current]}`);
    }
    return result;
}

function escapeHtml(text) {
    const escapeChars = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => escapeChars[char]);
}

function parseMarkdown(markdown) {
    return parseParagraphs(markdown);
}

function parseParagraphs(markdown) {
    return markdown.split(/\n{2,}/).map(parseParagraph).join('\n');
}

function parseParagraph(paragraph) {
    if (paragraph.startsWith('#')) {
        const level = paragraph.match(/^#+/)[0].length;
        const text = paragraph.replace(/^#+\s*/, '');
        return `<h${level}>${parseInline(text)}</h${level}>`;
    }
    return `<p>${parseInline(paragraph)}</p>`;
}

function parseInline(text) {
    let result = '';
    let remaining = text;

    while (remaining.length > 0) {
        const patterns = [
            { type: 'bold', regex: /\*(.*?)\*/ },
            { type: 'italic', regex: /_(.*?)_/ },
            { type: 'code', regex: /`(.*?)`/ },
            { type: 'link', regex: /\[(.*?)\]\((.*?)\)/ },
            { type: 'cell', regex: /\[(\w+)\s*=\s*([^\]]+)\]/ }
        ];

        let earliestMatch = null;
        let earliestIndex = Infinity;

        for (const pattern of patterns) {
            const match = remaining.match(pattern.regex);
            if (match && match.index < earliestIndex) {
                earliestMatch = { type: pattern.type, match };
                earliestIndex = match.index;
            }
        }

        if (earliestMatch) {
            result += escapeHtml(remaining.slice(0, earliestIndex));

            const { type, match } = earliestMatch;
            switch (type) {
                case 'bold':
                    result += `<strong>${parseInline(match[1])}</strong>`;
                    break;
                case 'italic':
                    result += `<em>${parseInline(match[1])}</em>`;
                    break;
                case 'code':
                    result += `<code>${escapeHtml(match[1])}</code>`;
                    break;
                case 'link':
                    result += `<a href="${escapeHtml(match[2])}">${parseInline(match[1])}</a>`;
                    break;
                case 'cell':
                    result += `<span class="cell" id="cell-${match[1]}" data-formula="${escapeHtml(match[2])}">[${match[1]}]</span>`;
                    break;
            }

            remaining = remaining.slice(earliestIndex + match[0].length);
        } else {
            result += escapeHtml(remaining);
            remaining = '';
        }
    }

    return result;
}

function normalRandom(percentile5, percentile95) {
    const mean = (percentile5 + percentile95) / 2;
    const stdDev = (percentile95 - percentile5) / (2 * 1.645); // 1.645 is the z-score for the 95th percentile
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

function parseInput(input) {
    const regex = /\[(\w+)\s*=\s*([^\]]+)\]/g;
    const cells = {};
    const definedVariables = new Set();
    let match;

    while ((match = regex.exec(input)) !== null) {
        const [_, name, formula] = match;
        const tokens = tokenize(formula);
        try {
            cells[name] = parse(tokens, definedVariables);
            definedVariables.add(name.trim());
        } catch (error) {
            console.error(`Error parsing formula for ${name}: ${error.message}`);
        }
    }
    return cells;
}

function generateResults(cells, iterations = 1000) {
    const results = {};
    const context = {};

    for (let i = 0; i < iterations; i++) {
        for (const [name, formula] of Object.entries(cells)) {
            if (!results[name]) results[name] = [];
            context[name] = formula.calculate(context);
            results[name].push(context[name]);
        }
    }
    return results;
}

function updateCellValues(html, results) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('.cell').forEach(cell => {
        const name = cell.id.replace('cell-', '');
        if (results[name]) {
            const values = results[name];
            const sortedValues = values.sort((a, b) => a - b);
            const lowBound = sortedValues[Math.floor(values.length * 0.05)];
            const highBound = sortedValues[Math.floor(values.length * 0.95)];

            cell.innerHTML = `${lowBound.toFixed(2)} .. ${highBound.toFixed(2)}`;
            cell.classList.add('calculated');
        }
    });
    return doc.body.innerHTML;
}

function createDistributionChart(canvasId, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const values = data.sort((a, b) => a - b);
    const buckets = 20;
    const bucketSize = (values[values.length - 1] - values[0]) / buckets;
    const counts = new Array(buckets).fill(0);

    values.forEach(value => {
        const bucketIndex = Math.min(Math.floor((value - values[0]) / bucketSize), buckets - 1);
        counts[bucketIndex]++;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: counts.map((_, i) => (values[0] + i * bucketSize).toFixed(2)),
            datasets: [{
                data: counts,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                }
            }
        }
    });
}

function createFloatingCellContent(name, formula, results) {
    const values = results[name];
    const sortedValues = values.sort((a, b) => a - b);
    const lowBound = sortedValues[Math.floor(values.length * 0.05)];
    const highBound = sortedValues[Math.floor(values.length * 0.95)];
    const mean = values.reduce((a, b) => a + b) / values.length;
    const median = sortedValues[Math.floor(values.length / 2)];

    return `
        <h3>${name}</h3>
        <p>Formula: ${formula.repr()}</p>
        <p>90% range: ${lowBound.toFixed(2)} .. ${highBound.toFixed(2)}</p>
        <p>Mean: ${mean.toFixed(2)}</p>
        <p>Median: ${median.toFixed(2)}</p>
    `;
}

function createArrowsSVG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const viewMode = document.getElementById('view-mode');
    const viewModeRect = viewMode.getBoundingClientRect();

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
        end.x -= 5;
    } else {
        end.x += 5;
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

function createArrowheadMarker(svg) {
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "5");
    marker.setAttribute("markerHeight", "4");
    marker.setAttribute("refX", "0");
    marker.setAttribute("refY", "2");
    marker.setAttribute("orient", "auto");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "0 0, 3 2, 0 4");
    polygon.setAttribute("fill", "rgba(200, 200, 200, 0.3)");
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
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

    const arrowsSVG = createArrowsSVG();
    createArrowheadMarker(arrowsSVG);

    const gap = 10;
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

            createDistributionChart(`chart-${name}`, results[name]);
        }

        if (!floatingCells[name]) {
            const floatingCell = document.createElement('div');
            floatingCell.className = 'floating-cell';
            floatingCell.id = `floating-${name}`;
            floatingCell.innerHTML = createFloatingCellContent(name, cells[name], results);
            rightColumn.appendChild(floatingCell);
            floatingCells[name] = floatingCell;
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
                    nextChartY = chartTop + chartHeight + gap;

                    const boxHeight = floatingCell.offsetHeight;
                    const boxTop = Math.max(cellCenterY - boxHeight / 2, nextBoxY);
                    floatingCell.style.top = `${boxTop}px`;
                    nextBoxY = boxTop + boxHeight + gap;

                    drawArrow(arrowsSVG, cell, chartContainer, true);
                    drawArrow(arrowsSVG, cell, floatingCell, false);
                }
            }
        });
    }

    cellElements.forEach(cell => {
        const name = cell.id.replace('cell-', '');

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

const rawInput = document.getElementById('raw-input');
const viewMode = document.getElementById('view-mode');
const rawEditor = document.getElementById('raw-editor');
const rawModeBtn = document.getElementById('raw-mode-btn');
const viewModeBtn = document.getElementById('view-mode-btn');

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

async function handleSave() {
    const content = rawInput.value;
    saveToLocalStorage();

    try {
        const fileId = await saveFile(content);
        if (fileId) {
            currentFileId = fileId;
            showNotification('File saved successfully to Google Drive');
        } else {
            throw new Error('Failed to save file to Google Drive');
        }
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        showNotification('Error saving to Google Drive. Changes saved locally.', 'error');
    }
}

async function handleLoad(fileId) {
    try {
        const content = await loadFileFromId(fileId);
        rawInput.value = content;
        currentFileId = fileId;
        updateView();
    } catch (error) {
        console.error('Error loading file:', error);
        showNotification('Error loading file from Google Drive', 'error');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function switchToRawMode() {
    rawEditor.classList.remove('hidden');
    viewMode.classList.add('hidden');
    rawModeBtn.disabled = true;
    viewModeBtn.disabled = false;
}

function switchToViewMode() {
    rawEditor.classList.add('hidden');
    viewMode.classList.remove('hidden');
    rawModeBtn.disabled = false;
    viewModeBtn.disabled = true;
    updateView();
}

document.getElementById('save-btn').addEventListener('click', handleSave);

rawInput.addEventListener('input', debounce(() => {
    saveToLocalStorage();
}, 1000));

window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileId');
    if (fileId) {
        handleLoad(fileId);
    } else {
        const savedContent = loadFromLocalStorage();
        if (savedContent) {
            rawInput.value = savedContent;
            updateView();
        }
    }

    // Initialize Google Drive integration
    initializeGoogleDrive().catch(error => {
        console.error("Error initializing Google Drive integration:", error);
    });
});

window.addEventListener('beforeunload', (event) => {
    if (rawInput.value !== loadFromLocalStorage()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

rawModeBtn.addEventListener('click', switchToRawMode);
viewModeBtn.addEventListener('click', switchToViewMode);

switchToRawMode();
