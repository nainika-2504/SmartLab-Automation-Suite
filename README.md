# SmartLab Automation Suite

End-to-end browser automation for diagnostic laboratory workflows. Two Chrome extensions that cover the full LIMS data pipeline - from patient intake to diagnostic result entry.

Project period: June 2026 (1 month) | Serving a network of 48 partner diagnostic centers.

---

## Modules

### [`lab-auto-register/`](./lab-auto-register) - Batch Intake Engine

Automates bulk patient registration on the lab portal. Staff upload a CSV (`Name, Age, Gender`), set the lab/contract/package/doctor, and the extension handles every step - Select2 dropdowns, modal dialogs, page reloads - until the full batch is done.

- Parses CSV with automatic title inference (`Mr.` / `Mrs.` / `Miss`)
- Interacts with Select2 dropdowns using native DOM events (no jQuery needed)
- State saved to `chrome.storage.local` - survives page reloads mid-batch
- Pre-commit save prevents duplicate registrations on reload
- 48 lab locations x 4 contract types x 13 test packages

> **Impact:** Registration time per patient falls from about 60 seconds to about 15 seconds (75% saved). For a camp of 100 patients, manual registration at 60 seconds each takes about 100 minutes. With the tool, at about 15 seconds each, it takes about 25 minutes.

---

### [`lab-autofill/`](./lab-autofill) - Diagnostic Results Engine

Diagnostic labs work with each other on a B2B (business-to-business) basis. A lab collects the patient's blood sample, but not every test is available in every centre, so the sample for the missing tests is sent to a B2B lab. The B2B lab sends back its results as a PDF report, and the lab must then copy every value from that PDF into its own portal so the patient's final report is complete. This copying is slow and easy to get wrong, especially for similar-looking tests such as LDL and VLDL or T3 and T4.

**lab-autofill:** reads the PDF report that the B2B lab sends back for outsourced tests, finds each test result, and fills the matching result fields in the lab's own portal, warning the technician about unusual values.

**Key capabilities:**
- Automate entry of outsourced test results, received as a PDF from the B2B lab, into the lab's own portal.
- Position-aware PDF extraction (Y-threshold row grouping, X-sort columns)
- 3-strategy matching: exact label -> shortened label -> synonym alias lookup
- Substring collision guard (e.g. `VLDL` won't match `LDL`, `T4` won't match `T3`)
- Medical range validation with warning chips for out-of-bounds values
- `MutationObserver`-based background refill after saving individual tests

> **Impact:** Entering one report falls from about 3 minutes to about 30 seconds (about 83% saved).

---

## Performance & Time Saved

| Task | Before | After | Time saved |
|---|---|---|---|
| Registering one patient | about 60 s | about 15 s | 75% |
| Entering one report | about 3 min (180 s) | about 30 s | about 83% |

For a camp of 100 patients, manual registration at 60 seconds each takes about 100 minutes. With the tool, at about 15 seconds each, it takes about 25 minutes.

Registration time per patient falls from about 60 seconds to about 15 seconds (75% saved), and entering one report falls from about 3 minutes to about 30 seconds (about 83% saved).

---

## Repository Structure

```
SmartLab-Automation-Suite/
├── lab-auto-register/       # Module 1: Batch Intake Engine
│   ├── manifest.json        # MV3 extension config
│   ├── popup.html/css/js    # Settings UI, CSV parser, progress tracking
│   ├── content.js           # Select2 synthesizer, pre-commit state machine
│   ├── patients.csv         # Sample intake data
│   └── icons/
│
├── lab-autofill/            # Module 2: Diagnostic Results Engine
│   ├── manifest.json        # MV3 extension config
│   ├── popup.html/css/js    # PDF upload UI, result chips, status display
│   ├── content.js           # Alias matcher, collision guard, MutationObserver
│   ├── extractor.js         # PDF text extraction helper
│   ├── pdf.min.js           # Mozilla PDF.js (bundled)
│   └── icons/
│
├── docs/                    # Project documentation
│   ├── architecture.md      # System design & data flow
│   ├── developer-guide.md   # Code reference & function docs
│   ├── user-manual.md       # Step-by-step usage guide
│   └── testing.md           # Test plan & QA report
│
└── README.md
```

---

## Workflow & Usage

### Module 1: Patient Registration
1. Open the portal group registration page.
2. Click the Batch Intake icon, upload the CSV file with patient records, and configure settings.
3. Start the batch; progress saves automatically across page transitions.

### Module 2: Diagnostic Result Auto-fill
1. When a test has been sent out to a B2B lab, open the patient's result page in the portal.
2. Click the Lab AutoFill icon and upload the PDF report received back from the B2B lab.
3. Verify matched values, review any range warning chips, and save.

---

## Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/nainika-2504/SmartLab-Automation-Suite.git
   ```
2. Open Chrome -> `chrome://extensions/` -> enable **Developer mode**
3. **Load unpacked** -> select `lab-auto-register/`
4. **Load unpacked** again -> select `lab-autofill/`

Both extensions will appear in the toolbar. Pin them for quick access.

---

## Why Two Separate Extensions?

| | Module 1 | Module 2 |
|---|---|---|
| **User** | Front-desk receptionist | Lab technician |
| **When** | Patient arrival (morning) | After sample analysis (later) |
| **Input** | CSV file | PDF report |
| **Output** | Registered patient records | Filled test result fields |

Keeping them separate avoids UI clutter, allows independent updates, and scopes each content script to its target page.

---

## Testing & Quality Assurance

All 14 planned test cases passed (7 for each module). One defect (REG-402) was found and fixed: the extension marked successful registrations as "failed", because the page reloaded before progress was saved. It now saves progress before clicking Save, and the fix was verified over 50 consecutive batch runs with 0 false failures.

---

## Docs

| File | Contents |
|---|---|
| [`architecture.md`](./docs/architecture.md) | System design, data flow, sequence diagrams |
| [`developer-guide.md`](./docs/developer-guide.md) | Function-level code reference |
| [`user-manual.md`](./docs/user-manual.md) | End-to-end usage guide for both extensions |
| [`testing.md`](./docs/testing.md) | Test cases and QA execution summary |

---

## Tech

- **Platform:** Chrome Extension Manifest V3
- **Language:** Vanilla JavaScript - no build step, no frameworks
- **PDF parsing:** Mozilla PDF.js (bundled, not fetched at runtime)
- **Storage:** `chrome.storage.local` - all data stays in the browser

---

*Internal tool - not published to the Chrome Web Store.*
