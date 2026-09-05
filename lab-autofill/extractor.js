// This file now simply normalizes the raw text from the PDF.
// We no longer hardcode test names here, avoiding "overfitting".
// The extraction logic has been moved to content.js where it dynamically reads the screen.

function normalizeText(text) {
    // PDF.js sometimes inserts spaces between numbers like "1 1 . 2". We fix that here.
    let normalized = text.replace(/(\d)\s+(?=\d)/g, '$1');
    normalized = normalized.replace(/(\d)\s*\.\s*(?=\d)/g, '$1.');
    normalized = normalized.replace(/(\d)\s*,\s*(?=\d)/g, '$1,');
    
    // Collapse multiple spaces within lines (but preserve newlines for row structure)
    normalized = normalized.replace(/[ \t]+/g, ' ');
    // Collapse multiple blank lines into one
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    return normalized.trim();
}

// In the new architecture, we just pass the normalized full text.
function extractLabData(rawText) {
    return normalizeText(rawText);
}

// Export for testing in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractLabData, normalizeText };
}
