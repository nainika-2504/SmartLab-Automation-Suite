// Simulate exactly what content.js does step by step
const mockPdfText = `
tft (thyroid function test) (se)
tri-iodothyronine total (tt3) 1.23 ng/ml 0.58-1.59
thyroxine total (tt4) 8.5 ug/dl 6.09-12.86
`.toLowerCase();

// Normalize PDF text the same way content.js does
const normalizedPdfText = mockPdfText
    .replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '')
    .replace(/\s*\/\s*/g, '/');

console.log("Normalized PDF text:\n" + normalizedPdfText);

// Simulate portal label cleaning exactly like content.js
function cleanPortalLabel(labelText) {
    let cleanLabel = labelText.trim();
    cleanLabel = cleanLabel.split('\n')[0].trim();
    let cleanLabelLower = cleanLabel.toLowerCase();
    // Clean spaces in spaced-out abbreviations like "l d l" -> "ldl"
    cleanLabelLower = cleanLabelLower.replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '');
    // Clean spaces around slashes
    cleanLabelLower = cleanLabelLower.replace(/\s*\/\s*/g, '/');
    return cleanLabelLower;
}

function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;
    if (index > 0 && /[a-z]/i.test(cleanLabelLower[index - 1])) return false;
    return true;
}

const commonAliases = [
    ['total thyroxine', 'thyroxine total', 't4', 'tt4'],
    ['total tri-iodothyronine', 'tri-iodothyronine total', 'triiodothyronine total', 't3', 'tt3'],
    ['serum creatinine', 'creatinine']
];

function testLabel(rawLabel, expectedValue) {
    const cleanLabelLower = cleanPortalLabel(rawLabel);
    console.log(`\nLabel: "${rawLabel}" -> Cleaned: "${cleanLabelLower}"`);

    // Step 1: Check which alias groups trigger
    for (const aliasGroup of commonAliases) {
        const triggered = aliasGroup.some(alias => isAliasMatch(cleanLabelLower, alias));
        const triggerAlias = aliasGroup.find(alias => isAliasMatch(cleanLabelLower, alias));
        if (triggered) {
            console.log(`  Triggered by alias: "${triggerAlias}" in group [${aliasGroup.join(', ')}]`);
            // Try each alias to find value in PDF
            for (const alias of aliasGroup) {
                const safeAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const re = new RegExp(safeAlias + '(?:\\s*\\([^)]*\\))*\\s*([0-9]+(?:[,.][0-9]+)?)', 'i');
                const match = normalizedPdfText.match(re);
                if (match) {
                    const pass = match[1] === expectedValue;
                    console.log(`  ${pass ? '✅' : '❌'} Found via alias "${alias}": ${match[1]} (expected: ${expectedValue})`);
                    return;
                } else {
                    console.log(`  ⚪ Alias "${alias}" -> no match in PDF`);
                }
            }
            console.log(`  ❌ No alias matched the PDF`);
            return;
        }
    }
    console.log(`  ❌ No alias group triggered for this label`);
}

testLabel('Total Tri-Iodothyronine (T3)', '1.23');
testLabel('Total Thyroxine (T4)', '8.5');
testLabel('Serum Creatinine', '0.8');
