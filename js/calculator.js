import { memoize } from './utils.js';

export function parseInput(input) {
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

export function generateResults(cells, iterations = 10000, targetCell = null) {
    const results = {};
    const sensitivities = {};

    // Initialize results arrays
    for (const name of Object.keys(cells)) {
        results[name] = new Array(iterations);
    }

    // Generate results for each iteration
    for (let i = 0; i < iterations; i++) {
        const context = {}; // New context for each iteration
        for (const [name, formula] of Object.entries(cells)) {
            context[name] = formula.calculate(context);
            results[name][i] = context[name];
        }
    }

    if (targetCell) {
        for (const [name, values] of Object.entries(results)) {
            if (name !== targetCell) {
                sensitivities[name] = calculateSensitivity(results[targetCell], values);
            }
        }

        // Sort sensitivities by absolute beta value
        const sortedSensitivities = Object.entries(sensitivities)
            .sort(([, a], [, b]) => Math.abs(b.beta) - Math.abs(a.beta));

        // Keep only top 5 most sensitive variables
        const topSensitivities = {};
        sortedSensitivities.slice(0, 5).forEach(([name, sensitivity]) => {
            topSensitivities[name] = sensitivity;
        });

        return { results, sensitivities: topSensitivities };
    }

    return { results, sensitivities: null };
}

function tokenize(formula) {
    const regex = /([\+\-\*\/\(\)\,]|\s+|[A-Za-z_][A-Za-z0-9_]*|[0-9]*\.?[0-9]+)/g;
    return formula.match(regex)
        .filter(token => token.trim() !== '')
        .map(token => token.trim());
}

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

    const parseFunctionMemoized = memoize(parseFunction);

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
            return tokens[current + 1] === '(' ? parseFunctionMemoized() : parseIdentifier();
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

function normalRandom(percentile5, percentile95) {
    const mean = (percentile5 + percentile95) / 2;
    const stdDev = (percentile95 - percentile5) / (2 * 1.645); // 1.645 is the z-score for the 95th percentile
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

function calculateSensitivity(targetValues, variableValues) {
    const n = targetValues.length;
    const meanX = variableValues.reduce((a, b) => a + b) / n;
    const meanY = targetValues.reduce((a, b) => a + b) / n;

    let ssxx = 0, ssyy = 0, ssxy = 0;
    for (let i = 0; i < n; i++) {
        ssxx += (variableValues[i] - meanX) ** 2;
        ssyy += (targetValues[i] - meanY) ** 2;
        ssxy += (variableValues[i] - meanX) * (targetValues[i] - meanY);
    }

    const slope = ssxy / ssxx;
    const intercept = meanY - slope * meanX;
    const rSquared = (ssxy ** 2) / (ssxx * ssyy);

    // Calculate standardized regression coefficient (beta)
    const stdDevX = Math.sqrt(ssxx / (n - 1));
    const stdDevY = Math.sqrt(ssyy / (n - 1));
    const beta = slope * (stdDevX / stdDevY);

    return { slope, intercept, rSquared, beta };
}
