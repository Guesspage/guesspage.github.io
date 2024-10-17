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

function normalRandom(min, max) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    num = num / 10.0 + 0.5;
    if (num > 1 || num < 0) return normalRandom(min, max);
    return min + (max - min) * num;
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

function createFloatingCell(name, formula, results) {
    const values = results[name];
    const sortedValues = values.sort((a, b) => a - b);
    const lowBound = sortedValues[Math.floor(values.length * 0.05)];
    const highBound = sortedValues[Math.floor(values.length * 0.95)];
    const mean = values.reduce((a, b) => a + b) / values.length;
    const median = sortedValues[Math.floor(values.length / 2)];

    return `
        <div class="floating-cell" id="floating-${name}">
            <h3>${name}</h3>
            <p>Formula: ${formula.repr()}</p>
            <p>90% range: ${lowBound.toFixed(2)} .. ${highBound.toFixed(2)}</p>
            <p>Mean: ${mean.toFixed(2)}</p>
            <p>Median: ${median.toFixed(2)}</p>
        </div>
    `;
}

function calculateNonOverlappingPositions(elements) {
    const positions = new Map();
    const sorted = [...elements].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    sorted.forEach(element => {
        let top = element.getBoundingClientRect().top - element.offsetParent.getBoundingClientRect().top;
        const height = element.offsetHeight;

        for (const [otherElement, otherPos] of positions) {
            if (top < otherPos.bottom && top + height > otherPos.top) {
                top = otherPos.bottom + 10; // Add some padding
            }
        }

        positions.set(element, { top, bottom: top + height });
    });

    return positions;
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

    const chartContainers = [];
    const floatingCells = [];

    Object.keys(results).forEach((name, index) => {
        const cell = document.getElementById(`cell-${name}`);
        if (cell) {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-container';
            chartContainer.innerHTML = `<canvas id="chart-${name}"></canvas>`;
            leftColumn.appendChild(chartContainer);
            chartContainers.push(chartContainer);

            createDistributionChart(`chart-${name}`, results[name]);

            const floatingCell = createFloatingCell(name, cells[name], results);
            rightColumn.innerHTML += floatingCell;
            floatingCells.push(document.getElementById(`floating-${name}`));

            let isActive = false;

            function toggleActive() {
                isActive = !isActive;
                chartContainer.classList.toggle('active', isActive);
                document.getElementById(`floating-${name}`).classList.toggle('active', isActive);
                if (isActive) {
                    drawLines();
                } else {
                    removeLines();
                }
            }

            function drawLines() {
                removeLines(); // Remove any existing lines first

                const cellRect = cell.getBoundingClientRect();
                const chartRect = chartContainer.getBoundingClientRect();
                const floatingCellElement = document.getElementById(`floating-${name}`);
                const floatingCellRect = floatingCellElement.getBoundingClientRect();

                const leftLine = document.createElement('div');
                leftLine.className = 'link-line';
                leftLine.style.width = `${cellRect.left - chartRect.right}px`;
                leftLine.style.left = `${chartRect.right}px`;
                leftLine.style.top = `${cellRect.top + window.scrollY + cellRect.height / 2}px`;
                document.body.appendChild(leftLine);

                const rightLine = document.createElement('div');
                rightLine.className = 'link-line';
                rightLine.style.width = `${floatingCellRect.left - cellRect.right}px`;
                rightLine.style.left = `${cellRect.right}px`;
                rightLine.style.top = `${cellRect.top + window.scrollY + cellRect.height / 2}px`;
                document.body.appendChild(rightLine);
            }

            function removeLines() {
                document.querySelectorAll('.link-line').forEach(line => line.remove());
            }

            cell.addEventListener('click', toggleActive);
            cell.addEventListener('mouseover', () => {
                if (!isActive) {
                    chartContainer.classList.add('active');
                    document.getElementById(`floating-${name}`).classList.add('active');
                    drawLines();
                }
            });
            cell.addEventListener('mouseout', () => {
                if (!isActive) {
                    chartContainer.classList.remove('active');
                    document.getElementById(`floating-${name}`).classList.remove('active');
                    removeLines();
                }
            });
        }
    });

    // Calculate non-overlapping positions
    const chartPositions = calculateNonOverlappingPositions(chartContainers);
    const floatingCellPositions = calculateNonOverlappingPositions(floatingCells);

    // Apply calculated positions
    chartPositions.forEach((pos, element) => {
        element.style.top = `${pos.top}px`;
    });

    floatingCellPositions.forEach((pos, element) => {
        element.style.top = `${pos.top}px`;
    });
}

const rawInput = document.getElementById('raw-input');
const viewMode = document.getElementById('view-mode');
const rawEditor = document.getElementById('raw-editor');
const rawModeBtn = document.getElementById('raw-mode-btn');
const viewModeBtn = document.getElementById('view-mode-btn');

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

rawInput.addEventListener('input', () => {
    if (!viewMode.classList.contains('hidden')) {
        updateView();
    }
});

rawModeBtn.addEventListener('click', switchToRawMode);
viewModeBtn.addEventListener('click', switchToViewMode);

switchToRawMode();
