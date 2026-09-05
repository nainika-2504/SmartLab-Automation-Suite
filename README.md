# SmartLab Automation Suite

End-to-end browser automation for diagnostic laboratory workflows. Two Chrome extensions that handle the entire LIMS data pipeline — from patient intake to diagnostic result entry.



## Modules

### Module 1: Batch Intake Engine (`lab-auto-register/`)

Automates bulk patient registration on the lab management portal. Front-desk staff upload a CSV file with patient details (`Name, Age, Gender`), configure the lab/contract/package/doctor settings, and the extension fills out each registration form sequentially — handling Select2 dropdowns, modal popups, and page reloads automatically.

**Key capabilities:**
- CSV parsing with automatic title inference (Mr./Mrs./Miss based on age + gender)
- Select2 dropdown interaction via native DOM events (no jQuery dependency)
- Queue state persisted to `chrome.storage.local` — survives page reloads mid-batch
- Pre-commit status save prevents duplicate registrations
- 48 preconfigured lab locations, 4 contract types, 13 test packages

**Impact:** Reduced per-patient registration time from ~45 seconds to ~5 seconds (88% speedup).

---

### Module 2: Diagnostic Results Engine (`lab-autofill/`)

Automates filling lab test results into the LIMS portal. Lab technicians upload a PDF report, the extension extracts tabular data using Mozilla's PDF.js, matches parameters to form fields using an alias dictionary, and fills values automatically — including background refill when the DOM re-renders.

**Key capabilities:**
- Position-aware PDF text extraction (Y-threshold row grouping, X-coordinate column sorting)
- Multi-strategy parameter matching: exact match -> shortened label -> synonym alias lookup
- Substring collision guarding (`VLDL` won't false-match `LDL`, `T4` won't match `T3`)
- Medical range validation with warning chips for out-of-bounds values
- `MutationObserver`-based background refill — re-populates fields after saving individual tests

**Impact:** Reduced per-report data entry time from ~3 minutes to under 2 seconds (98% speedup).

---

## Project Structure

```
SmartLab-Automation-Suite/
|-- lab-auto-register/          # Module 1: Batch Intake Engine
|   |-- manifest.json           # Extension config (MV3)
|   |-- popup.html              # Settings UI (Lab/Contract/Package/Doctor dropdowns)
|   |-- popup.css               # Popup styling (Inter font, progress bar, cards)
|   |-- popup.js                # CSV parser, title inference, storage poller
|   |-- content.js              # Select2 synthesizer, pre-commit state machine
|   |-- patients.csv            # Sample intake data file
|   |-- icons/
|
|-- lab-autofill/               # Module 2: Diagnostic Results Engine
|   |-- manifest.json           # Extension config (MV3)
|   |-- popup.html              # PDF upload UI (memory state, result chips)
|   |-- popup.css               # Warning styling & chip CSS
|   |-- popup.js                # PDF.js loader, tabular Y/X parser, result renderer
|   |-- content.js              # Alias matcher, collision guard, range check, MutationObserver
|   |-- extractor.js            # PDF text extraction helper
|   |-- pdf.min.js              # Mozilla PDF.js core library
|   |-- pdf.worker.min.js       # Mozilla PDF.js worker thread
|   |-- icons/
|
|-- docs/                       # Project documentation
|   |-- UNIFIED_SRS_DOCUMENT.*  # Software Requirements Specification
|   |-- UNIFIED_SDD_DOCUMENT.*  # System Design Document
|   |-- UNIFIED_PROJECT_REPORT.*# Final Project Report
|   |-- UNIFIED_TEST_PLAN_QA.*  # Test Plan & QA Report
|   |-- UNIFIED_USER_MANUAL.*   # User Manual & Operations Guide
|   |-- UNIFIED_DEVELOPER_GUIDE.*  # Developer Reference Manual
|
|-- README.md                   # This file
```

---

## Why Two Separate Extensions?

The suite is split into two Chrome extensions rather than one because:

1. **Different users, different workflows.** Module 1 is used by front-desk receptionists during patient intake. Module 2 is used by lab technicians hours later during result entry. Merging them would create unnecessary UI clutter for both user groups.

2. **Different host page contexts.** Module 1 operates on the group registration page (`/admin/groups/create`). Module 2 operates on individual patient result entry pages. Each content script is scoped to its target.

3. **Independent deployment.** Bug fixes or feature updates to the autofill logic don't require reloading the registration extension, and vice versa.

---

## Installation

Both extensions are installed the same way:

1. Clone this repository:
   ```
   git clone https://github.com/nainika-2504/SmartLab-Automation-Suite.git
   ```
2. Open Chrome -> `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** -> select the `lab-auto-register` folder.
5. Click **Load unpacked** again -> select the `lab-autofill` folder.
6. Both extension icons should appear in the toolbar. Pin them for quick access.

---

## Operating Environment

| Requirement | Details |
|---|---|
| Browser | Google Chrome v102+ or Chromium-based (Edge, Brave) |
| Extension Standard | Manifest V3 |
| Target Portal | Web-based LIMS (Hostinger-hosted) |
| Dependencies | None — pure vanilla JavaScript, no build step |
| External Libraries | PDF.js (bundled in lab-autofill/, not fetched at runtime) |

---

## Documentation

Full project documentation is in the `docs/` folder:

| Document | Description |
|---|---|
| `UNIFIED_SRS_DOCUMENT` | Functional & non-functional requirements for both modules |
| `UNIFIED_SDD_DOCUMENT` | System architecture, data flow, sequence diagrams |
| `UNIFIED_PROJECT_REPORT` | Final internship project report |
| `UNIFIED_TEST_PLAN_QA` | Test cases and QA execution summary |
| `UNIFIED_USER_MANUAL` | Step-by-step usage guide for both extensions |
| `UNIFIED_DEVELOPER_GUIDE` | Code reference, function-level documentation |

Each document is available in both `.md` (editable) and `.docx` (formatted) versions.

---

## License

Internal tool — developed during internship at Glukem Biocare Pvt. Ltd. Not published to the Chrome Web Store.
