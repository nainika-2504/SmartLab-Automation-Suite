// Test case to verify the LDL/VLDL and Bilirubin matching fixes
const mockPdfText = `
lipid profile
total cholesterol 187 mg/dl desirable:<200
cholesterol-hdl 53 mg/dl low:<40
cholesterol-ldl 111 mg/dl normal:<100
cholesterol-vldl 23 mg/dl 7-40
triglycerides 117 mg/dl normal:<160
total cholesterol / hdl ratio 3.5 ratio desirable:<4
ldl / hdl ratio 2.1 ratio 0.0-3.5
lft-liver function test
total bilirubin 0.3 mg/dl 0.2-1.2
direct bilirubin 0.1 mg/dl 0.0-0.4
indirect bilirubin 0.2 mg/dl 0.1-1.0
`.toLowerCase();

function cleanLabelText(labelText) {
    let cleanLabel = labelText.trim();
    cleanLabel = cleanLabel.split('\n')[0].trim();
    let cleanLabelLower = cleanLabel.toLowerCase();
    cleanLabelLower = cleanLabelLower.replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '');
    cleanLabelLower = cleanLabelLower.replace(/\s*\/\s*/g, '/');
    return cleanLabelLower;
}

function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;
    if (index > 0) {
        const charBefore = cleanLabelLower[index - 1];
        if (/[a-z]/i.test(charBefore)) return false;
    }
    return true;
}

// The key insight: we must build a SPECIFIC regex that searches
// for the ALIAS anchored near its OWN context in the PDF, not just
// "anywhere in the text". The fix is to search for the alias 
// and then pick up the number immediately after it, NOT the first
// number in the entire document.
function findValueInPdf(pdfText, alias) {
    const safeAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // The number must appear within 60 chars of the alias
    const regex = new RegExp(safeAlias + '\\s{0,60}?([0-9]+(?:[,.][0-9]+)?)', 'i');
    const match = pdfText.match(regex);
    return match ? match[1] : null;
}

const commonAliases = [
    ['sgpt', 'alt', 'alanine'],
    ['sgot', 'ast', 'aspartate'],
    ['wbc', 'leucocyte', 'leukocyte', 'white blood cell', 'total leucocytes count'],
    ['rbc', 'erythrocyte', 'red blood cell', 'erythrocyte count'],
    ['hba1c', 'glycosylated hemoglobin', 'glycated hemoglobin'],
    ['ldl', 'cholesterol-ldl', 'ldl cholesterol', 'cholesterol-l d l', 'l d l'],
    ['hdl', 'cholesterol-hdl', 'hdl cholesterol'],
    ['vldl', 'cholesterol-vldl', 'cholesterol vldl', 'vldl cholesterol', 'cholesterol- v l d l', 'v l d l'],
    ['hb', 'hemoglobin'],
    ['indirect bilirubin', 'unconjugated', 'i.d.bilirubin', 'i.d. bilirubin', 'id bilirubin'],
    ['direct bilirubin', 'conjugated', 'd.bilirubin', 'd. bilirubin'],
    ['albumin/globulin ratio', 'albumin / globulin ratio', 'a/g ratio', 'a / g ratio']
];

function testMatch(labelText, expectedValue) {
    const cleanLabelLower = cleanLabelText(labelText);
    
    const safeLabel = cleanLabelLower
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        .replace(/\\\//g, '\\s*\\/\\s*');
    const regexFull = new RegExp(safeLabel + '[^0-9a-z]*?([0-9]+(?:[,.][0-9]+)?)', 'i');
    let match = mockPdfText.match(regexFull);
    let method = 'exact';

    if (!match) {
        // Check parentheses stripped label
        if (cleanLabelLower.includes('(')) {
            const shortLabel = cleanLabelLower.split('(')[0].trim();
            if (shortLabel.length > 3) {
                const safeShort = shortLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regexShort = new RegExp(safeShort + '[^0-9a-z]*?([0-9]+(?:[,.][0-9]+)?)', 'i');
                match = mockPdfText.match(regexShort);
                if (match) method = `stripped:(${shortLabel})`;
            }
        }
    }

    if (!match) {
        for (const aliasGroup of commonAliases) {
            if (aliasGroup.some(alias => isAliasMatch(cleanLabelLower, alias))) {
                for (const alias of aliasGroup) {
                    const value = findValueInPdf(mockPdfText, alias);
                    if (value) {
                        match = [null, value];
                        method = `alias:${alias}`;
                        break;
                    }
                }
            }
            if (match) break;
        }
    }

    const got = match ? match[1] : null;
    const pass = got === expectedValue;
    console.log(`${pass ? '✅' : '❌'} "${labelText}" -> got: ${got}, expected: ${expectedValue} (via ${method})`);
}

console.log("=== LDL / VLDL Tests ===");
testMatch("Cholesterol-L D L", "111");
testMatch("Cholesterol- V L D L", "23");
testMatch("Cholesterol-LDL", "111");
testMatch("Cholesterol-VLDL", "23");

console.log("\n=== Bilirubin Tests ===");
testMatch("Conjugated (D. Bilirubin)", "0.1");
testMatch("Unconjugated ( I.D.Bilirubin)", "0.2");
testMatch("Direct Bilirubin", "0.1");
testMatch("Indirect Bilirubin", "0.2");
