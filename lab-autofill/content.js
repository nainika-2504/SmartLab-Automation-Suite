chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FILL_LAB_DATA") {
        runDynamicAutofill(request.data, false)
            .then((result) => sendResponse({ status: "success", details: result }))
            .catch(err => {
                console.error(err);
                sendResponse({ status: "error", message: err.message });
            });
        return true; 
    }
});

async function runDynamicAutofill(pdfText, silent = false) {
    if (!silent) {
        console.log("Starting Explicit Dynamic 'Screen-Driven' AutoFill...");
    }
    
    const results = [];
    const normalizedPdfText = pdfText.toLowerCase();

    // Query both input fields and select dropdowns
    const fields = Array.from(document.querySelectorAll(
        'input[type="text"], input[type="number"], input:not([type]), input[type="tel"], select'
    ));
    
    // If not silent (explicit user trigger), clear all previous attempted/filled flags 
    // so we can re-attempt filling everything
    if (!silent) {
        for (const field of fields) {
            field.removeAttribute('data-autofill-attempted');
            field.removeAttribute('data-autofilled');
        }
    }

    let processedCount = 0;
    
    for (const field of fields) {
        // Skip fields that aren't empty (don't overwrite user changes or already filled data)
        if (!isFieldEmpty(field)) {
            continue;
        } else {
            // Field is empty — clear attempted attribute so if the page reloads or resets it, we can refill it
            field.removeAttribute('data-autofill-attempted');
        }

        // Skip fields we've already attempted in this current cycle
        if (field.getAttribute('data-autofill-attempted') === 'true') {
            continue;
        }

        let labelText = null;
        
        // Only process fields that are inside a table row (test forms layout)
        const row = field.closest('tr');
        if (row) {
            const firstTd = row.querySelector('td, th');
            if (firstTd && firstTd.textContent) {
                labelText = firstTd.textContent;
            }
        } else {
            continue; 
        }
        
        if (!labelText) continue;

        let cleanLabel = labelText.trim();
        cleanLabel = cleanLabel.split('\n')[0].trim();
        
        if (cleanLabel.length < 2 || cleanLabel.length > 80) continue;

        let cleanLabelLower = cleanLabel.toLowerCase();
        // Clean spaces in spaced-out abbreviations like "l d l" -> "ldl" or "v l d l" -> "vldl"
        cleanLabelLower = cleanLabelLower.replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '');
        // Clean spaces around slashes like "albumin / globulin" -> "albumin/globulin"
        cleanLabelLower = cleanLabelLower.replace(/\s*\/\s*/g, '/');

        const safeLabel = cleanLabelLower
            .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
            .replace(/\\\//g, '\\s*\\/\\s*'); // allow optional spaces around slash
        
        // Mark as attempted so we don't evaluate it again
        field.setAttribute('data-autofill-attempted', 'true');

        let match = null;
        let matchReason = '';

        // Attempt 1: Exact label match
        const regexFull = new RegExp(safeLabel + '[^0-9a-z]*?([0-9]+(?:[,.][0-9]+)?)', 'i');
        match = normalizedPdfText.match(regexFull);
        if (match) {
            matchReason = 'exact name';
        }

        // Attempt 2: Strip parentheses
        if (!match && cleanLabelLower.includes('(')) {
            const shortLabel = cleanLabelLower.split('(')[0].trim();
            if (shortLabel.length > 3) {
                const safeShortLabel = shortLabel.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regexShort = new RegExp(safeShortLabel + '[^0-9a-z]*?([0-9]+(?:[,.][0-9]+)?)', 'i');
                match = normalizedPdfText.match(regexShort);
                if (match) matchReason = 'shortened name';
            }
        }

        // Attempt 3: Medical synonyms
        if (!match) {
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
                // IMPORTANT: indirect/unconjugated must come BEFORE direct/conjugated
                // so that "unconjugated" is tried first and doesn't fall through to "conjugated"
                ['indirect bilirubin', 'unconjugated', 'i.d.bilirubin', 'i.d. bilirubin', 'id bilirubin'],
                ['direct bilirubin', 'conjugated', 'd.bilirubin', 'd. bilirubin'],
                ['albumin/globulin ratio', 'albumin / globulin ratio', 'a/g ratio', 'a / g ratio'],
                // Thyroid: portal shows "Total Tri-Iodothyronine (T3)", PDF shows "Tri-Iodothyronine Total (TT3)"
                // IMPORTANT: T4/TT4 must come BEFORE T3/TT3 to prevent T3 substring match inside T4
                ['total thyroxine', 'thyroxine total', 't4', 'tt4'],
                ['total tri-iodothyronine', 'tri-iodothyronine total', 'triiodothyronine total', 't3', 'tt3'],
                // Kidney: portal shows "Serum Creatinine", PDF may show "Creatinine"
                ['serum creatinine', 'creatinine'],
                // ESR: portal shows "Erythrocytes Sedimentation Rate (ESR)", PDF shows same or "ESR"
                ['erythrocytes sedimentation rate', 'erythrocyte sedimentation rate', 'esr'],
                // RDW: portal shows "Red Cell Distribution Width (RDW)", PDF may have "(RDW)- CV 13.4"
                ['red cell distribution width', 'rdw']
            ];

            for (const aliasGroup of commonAliases) {
                if (aliasGroup.some(alias => isAliasMatch(cleanLabelLower, alias))) {
                    for (const alias of aliasGroup) {
                        const safeAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        // Skip parenthetical annotations (e.g. "(TT3)"), then allow short non-digit text (e.g. "- CV") before the number
                        const regexAlias = new RegExp(safeAlias + '(?:\\s*\\([^)]*\\))*[^\\n\\d]{0,20}([0-9]+(?:[,.][0-9]+)?)', 'i');
                        match = normalizedPdfText.match(regexAlias);
                        if (match) {
                            matchReason = `alternate name "${alias}"`;
                            break;
                        }
                    }
                }
                if (match) break;
            }
        }

        const isSelect = field.tagName.toLowerCase() === 'select';

        if (isSelect) {
            // ── DROPDOWN SELECT LOGIC ──
            const options = Array.from(field.options).filter(opt => opt.value !== "");
            let bestOption = null;
            let selectMatchReason = '';

            const labelPos = normalizedPdfText.indexOf(cleanLabelLower);
            if (labelPos !== -1) {
                // Examine text following the test name in the PDF
                const textAfterLabel = normalizedPdfText.substring(labelPos + cleanLabelLower.length, labelPos + cleanLabelLower.length + 150);
                
                let maxOverlap = 0;
                for (const option of options) {
                    const optionTextLower = option.textContent.trim().toLowerCase();
                    const optionValueLower = option.value.trim().toLowerCase();

                    if (textAfterLabel.includes(optionTextLower) && optionTextLower.length > maxOverlap) {
                        bestOption = option;
                        maxOverlap = optionTextLower.length;
                        selectMatchReason = `exact match "${option.textContent}"`;
                    } else if (optionValueLower && textAfterLabel.includes(optionValueLower) && optionValueLower.length > maxOverlap) {
                        bestOption = option;
                        maxOverlap = optionValueLower.length;
                        selectMatchReason = `value match "${option.value}"`;
                    }
                }

                // Fallback word matching
                if (!bestOption) {
                    for (const option of options) {
                        const words = option.textContent.trim().toLowerCase().split(/\s+/).filter(w => w.length > 3);
                        if (words.length > 0 && words.every(word => textAfterLabel.includes(word))) {
                            bestOption = option;
                            selectMatchReason = `fuzzy match "${option.textContent}"`;
                            break;
                        }
                    }
                }
            }

            if (bestOption) {
                const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
                if (nativeSelectValueSetter) {
                    nativeSelectValueSetter.call(field, bestOption.value);
                } else {
                    field.value = bestOption.value;
                }
                field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                field.setAttribute('data-autofilled', 'true');
                processedCount++;

                results.push({
                    label: cleanLabel,
                    value: bestOption.textContent,
                    status: 'filled',
                    reason: `Selected dropdown via ${selectMatchReason}`
                });
                console.log(`[AutoFill] ✅ '${cleanLabel}' → Selected: '${bestOption.textContent}'`);
            } else {
                results.push({
                    label: cleanLabel,
                    value: null,
                    status: 'missed',
                    reason: 'Could not match dropdown options'
                });
            }
        } else {
            // ── TEXT / NUMBER INPUT LOGIC ──
            if (match && match[1]) {
                const value = match[1];

                // Range validation — if value is outside a plausible range, warn
                const rangeWarning = checkRange(cleanLabelLower, parseFloat(value.replace(',', '')));
                
                // Fill the input
                field.focus();
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(field, value);
                } else {
                    field.value = value;
                }
                field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
                field.blur();
                field.setAttribute('data-autofilled', 'true');
                processedCount++;

                if (rangeWarning) {
                    results.push({ 
                        label: cleanLabel, 
                        value, 
                        status: 'warning', 
                        reason: `Filled as "${value}" — but please double-check, value seems unusual` 
                    });
                } else {
                    results.push({ 
                        label: cleanLabel, 
                        value, 
                        status: 'filled', 
                        reason: `Found using ${matchReason}` 
                    });
                }

                console.log(`[AutoFill] ✅ '${cleanLabel}' → ${value} (via ${matchReason})`);
            } else {
                results.push({ 
                    label: cleanLabel, 
                    value: null, 
                    status: 'missed', 
                    reason: 'Not found in the PDF' 
                });
                if (!silent) {
                    console.log(`[AutoFill] ❌ Could not fill: '${cleanLabel}'`);
                }
            }
        }
    }
    
    return results;
}

// Check if a field is empty
function isFieldEmpty(field) {
    if (field.tagName.toLowerCase() === 'select') {
        return field.value === "" || field.selectedIndex <= 0;
    }
    return field.value === "";
}

// Range check — returns a warning string if value is outside expected medical range
function checkRange(labelLower, num) {
    if (isNaN(num)) return null;
    const ranges = {
        'hemoglobin': [4, 20],
        'cholesterol': [50, 450],
        'triglycerides': [30, 2000],
        'glucose': [20, 700],
        'creatinine': [0.1, 20],
        'urea': [5, 300],
        'sodium': [100, 180],
        'potassium': [1, 10],
        'bilirubin': [0, 30],
        'albumin': [1, 6],
        'platelet': [10, 2000]
    };
    for (const [key, [min, max]] of Object.entries(ranges)) {
        if (labelLower.includes(key)) {
            if (num < min || num > max) return `${num} is outside normal range [${min}–${max}]`;
        }
    }
    return null;
}

// ── BACKGROUND AUTO-REFILL SESSIONS ────────────────────────────────────────

// Helper to check if any form input rows on current page match tests in PDF text
function hasMatchingTestFields(pdfText) {
    if (!pdfText) return false;
    const normalizedPdfText = pdfText.toLowerCase();
    const fields = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type]), input[type="tel"], select');
    
    for (const field of fields) {
        const row = field.closest('tr');
        if (!row) continue;
        const firstTd = row.querySelector('td, th');
        if (!firstTd || !firstTd.textContent) continue;
        
        let cleanLabel = firstTd.textContent.trim().split('\n')[0].trim().toLowerCase();
        if (cleanLabel.length < 2 || cleanLabel.length > 80) continue;
        
        cleanLabel = cleanLabel.replace(/(?<=\b[a-z])\s+(?=[a-z]\b)/gi, '').replace(/\s*\/\s*/g, '/');
        const shortLabel = cleanLabel.split('(')[0].trim();
        
        if (normalizedPdfText.includes(cleanLabel) || (shortLabel.length > 3 && normalizedPdfText.includes(shortLabel))) {
            return true;
        }
    }
    return false;
}

function verifyPatientSession(patientInfo, pdfText) {
    if (!patientInfo) return true;
    if ((!patientInfo.barcodes || patientInfo.barcodes.length === 0) && !patientInfo.name) {
        return true; // No specific patient info to restrict matching
    }
    
    let pageText = document.body.innerText.toLowerCase();
    
    // Also include values inside input/textarea elements on page
    const inputs = document.querySelectorAll('input, textarea');
    for (const input of inputs) {
        if (input.value) {
            pageText += ' ' + input.value.toLowerCase();
        }
    }
    
    // Check barcodes
    if (patientInfo.barcodes && patientInfo.barcodes.length > 0) {
        for (const barcode of patientInfo.barcodes) {
            if (pageText.includes(barcode.toLowerCase())) {
                return true;
            }
        }
    }
    
    // Check patient name parts
    if (patientInfo.name) {
        const nameParts = patientInfo.name.toLowerCase()
            .replace(/^(mr|mrs|ms|dr|master|baby|smt|sri)\.?\s+/g, '') // remove prefixes
            .split(/[\s.]+/)
            .filter(part => part.length > 2); // only parts longer than 2 characters
            
        for (const part of nameParts) {
            if (pageText.includes(part)) {
                return true;
            }
        }
    }
    
    // Check if the page table has test fields present in the PDF text
    if (pdfText && hasMatchingTestFields(pdfText)) {
        return true;
    }
    
    return false;
}

let autofillInterval = null;
let isRefilling = false;
let mutationDebounceTimer = null;

function triggerBackgroundRefill() {
    if (isRefilling) return;
    
    chrome.storage.local.get(['sessionPdfText', 'savedPdfText', 'sessionPatientInfo'], (result) => {
        const pdfText = result.sessionPdfText || result.savedPdfText;
        if (!pdfText) return;
        
        const matches = verifyPatientSession(result.sessionPatientInfo, pdfText);
        if (matches || !result.sessionPatientInfo) {
            isRefilling = true;
            runDynamicAutofill(pdfText, true)
                .catch(() => {})
                .finally(() => {
                    isRefilling = false;
                });
        }
    });
}

function startAutofillMonitor() {
    if (autofillInterval) clearInterval(autofillInterval);
    
    // Trigger immediate refill check on script initialization / page load
    triggerBackgroundRefill();
    
    // Periodic fallback monitor check (every 1000ms)
    autofillInterval = setInterval(() => {
        triggerBackgroundRefill();
    }, 1000);
    
    // Observe DOM changes so that when a user saves one test and the portal re-renders the table,
    // empty fields get refilled instantly without delay
    if (window._autofillObserver) {
        window._autofillObserver.disconnect();
    }
    
    const observer = new MutationObserver((mutations) => {
        let hasRelevantChanges = false;
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                hasRelevantChanges = true;
                break;
            }
        }
        
        if (hasRelevantChanges) {
            if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
            mutationDebounceTimer = setTimeout(() => {
                triggerBackgroundRefill();
            }, 250);
        }
    });
    
    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        window._autofillObserver = observer;
    }
}

// Start monitoring the page automatically
startAutofillMonitor();

// Helper to check if a cleanLabel matches an alias while protecting against substring conflicts
function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;
    
    // Prefix guard: Check if the character before the match is a letter (e.g. 'v' in 'vldl', 'in' in 'indirect')
    if (index > 0) {
        const charBefore = cleanLabelLower[index - 1];
        if (/[a-z]/i.test(charBefore)) {
            return false;
        }
    }
    
    // Suffix guard: Check if the character after the match is a letter (e.g. 's' in 'erythrocytes' when alias is 'erythrocyte')
    const endIndex = index + alias.length;
    if (endIndex < cleanLabelLower.length) {
        const charAfter = cleanLabelLower[endIndex];
        if (/[a-z]/i.test(charAfter)) {
            return false;
        }
    }
    
    return true;
}
