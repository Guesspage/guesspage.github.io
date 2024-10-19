export async function loadExample(key) {
    const response = await fetch(`examples/${key}.md`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
}
