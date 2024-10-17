// Tokenizer
function tokenize(formula) {
    const regex = /(\s*[+\-*/(),]\s*|\s+|[A-Za-z_][A-Za-z0-9_]*|[0-9]*\.?[0-9]+)/g;
    return formula.match(regex).filter(token => token.trim() !== '');
}

// Parser
function parse(tokens, definedVariables) {
    let current = 0;

    function parseNumber() {
        return () => Number(tokens[current++]);
    }

    function parseIdentifier() {
        const name = tokens[current++].trim();
        if (!definedVariables.has(name)) {
            throw new Error(`Variable "${name}" is used before it's defined`);
        }
        return (context) => {
            if (!(name in context)) {
                throw new Error(`Undefined variable: ${name}`);
            }
            return context[name];
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
        const name = tokens[current++].trim();
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
                return (context) => normalRandom(args[0](context), args[1](context));
            case 'min':
                return (context) => Math.min(...args.map(arg => arg(context)));
            case 'max':
                return (context) => Math.max(...args.map(arg => arg(context)));
            // Add more functions here
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
            if (operator === '*') {
                left = (context) => left(context) * right(context);
            } else {
                left = (context) => left(context) / right(context);
            }
        }
        return left;
    }

    function parseExpression() {
        let left = parseTerm();
        while (tokens[current] === '+' || tokens[current] === '-') {
            const operator = tokens[current++];
            const right = parseTerm();
            if (operator === '+') {
                left = (context) => left(context) + right(context);
            } else {
                left = (context) => left(context) - right(context);
            }
        }
        return left;
    }

    const result = parseExpression();
    if (current < tokens.length) {
        throw new Error(`Unexpected token at end: ${tokens[current]}`);
    }
    return result;
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
            // You might want to display this error to the user in some way
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
            context[name] = formula(context);
            results[name].push(context[name]);
        }
    }
    return results;
}

function renderResults(results) {
    let html = '';
    for (const [name, values] of Object.entries(results)) {
        const sortedValues = values.sort((a, b) => a - b);
        const meanValue = mean(values);
        const medianValue = median(values);
        const lowBound = sortedValues[Math.floor(values.length * 0.05)];
        const highBound = sortedValues[Math.floor(values.length * 0.95)];

        html += `<h3>${name}</h3>`;
        html += `<p>Mean: ${meanValue.toFixed(2)}</p>`;
        html += `<p>Median: ${medianValue.toFixed(2)}</p>`;
        html += `<p>90% range: ${lowBound.toFixed(2)} - ${highBound.toFixed(2)}</p>`;
        // We'll add a simple bar chart here later
    }
    return html;
}

// DOM elements
const rawInput = document.getElementById('raw-input');
const viewMode = document.getElementById('view-mode');
const rawEditor = document.getElementById('raw-editor');
const rawModeBtn = document.getElementById('raw-mode-btn');
const viewModeBtn = document.getElementById('view-mode-btn');

// Mode switching functions
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

function updateView() {
    const input = rawInput.value;
    const cells = parseInput(input);
    const results = generateResults(cells);
    viewMode.innerHTML = renderResults(results);
}

// Event listeners
rawInput.addEventListener('input', () => {
    if (viewMode.classList.contains('hidden')) {
        return;
    }
    updateView();
});

rawModeBtn.addEventListener('click', switchToRawMode);
viewModeBtn.addEventListener('click', switchToViewMode);

// Initial setup
switchToRawMode();
