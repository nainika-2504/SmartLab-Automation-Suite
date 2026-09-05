# SmartLab Automation Suite

End-to-end browser automation for diagnostic laboratory workflows. Two Chrome extensions that cover the full LIMS data pipeline — from patient intake to diagnostic result entry.

Built during an internship at **Glukem Biocare Pvt. Ltd.**, serving a network of 48 partner diagnostic centers across Telangana.

---

## Modules

### [`lab-auto-register/`](./lab-auto-register) — Batch Intake Engine

Automates bulk patient registration on the lab portal. Staff upload a CSV (`Name, Age, Gender`), set the lab/contract/package/doctor, and the extension handles every step — Select2 dropdowns, modal dialogs, page reloads — until the full batch is done.

- Parses CSV with automatic title inference (`Mr.` / `Mrs.` / `Miss`)
- Interacts with Select2 dropdowns using native DOM events (no jQuery needed)
- State saved to `chrome.storage.local` — survives page reloads mid-batch
- Pre-commit save prevents duplicate registrations on reload
- 48 lab locations · 4 contract types · 13 test packages

> **Impact:** ~45 sec → ~5 sec per patient (88% faster)

---

### [`lab-autofill/`](./lab-autofill) — Diagnostic Results Engine

Automates entering lab test results into the portal. Technicians upload a PDF report; the extension extracts tabular data via PDF.js, matches parameters using an alias dictionary, and fills fields — including a background refill monitor that re-populates values when the DOM re-renders.

- Position-aware PDF extraction (Y-threshold row grouping, X-sort columns)
- 3-strategy matching: exact label → shortened label → synonym alias lookup
- Substring collision guard (e.g. `VLDL` won't match `LDL`)
- Medical range validation with warning chips for out-of-bounds values
- `MutationObserver`-based background refill after saving individual tests

> **Impact:** ~3 min → <2 sec per report (98% faster)

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

## Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/nainika-2504/SmartLab-Automation-Suite.git
   ```
2. Open Chrome → `chrome://extensions/` → enable **Developer mode**
3. **Load unpacked** → select `lab-auto-register/`
4. **Load unpacked** again → select `lab-autofill/`

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
- **Language:** Vanilla JavaScript — no build step, no frameworks
- **PDF parsing:** Mozilla PDF.js (bundled, not fetched at runtime)
- **Storage:** `chrome.storage.local` — all data stays in the browser

---

*Developed during internship at Glukem Biocare Pvt. Ltd. — not published to the Chrome Web Store.*
