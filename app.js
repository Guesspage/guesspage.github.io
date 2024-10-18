const CLIENT_ID = 'Ov23liSvbiboUUd1hGLa';
const REDIRECT_URI = 'https://guesspage.github.io';
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

let accessToken = null;

// Generate a random string for the code verifier
function generateCodeVerifier() {
    const array = new Uint32Array(56);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

// Create a code challenge from the code verifier
async function generateCodeChallenge(codeVerifier) {
    const digest = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(codeVerifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Start the authentication process
async function startAuth() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'gist user',
        state: generateCodeVerifier(), // Use a random state
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });

    window.location = `${GITHUB_AUTH_URL}?${params.toString()}`;
}

// Handle the callback from GitHub
async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const codeVerifier = localStorage.getItem('code_verifier');

    if (code && state) {
        try {
            const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: CLIENT_ID,
                    code: code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: codeVerifier
                })
            });

            const data = await tokenResponse.json();
            if (data.access_token) {
                accessToken = data.access_token;
                localStorage.setItem('accessToken', accessToken);
                await updateLoginButton();
                // Clear the URL parameters
                window.history.replaceState({}, document.title, REDIRECT_URI);
            } else {
                throw new Error('Failed to get access token');
            }
        } catch (error) {
            console.error('Error during token exchange:', error);
            alert('Authentication failed. Please try again.');
        }
    }
}

// Fetch user information
async function fetchUserInfo() {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });
    return await response.json();
}

// Update login button and user info
async function updateLoginButton() {
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');

    if (accessToken) {
        loginBtn.textContent = 'Logout';
        loginBtn.onclick = logout;

        try {
            const user = await fetchUserInfo();
            userAvatar.src = user.avatar_url;
            userName.textContent = user.name || user.login;
            userInfo.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    } else {
        loginBtn.textContent = 'Login';
        loginBtn.onclick = startAuth;
        userInfo.classList.add('hidden');
    }
}

// Logout function
function logout() {
    accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('code_verifier');
    document.getElementById('user-info').classList.add('hidden');
    updateLoginButton();
}

// Gist operations
async function createGist(content) {
    const response = await fetch(`${GITHUB_API_URL}/gists`, {
        method: 'POST',
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                'guessbook.md': {
                    content: content,
                },
            },
            public: false,
            description: 'Guessbook document',
        }),
    });
    const data = await response.json();
    return data.id;
}

async function updateGist(gistId, content) {
    const response = await fetch(`${GITHUB_API_URL}/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                'guessbook.md': {
                    content: content,
                },
            },
        }),
    });
    const data = await response.json();
    return data.id;
}

async function loadGist(gistId) {
    const response = await fetch(`${GITHUB_API_URL}/gists/${gistId}`, {
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });
    const data = await response.json();
    return data.files['guessbook.md'].content;
}

// URL handling
function getGistIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('gist');
}

function updateUrlWithGistId(gistId) {
    const url = new URL(window.location);
    url.searchParams.set('gist', gistId);
    window.history.pushState({}, '', url);
}

// Local storage management
function saveToLocalStorage(content) {
    localStorage.setItem('guessbook_content', content);
}

function loadFromLocalStorage() {
    return localStorage.getItem('guessbook_content');
}

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

document.getElementById('new-gist-btn').addEventListener('click', async () => {
    if (!accessToken) {
        alert('Please login first');
        return;
    }
    const content = rawInput.value;
    saveToLocalStorage(content);
    const gistId = await createGist(content);
    updateUrlWithGistId(gistId);
    alert('New Gist created successfully!');
});

document.getElementById('save-gist-btn').addEventListener('click', async () => {
    if (!accessToken) {
        alert('Please login first');
        return;
    }
    const content = rawInput.value;
    saveToLocalStorage(content);
    const gistId = getGistIdFromUrl();
    if (gistId) {
        await updateGist(gistId, content);
        alert('Gist updated successfully!');
    } else {
        const newGistId = await createGist(content);
        updateUrlWithGistId(newGistId);
        alert('New Gist created successfully!');
    }
});

document.getElementById('load-gist-btn').addEventListener('click', async () => {
    if (!accessToken) {
        alert('Please login first');
        return;
    }
    const gistId = prompt('Enter Gist ID:');
    if (gistId) {
        const content = await loadGist(gistId);
        rawInput.value = content;
        updateUrlWithGistId(gistId);
        updateView();
    }
});

document.getElementById('login-btn').addEventListener('click', startAuth);

// Initialize the app
function init() {
    accessToken = localStorage.getItem('accessToken');
    updateLoginButton();

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        handleCallback();
    } else {
        const gistId = getGistIdFromUrl();
        if (gistId && accessToken) {
            loadGist(gistId).then(content => {
                rawInput.value = content;
                updateView();
            }).catch(error => {
                console.error('Error loading Gist:', error);
                alert('Error loading Gist. Please check the Gist ID and try again.');
            });
        } else {
            const savedContent = loadFromLocalStorage();
            if (savedContent) {
                rawInput.value = savedContent;
                updateView();
            }
        }
    }
}

init();
switchToRawMode();
