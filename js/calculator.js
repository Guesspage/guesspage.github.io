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

    if (targetCell && targetCell in results) {
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
    const regex = /(>=|<=|==|!=|AND|OR|NOT|[-+*/%()<>^,.!]|\s+|[A-Za-z_][A-Za-z0-9_]*|[0-9]*\.?[0-9]+)/g;
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
        if (!definedVariables.has(name) && !isBuiltInFunction(name)) {
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

        if (isBuiltInFunction(name)) {
            return new functionClasses[name](name, args);
        } else {
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

    function parseExp() {
        let left = parseFactor();
        while (tokens[current] === '^') {
            const operator = tokens[current++];
            const right = parseFactor();
            left = {
                type: 'operation',
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} ^ ${this.right.repr()}`; },
                calculate: function(context) {
                    return Math.pow(this.left.calculate(context), this.right.calculate(context));
                }
            };
        }
        return left;
    }

    function parseMulDivRem() {
        let left = parseExp();
        while (tokens[current] === '*' || tokens[current] === '/' || tokens[current] === '%') {
            const operator = tokens[current++];
            const right = parseExp();
            left = {
                type: 'operation',
                operator: operator,
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} ${this.operator} ${this.right.repr()}`; },
                calculate: function(context) {
                    if (this.operator === '*') {
                        return this.left.calculate(context) * this.right.calculate(context);
                    } else if (this.operator === '/') {
                        return this.left.calculate(context) / this.right.calculate(context);
                    } else {
                        return this.left.calculate(context) % this.right.calculate(context);
                    }
                }
            };
        }
        return left;
    }

    function parseAddSub() {
        let left = parseMulDivRem();
        while (tokens[current] === '+' || tokens[current] === '-') {
            const operator = tokens[current++];
            const right = parseMulDivRem();
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

    function parseComparison() {
        let left = parseAddSub();
        while (['>', '<', '>=', '<=', '==', '!='].includes(tokens[current])) {
            const operator = tokens[current++];
            const right = parseAddSub();
            left = {
                type: 'comparison',
                operator: operator,
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} ${this.operator} ${this.right.repr()}`; },
                calculate: function(context) {
                    const leftValue = this.left.calculate(context);
                    const rightValue = this.right.calculate(context);
                    switch (this.operator) {
                        case '>': return leftValue > rightValue;
                        case '<': return leftValue < rightValue;
                        case '>=': return leftValue >= rightValue;
                        case '<=': return leftValue <= rightValue;
                        case '==': return leftValue === rightValue;
                        case '!=': return leftValue !== rightValue;
                    }
                }
            };
        }
        return left;
    }

    function parseLogicalAnd() {
        let left = parseComparison();
        while (tokens[current] === 'AND') {
            current++; // Skip 'AND'
            const right = parseComparison();
            left = {
                type: 'logical',
                operator: 'AND',
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} AND ${this.right.repr()}`; },
                calculate: function(context) {
                    return this.left.calculate(context) && this.right.calculate(context);
                }
            };
        }
        return left;
    }

    function parseLogicalOr() {
        let left = parseLogicalAnd();
        while (tokens[current] === 'OR') {
            current++; // Skip 'OR'
            const right = parseLogicalAnd();
            left = {
                type: 'logical',
                operator: 'OR',
                left: left,
                right: right,
                repr: function() { return `${this.left.repr()} OR ${this.right.repr()}`; },
                calculate: function(context) {
                    return this.left.calculate(context) || this.right.calculate(context);
                }
            };
        }
        return left;
    }

    function parseExpression() {
        if (tokens[current] === 'NOT') {
            current++; // Skip 'NOT'
            const expr = parseLogicalOr();
            return {
                type: 'logical',
                operator: 'NOT',
                expr: expr,
                repr: function() { return `NOT ${this.expr.repr()}`; },
                calculate: function(context) {
                    return !this.expr.calculate(context);
                }
            };
        }
        return parseLogicalOr();
    }

    const result = parseExpression();
    if (current < tokens.length) {
        throw new Error(`Unexpected token at end: ${tokens[current]}`);
    }
    return result;
}

class Function {
    constructor(name, args) {
        this.name = name;
        this.args = args;
    }

    repr() {
        return `${this.name}(${this.args.map(arg => arg.repr()).join(', ')})`;
    }

    calculate(context) {
        const argValues = this.args.map(arg => arg.calculate(context));
        return this.evaluate(argValues);
    }

    evaluate(args) {
        throw new Error('evaluate method must be implemented by subclasses');
    }
}

class IfFunction extends Function {
    evaluate([condition, trueValue, falseValue]) {
        return condition ? trueValue : falseValue;
    }
}

class NormalFunction extends Function {
    evaluate([mean, stdDev]) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return num * stdDev + mean;
    }
}

class UniformFunction extends Function {
    evaluate([min, max]) {
        return Math.random() * (max - min) + min;
    }
}

class RoundFunction extends Function {
    evaluate([arg]) {
        return Math.round(arg);
    }
}

class TriangularFunction extends Function {
    evaluate([min, mode, max]) {
        const u = Math.random();
        const f = (mode - min) / (max - min);
        if (u < f) {
            return min + Math.sqrt(u * (max - min) * (mode - min));
        } else {
            return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
        }
    }
}

class MinFunction extends Function {
    evaluate(args) {
        return Math.min(...args);
    }
}

class MaxFunction extends Function {
    evaluate(args) {
        return Math.max(...args);
    }
}

class MeanFunction extends Function {
    evaluate(args) {
        return args.reduce((a, b) => a + b) / args.length;
    }
}

class MedianFunction extends Function {
    evaluate(args) {
        const sorted = [...args].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

class StdevFunction extends Function {
    evaluate(args) {
        const n = args.length;
        const mean = args.reduce((a, b) => a + b) / n;
        return Math.sqrt(args.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
    }
}

class PercentileFunction extends Function {
    evaluate([p, ...arr]) {
        if (p < 0 || p > 100) {
            throw new Error('Percentile must be between 0 and 100');
        }
        const sorted = [...arr].sort((a, b) => a - b);
        const index = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        if (upper === lower) {
            return sorted[index];
        }
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
}

class LogFunction extends Function {
    evaluate([x]) {
        return Math.log(x);
    }
}

class ExpFunction extends Function {
    evaluate([x]) {
        return Math.exp(x);
    }
}

class SinFunction extends Function {
    evaluate([x]) {
        return Math.sin(x);
    }
}

class CosFunction extends Function {
    evaluate([x]) {
        return Math.cos(x);
    }
}

class TanFunction extends Function {
    evaluate([x]) {
        return Math.tan(x);
    }
}

const functionClasses = {
    if: IfFunction,
    normal: NormalFunction,
    uniform: UniformFunction,
    round: RoundFunction,
    triangular: TriangularFunction,
    min: MinFunction,
    max: MaxFunction,
    mean: MeanFunction,
    median: MedianFunction,
    stdev: StdevFunction,
    percentile: PercentileFunction,
    log: LogFunction,
    exp: ExpFunction,
    sin: SinFunction,
    cos: CosFunction,
    tan: TanFunction
};

function isBuiltInFunction(name) {
    return name in functionClasses;
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
