# System Design Document (SDD)
## SmartLab Automation Suite: End-to-End LIMS Workflow & Data Pipeline Engine

---

### Document Control

| Item | Details |
| :--- | :--- |
| **Project Title** | SmartLab Automation Suite (Unified LIMS Workflow Engine) |
| **Document Version** | 2.0.0 (Unified Design Release) |
| **Date** | September 2026 |
| **Author** | Automated Laboratory Solutions Engineering Team |
| **Target Platform** | Google Chrome / Chromium Browsers (Manifest V3) |
| **Modules Covered** | Module 1: Patient Intake Engine (`lab-auto-register`)<br>Module 2: Diagnostic Results AutoFill Engine (`lab-autofill`) |
| **Status** | Final Approved |

---

## Table of Contents
1. [Architectural Overview](#1-architectural-overview)
   - 1.1 High-Level Modular Design
   - 1.2 Component Architecture Diagram
   - 1.3 Chrome MV3 Messaging & Execution Contexts
2. [Module 1 Technical Design (`lab-auto-register`)](#2-module-1-technical-design-lab-auto-register)
   - 2.1 Storage Data Schema (`reg_status`)
   - 2.2 CSV Parsing & Title Inference Logic
   - 2.3 Select2 DOM Event Synthesizer Architecture
   - 2.4 Pre-Commit Reload Recovery Engine
3. [Module 2 Technical Design (`lab-autofill`)](#3-module-2-technical-design-lab-autofill)
   - 3.1 Storage Data Schema (`savedPdfText`, `sessionPatientInfo`)
   - 3.2 Position-Aware Tabular PDF Text Extractor
   - 3.3 Multi-Strategy Parameter Matcher & Alias Dictionary
   - 3.4 Substring Collision Guarding (`isAliasMatch`)
   - 3.5 Range Validation Engine (`checkRange`)
   - 3.6 Persistent Background Monitor & DOM Mutation Observer
4. [Data Storage Dictionary](#4-data-storage-dictionary)
   - 4.1 Storage Keys & Structure
5. [System UML Diagrams & Circuit Flow Placeholders](#5-system-uml-diagrams--circuit-flow-placeholders)
   - 5.1 System Component & Storage Architecture Diagram
   - 5.2 Pre-Commit Queue Execution Flowchart
   - 5.3 Position-Aware PDF Parsing Algorithm Flowchart

---

## 1. Architectural Overview

### 1.1 High-Level Modular Design
The **SmartLab Automation Suite** is designed around a **Modular Dual-Extension Architecture**. Rather than forcing all features into a single monolithic extension popup, the platform decouples front-desk patient intake (Module 1) from diagnostic report entry (Module 2).

```
+-----------------------------------------------------------------------------------+
|                           SMARTLAB AUTOMATION SUITE                               |
|                                                                                   |
|  +---------------------------------------+   +---------------------------------+  |
|  | Module 1: lab-auto-register          |   | Module 2: lab-autofill          |  |
|  | - Target: Front-Desk / Receptionist  |   | - Target: Pathologist / Tech    |  |
|  | - Task: Bulk CSV Intake & Select2     |   | - Task: PDF Extraction & Fill   |  |
|  +-------------------+-------------------+   +----------------+----------------+  |
|                      |                                        |                   |
|                      +-------------> LIMS Portal <------------+                   |
|                                   (Web Interface)                                 |
+-----------------------------------------------------------------------------------+
```

### 1.2 Component Architecture Diagram

```
+-----------------------------------------------------------------------+
|                            USER INTERFACE                             |
|  +-----------------------------------+ +---------------------------+  |
|  | Module 1 Popup (popup.html/js)    | | Module 2 Popup (popup.js) |  |
|  +-----------------+-----------------+ +-------------+-------------+  |
+--------------------|---------------------------------|----------------+
                     |                                 |
                     v (State Storage Synchronization) v
+-----------------------------------------------------------------------+
|                           PERSISTENCE LAYER                           |
|  +-----------------------------------------------------------------+  |
|  | chrome.storage.local                                            |  |
|  | - reg_status: { patients, currentIndex, settings, results }     |  |
|  | - savedPdfText, sessionPdfText, sessionPatientInfo              |  |
|  +---------------------------------+-------------------------------+  |
+------------------------------------|----------------------------------+
                                     |
                                     v (DOM Injection & Event Synthesizer)
+-----------------------------------------------------------------------+
|                            CONTENT SCRIPT                             |
|  +-----------------------------------------------------------------+  |
|  | Target Page DOM (content.js)                                    |  |
|  | - Modal Input Synthesizer & Select2 Engine                      |  |
|  | - Position-Aware Field Matcher & Substring Guarding             |  |
|  | - Persistent DOM MutationObserver Refill                        |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 2. Module 1 Technical Design (`lab-auto-register`)

### 2.1 Storage Data Schema (`reg_status`)

```json
{
  "reg_status": {
    "patients": [
      {
        "name": "SAROJANA M",
        "age": 60,
        "gender": "Female",
        "title": "Mrs.",
        "status": "done"
      }
    ],
    "currentIndex": 1,
    "settings": {
      "labName": "Glukem Biocare PVT Limit",
      "contract": "MRP",
      "packageName": "Glukem Health Checkup",
      "doctorName": "Employee Health Checkup"
    },
    "results": [
      {
        "name": "SAROJANA M",
        "success": true,
        "code": "PAT10042"
      }
    ],
    "isRunning": true
  }
}
```

### 2.2 Title Inference Rules
```javascript
let title;
if (gender === 'Male') {
    title = 'Mr.';
} else {
    title = age >= 20 ? 'Mrs.' : 'Miss';
}
```

### 2.3 Select2 DOM Synthesizer Architecture
```javascript
async function clickSelect2Option(selectEl, targetText) {
    let s2container = selectEl.nextElementSibling || selectEl.parentElement?.querySelector('.select2-container');
    if (!s2container) {
        setNativeSelect(selectEl, targetText);
        return;
    }

    const selection = s2container.querySelector('.select2-selection');
    if (selection) {
        selection.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
    await sleep(400);

    const searchInput = document.querySelector('.select2-search__field');
    if (searchInput) {
        searchInput.focus();
        const searchChars = targetText.substring(0, 4);
        for (const char of searchChars) {
            searchInput.value += char;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));
            await sleep(50);
        }
        await sleep(600);
    }

    const resultItems = document.querySelectorAll('.select2-results__option');
    for (const item of resultItems) {
        const itemText = item.textContent.trim().toLowerCase();
        if (itemText.includes(targetText.toLowerCase())) {
            item.click();
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            break;
        }
    }
}
```

### 2.4 Pre-Commit Reload Recovery Engine
```
[Start Patient i] ──> [Open Modal & Fill] ──> [Modal Save] ──> [Fill Doctor & Package]
                                                                        |
                                                                        v
 [Page Reload] <── [Click Main Save] <── [Advance Index i+1 & Mark DONE in Storage]
       |
       v
 [Resume Queue at i+1]
```

---

## 3. Module 2 Technical Design (`lab-autofill`)

### 3.1 Position-Aware Tabular PDF Extractor
```javascript
const rows = {};
const yThreshold = 3; // Items within 3 units belong to the same row

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
    const line = rows[y].map(item => item.text).join(' ');
    fullText += line + '\n';
}
```

### 3.2 Substring Collision Guarding (`isAliasMatch`)
```javascript
function isAliasMatch(cleanLabelLower, alias) {
    const index = cleanLabelLower.indexOf(alias);
    if (index === -1) return false;

    // Prefix Guard: Ensure preceding char is not a letter (e.g. 'v' in 'vldl')
    if (index > 0 && /[a-z]/i.test(cleanLabelLower[index - 1])) {
        return false;
    }

    // Suffix Guard: Ensure succeeding char is not a letter (e.g. 's' in 'erythrocytes')
    const endIndex = index + alias.length;
    if (endIndex < cleanLabelLower.length && /[a-z]/i.test(cleanLabelLower[endIndex])) {
        return false;
    }

    return true;
}
```

### 3.3 Medical Range Validation (`checkRange`)
```javascript
function checkRange(labelLower, num) {
    if (isNaN(num)) return null;
    const ranges = {
        'hemoglobin': [4, 20],
        'glucose': [20, 700],
        'creatinine': [0.1, 20],
        'platelet': [10, 2000]
    };
    for (const [key, [min, max]] of Object.entries(ranges)) {
        if (labelLower.includes(key) && (num < min || num > max)) {
            return `${num} is outside expected medical range [${min}–${max}]`;
        }
    }
    return null;
}
```

---

## 4. Data Storage Dictionary

| Storage Key | Module | Type | Description |
| :--- | :--- | :--- | :--- |
| `reg_status` | Module 1 | `Object` | Stores current queue state, patient list, currentIndex, settings, and results. |
| `reg_lab` | Module 1 | `String` | Saved default Lab Location setting. |
| `reg_contract` | Module 1 | `String` | Saved default Contract Pricing model. |
| `reg_package` | Module 1 | `String` | Saved default Package profile choice. |
| `reg_doctor` | Module 1 | `String` | Saved default Supervising Doctor name. |
| `savedPdfText` | Module 2 | `String` | Raw tabular extracted text of the active PDF report. |
| `savedPdfName` | Module 2 | `String` | File name of the currently loaded PDF report. |
| `sessionPdfText` | Module 2 | `String` | Background memory PDF text for auto-refill across table re-renders. |
| `sessionPatientInfo` | Module 2 | `Object` | Extracted patient name and barcode list for verifying tab session match. |

---

## 5. System UML Diagrams & Circuit Flow Placeholders

### 5.1 System Component Architecture Diagram

```
================================================================================
|             [ PLACEHOLDER: SYSTEM COMPONENT ARCHITECTURE ]                   |
|                                                                              |
|  +------------------------+                  +----------------------------+  |
|  | Module 1 Popup Controller|                | Module 2 Popup Controller  |  |
|  +------------------------+                  +----------------------------+  |
|               |                                            |                 |
|               +------------------> Storage <---------------+                 |
|                                  (Local API)                                 |
|                                       |                                      |
|                                       v                                      |
|                       +-------------------------------+                      |
|                       | Content Script DOM Automator  |                      |
|                       +-------------------------------+                      |
================================================================================
```

---

### 5.2 Pre-Commit Queue Execution Flowchart

```
================================================================================
|         [ PLACEHOLDER: PRE-COMMIT QUEUE EXECUTION FLOWCHART ]                |
|                                                                              |
|   [ Start Patient i ] ---> [ Fill Modal ] ---> [ Click Modal Save ]          |
|                                                      |                       |
|                                                      v                       |
|   [ Form Submit ] <--- [ Save Index i+1 DONE ] <--- [ Fill Doctor & Package] |
|          |                                                                   |
|          v                                                                   |
|   [ Page Reload ] ---> [ Resume Queue at Index i+1 ]                         |
================================================================================
```

---

### 5.3 Position-Aware PDF Parsing Algorithm Flowchart

```
================================================================================
|        [ PLACEHOLDER: PDF POSITION-AWARE PARSING ALGORITHM ]                 |
|                                                                              |
|   [ Extract PDF Items ] ---> [ Group by Y-Coordinate Row Threshold (3px) ]   |
|                                      |                                       |
|                                      v                                       |
|   [ Reconstruct Lines ] <--- [ Sort Items Left-to-Right by X-Coordinate ]    |
================================================================================
```
