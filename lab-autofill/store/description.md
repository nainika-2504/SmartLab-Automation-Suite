# Chrome Web Store — Listing Copy

## Extension Name
Lab Report AutoFill

## Short Description (132 chars max)
Instantly fills lab report data from any PDF into your web portal. Built for B2B lab data entry teams.

## Full Description

**Stop typing. Start autofilling.**

Lab Report AutoFill is built for B2B diagnostic labs that receive reports from external facilities and need to manually re-enter those values into their own internal portals every single day.

Upload a PDF lab report, click Start, and the extension reads every field visible on your screen — then hunts through the PDF and fills in the matching value. No configuration. No mapping files. It just works.

---

### 🧠 Smart Matching — works across labs and formats
The extension uses a multi-layer matching engine:
- Tries the **exact field name** first
- Falls back to **parentheses-stripped names** (e.g. "Glycosylated Hemoglobin (HbA1c)" → "Glycosylated Hemoglobin")
- Uses a built-in **medical synonym dictionary** (e.g. SGPT = ALT, WBC = Leucocytes)
- Runs a **range validation check** — if a filled value looks medically implausible, it flags it for review

### 📋 Only shows what needs attention
After filling, the popup shows you a clean summary:
- **Filled X** — done, no action needed
- **⚠️ Check X** — filled but value looks unusual, verify manually
- **❌ Could not fill X** — not found in the PDF, enter manually

No walls of green checkmarks. Just what matters.

### 💾 Cross-tab memory
Upload the PDF once. Fill the LFT tab. Save. Switch to CBC. Hit Autofill again — the PDF is still there. No re-uploading between tabs.

### 🔒 Fully local — no data leaves your browser
The PDF is parsed entirely inside your browser using PDF.js. No data is sent to any server.

---

## Category
Productivity

## Language
English

## Privacy Policy required?
Yes — must note that no data is collected or transmitted.
