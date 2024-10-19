import { simpleLinearRegression } from './utils.js';

export function parseMarkdown(markdown) {
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
                    result += `<span class="cell" id="cell-${match[1]}" data-formula="${escapeHtml(match[2])}" tabindex="0" role="button" aria-label="Cell ${match[1]}">[${match[1]}]</span>`;
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

export function updateCellValues(html, results, sensitivities, targetCell) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('.cell').forEach(cell => {
        const name = cell.id.replace('cell-', '');
        if (results[name]) {
            const values = results[name];
            const mean = values.reduce((a, b) => a + b) / values.length;
            const sortedValues = values.sort((a, b) => a - b);
            const lowBound = sortedValues[Math.floor(values.length * 0.05)];
            const highBound = sortedValues[Math.floor(values.length * 0.95)];

            cell.innerHTML = `
                <span class="cell-mean">${mean.toFixed(2)}</span>
                <span class="cell-range">${lowBound.toFixed(2)} .. ${highBound.toFixed(2)}</span>
            `;

            if (sensitivities && name in sensitivities) {
                const sensitivity = sensitivities[name];
                const rSquared = sensitivity.rSquared.toFixed(2);
                const rSquaredClass = sensitivity.rSquared > 0.5 ? 'high-sensitivity' : 'low-sensitivity';
                cell.innerHTML += `<span class="cell-sensitivity ${rSquaredClass}">r² = ${rSquared}</span>`;
            }

            cell.classList.add('calculated');
            if (name === targetCell) {
                cell.classList.add('target-cell');
            }
        }
    });
    return doc.body.innerHTML;
}

export function createDistributionChart(canvasId, data, color, fieldName) {
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
                backgroundColor: color,
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
                        text: fieldName
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

export function createSensitivityChart(canvasId, targetData, variableData, sensitivity, variableName, targetName) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Data Points',
                data: targetData.map((y, i) => ({ x: variableData[i], y })),
                backgroundColor: 'rgba(75, 192, 192, 0.6)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `(${context.parsed.x.toFixed(2)}, ${context.parsed.y.toFixed(2)})`
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: variableName }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: targetName }
                }
            }
        }
    });
}

export function createModalChart(canvasId, data, color, sensitivity = null) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const values = data.sort((a, b) => a - b);
    const buckets = 50;
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
                backgroundColor: color,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                annotation: sensitivity ? {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 0,
                            yMax: Math.max(...counts),
                            xMin: values[Math.floor(values.length * 0.05)],
                            xMax: values[Math.floor(values.length * 0.05)],
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                        },
                        line2: {
                            type: 'line',
                            yMin: 0,
                            yMax: Math.max(...counts),
                            xMin: values[Math.floor(values.length * 0.95)],
                            xMax: values[Math.floor(values.length * 0.95)],
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 2,
                        }
                    }
                } : {}
            },
            scales: {
                x: {
                    title: { display: true, text: 'Value' }
                },
                y: {
                    title: { display: true, text: 'Frequency' }
                }
            }
        }
    });
}

export function createFloatingCellContent(name, formula, results, sensitivity = null) {
    const values = results[name];
    const sortedValues = values.sort((a, b) => a - b);
    const lowBound = sortedValues[Math.floor(values.length * 0.05)];
    const highBound = sortedValues[Math.floor(values.length * 0.95)];
    const mean = values.reduce((a, b) => a + b) / values.length;
    const median = sortedValues[Math.floor(values.length / 2)];

    let content = `
        <h3>${name}</h3>
        <p>Formula: ${formula.repr()}</p>
        <p>Mean: ${mean.toFixed(2)}</p>
        <p>Median: ${median.toFixed(2)}</p>
        <p>90% range: ${lowBound.toFixed(2)} .. ${highBound.toFixed(2)}</p>
    `;

    if (sensitivity) {
        content += `
            <p>Sensitivity:</p>
            <p>r² = ${sensitivity.rSquared.toFixed(4)}</p>
            <p>Slope = ${sensitivity.slope.toFixed(4)}</p>
            <p>Intercept = ${sensitivity.intercept.toFixed(4)}</p>
            <p>Beta = ${sensitivity.beta.toFixed(4)}</p>
        `;
    }

    return content;
}
