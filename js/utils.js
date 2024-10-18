export function debounce(func, wait) {
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

export function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = type === 'success' ? 'var(--primary-color)' : '#f44336';
    notification.style.display = 'block';
    notification.setAttribute('role', 'alert');
    setTimeout(() => {
        notification.style.display = 'none';
        notification.removeAttribute('role');
    }, 3000);
}

export function memoize(fn) {
    const cache = new Map();
    return function(...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
