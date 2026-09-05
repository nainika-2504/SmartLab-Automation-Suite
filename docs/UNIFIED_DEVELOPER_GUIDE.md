# UNIFIED DEVELOPER & CODE REFERENCE MANUAL
## SmartLab Automation Suite: End-to-End LIMS Workflow & Data Pipeline Engine

---

### Document Control

| Item | Details |
| :--- | :--- |
| **Project Title** | SmartLab Automation Suite |
| **Document Type** | Developer & Code Reference Manual |
| **Document Version** | 2.0.0 |
| **Date** | September 2026 |
| **Target Audience** | Software Engineers, Extension Maintainers, LIMS Integration Developers |
| **Modules Covered** | Module 1 (`lab-auto-register`) & Module 2 (`lab-autofill`) |

---

## 1. Project Directory Sitemap

```
SmartLab Automation Suite/
├── lab-auto-register/ (Module 1: Batch Intake Engine)
│   ├── manifest.json         # Extension MV3 configuration & permissions
│   ├── popup.html            # Extension popup UI (Lab/Contract/Package/Doctor dropdowns)
│   ├── popup.css             # Inter typography, modern card styles, progress bar
│   ├── popup.js              # CSV parser, title inference, storage poller
│   ├── content.js            # Select2 synthesizer, pre-commit state machine
│   └── patients.csv          # Sample intake data file
│
└── lab-autofill/ (Module 2: Diagnostic Results Engine)
    ├── manifest.json         # Extension MV3 configuration
    ├── popup.html            # Extension popup UI (Memory state, result chips)
    ├── popup.css             # Warning styling & chip CSS
    ├── popup.js              # pdf.js loader, tabular Y/X parser, result renderer
    ├── content.js            # Alias matcher, collision guard, range check, MutationObserver
    ├── pdf.min.js            # Mozilla PDF.js core library
    └── pdf.worker.min.js     # Mozilla PDF.js worker thread
```

---

## 2. Chrome Storage & Messaging Specifications

### 2.1 Storage Keys Reference (`chrome.storage.local`)

| Storage Key | Module | Schema / Data Type | Purpose |
| :--- | :--- | :--- | :--- |
| `reg_status` | Module 1 | `Object` | Stores current queue state: `{ patients, currentIndex, settings, results, isRunning }`. |
| `reg_lab` | Module 1 | `String` | Saved Lab Name setting choice. |
| `reg_contract` | Module 1 | `String` | Saved Contract pricing model choice. |
| `reg_package` | Module 1 | `String` | Saved Package profile choice. |
| `reg_doctor` | Module 1 | `String` | Saved Doctor name string. |
| `savedPdfText` | Module 2 | `String` | Extracted tabular text of active PDF report. |
| `savedPdfName` | Module 2 | `String` | File name of active PDF report. |
| `sessionPdfText` | Module 2 | `String` | Background memory PDF text for auto-refill across re-renders. |
| `sessionPatientInfo` | Module 2 | `Object` | `{ name, barcodes }` extracted for verifying page tab match. |

### 2.2 Messaging Protocol (`chrome.tabs.sendMessage`)

- **`START_QUEUE`** (Module 1): Sent from `popup.js` to `content.js` to initiate batch processing.
- **`FILL_LAB_DATA`** (Module 2): Sent from `popup.js` to `content.js` with `{ action: "FILL_LAB_DATA", data: pdfText }` payload. Returns `{ status: "success", details: [...] }`.

---

## 3. Core Algorithms & Code Snippets

### 3.1 Module 1: Pre-Commit Queue Persistence (`content.js`)
```javascript
// Crucial: Update storage BEFORE form submit reload to advance index and mark DONE
const latestStatus = (await chromeStorageGet('reg_status')) || currentStatus;
latestStatus.patients[patientIndex].status = 'done';
latestStatus.results.push({ name: patient.name, success: true, code: patientCode });
latestStatus.currentIndex = patientIndex + 1;
await chromeStorageSet('reg_status', latestStatus);

// Main save submit causes page reload; reloaded page picks up index + 1 automatically
mainSaveBtn.click();
```

### 3.2 Module 1: Select2 DOM Event Synthesizer (`content.js`)
```javascript
async function clickSelect2Option(selectEl, targetText) {
    let s2container = selectEl.nextElementSibling || selectEl.parentElement?.querySelector('.select2-container');
    if (!s2container) { setNativeSelect(selectEl, targetText); return; }

    const selection = s2container.querySelector('.select2-selection');
    selection.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(400);

    const searchInput = document.querySelector('.select2-search__field');
    if (searchInput) {
        searchInput.focus();
        for (const char of targetText.substring(0, 4)) {
            searchInput.value += char;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));
            await sleep(50);
        }
        await sleep(600);
    }

    const items = document.querySelectorAll('.select2-results__option');
    for (const item of items) {
        if (item.textContent.trim().toLowerCase().includes(targetText.toLowerCase())) {
            item.click();
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            break;
        }
    }
}
```

### 3.3 Module 2: Position-Aware Tabular PDF Parser (`popup.js`)
```javascript
const rows = {};
const yThreshold = 3;
for (const item of content.items) {
    if (!item.str || item.str.trim() === '') continue;
    const y = Math.round(item.transform[5] / yThreshold) * yThreshold;
    const x = item.transform[4];
    if (!rows[y]) rows[y] = [];
    rows[y].push({ x, text: item.str });
}
const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);
for (const y of sortedYs) {
    rows[y].sort((a, b) => a.x - b.x); // Sort left-to-right
    fullText += rows[y].map(i => i.text).join(' ') + '\n';
}
```

### 3.4 Module 2: Substring Collision Guarding (`content.js`)
```javascript
function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;
    if (index > 0 && /[a-z]/i.test(cleanLabelLower[index - 1])) return false; // Prefix guard
    const endIndex = index + alias.length;
    if (endIndex < cleanLabelLower.length && /[a-z]/i.test(cleanLabelLower[endIndex])) return false; // Suffix guard
    return true;
}
```

---

## 4. Maintenance & Extensibility Guide

### 4.1 Adding a New Lab Location or Package Option
In `lab-auto-register/popup.html`, add your `<option>` element to `#setting-lab` or `#setting-package`:
```html
<option value="New Lab Name - Location">New Lab Name - Location</option>
```

### 4.2 Adding a New Medical Parameter Alias
In `lab-autofill/content.js`, add your synonym group array to `commonAliases`:
```javascript
['serum uric acid', 'uric acid', 'urate']
```
