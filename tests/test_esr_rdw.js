const mockPdfText = `
cbp-complete blood picture
hemoglobin(hb) 11.6
erythrocyte count (rbc count) 4.3
red cell distribution width (rdw)- cv 13.4
erythrocytes sedimentation rate (esr) 16 mm/1st hr
tri-iodothyronine total (tt3) 1.23 ng/ml
thyroxine total (tt4) 8.5 ug/dl
direct bilirubin 0.1 mg/dl
indirect bilirubin 0.2 mg/dl
cholesterol-ldl 111 mg/dl
cholesterol-vldl 23 mg/dl
`.toLowerCase();

function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;
    if (index > 0 && /[a-z]/i.test(cleanLabelLower[index - 1])) return false;
    const endIndex = index + alias.length;
    if (endIndex < cleanLabelLower.length && /[a-z]/i.test(cleanLabelLower[endIndex])) return false;
    return true;
}

const commonAliases = [
    ['rbc', 'erythrocyte', 'red blood cell', 'erythrocyte count'],
    ['indirect bilirubin', 'unconjugated', 'i.d.bilirubin', 'i.d. bilirubin', 'id bilirubin'],
    ['direct bilirubin', 'conjugated', 'd.bilirubin', 'd. bilirubin'],
    ['total thyroxine', 'thyroxine total', 't4', 'tt4'],
    ['total tri-iodothyronine', 'tri-iodothyronine total', 'triiodothyronine total', 't3', 'tt3'],
    ['erythrocytes sedimentation rate', 'erythrocyte sedimentation rate', 'esr'],
    ['red cell distribution width', 'rdw'],
    ['ldl', 'cholesterol-ldl', 'ldl cholesterol'],
    ['vldl', 'cholesterol-vldl', 'cholesterol vldl', 'vldl cholesterol'],
];

function test(label, expected) {
    let cleanLabelLower = label.toLowerCase().trim().split('\n')[0].trim();
    cleanLabelLower = cleanLabelLower.replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '');
    cleanLabelLower = cleanLabelLower.replace(/\s*\/\s*/g, '/');

    for (const aliasGroup of commonAliases) {
        if (aliasGroup.some(alias => isAliasMatch(cleanLabelLower, alias))) {
            for (const alias of aliasGroup) {
                const safeAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const re = new RegExp(safeAlias + '(?:\\s*\\([^)]*\\))*[^\\n\\d]{0,20}([0-9]+(?:[,.][0-9]+)?)', 'i');
                const match = mockPdfText.match(re);
                if (match) {
                    const pass = match[1] === expected;
                    console.log(`${pass ? '✅' : '❌'} "${label}" -> got: ${match[1]}, expected: ${expected} (via "${alias}")`);
                    return;
                }
            }
        }
    }
    console.log(`❌ "${label}" -> NO MATCH (expected: ${expected})`);
}

console.log("=== RDW Test ===");
test("Red Cell Distribution Width (RDW)", "13.4");

console.log("\n=== Existing Tests (regression check) ===");
test("Erythrocytes Sedimentation Rate- (ESR)", "16");
test("Erythrocyte count (Rbc Count)", "4.3");
test("Total Tri-Iodothyronine (T3)", "1.23");
test("Total Thyroxine (T4)", "8.5");
test("Conjugated (D. Bilirubin)", "0.1");
test("Unconjugated ( I.D.Bilirubin)", "0.2");
test("Cholesterol-LDL", "111");
test("Cholesterol-VLDL", "23");
