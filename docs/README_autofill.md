# Lab Report AutoFill — B2B Data Entry Extension

[![GitHub](https://img.shields.io/badge/GitHub-nainika--2504%2Freport__autofill-blue?logo=github)](https://github.com/nainika-2504/report_autofill)

A powerful, dynamic browser extension built for B2B diagnostic labs that receive reports from external facilities and need to re-enter values into their own internal web portals every day.

Upload a PDF lab report once. The extension reads whatever fields are visible on your screen, finds the matching values inside the PDF, and fills them in — instantly.

---

## ✨ What's New in v1.1

- **Plain-English results panel** — After filling, the popup shows only what needs attention: warnings to double-check and fields it couldn't find. No clutter.
- **Range validation** — If a filled value looks medically implausible (e.g. Hemoglobin of 227), it flags it for review instead of silently entering the wrong number.
- **Extension icon** — Now shows a proper icon in your browser toolbar.

---

## 🔑 Key Features

### Dynamic Screen-Driven Matching
The extension never hardcodes test names. It reads the labels on your website right now and hunts the PDF for those exact names. This means it works with **any** external lab PDF format and **any** internal portal — without needing configuration.

### Multi-Layer Fallback Engine
For every field on screen, the agent tries:
1. Exact label match
2. Shortened name (strips parentheses)
3. Medical synonym lookup (SGPT = ALT, WBC = Leucocytes, HbA1c = Glycosylated Hemoglobin, etc.)
4. Range validation cross-check

### Cross-Tab Memory
Upload the PDF once. Fill the LFT tab, save, switch to the CBC tab — the PDF is still in memory. Click Start Autofill again. No re-uploading between tabs or between page reloads.

### 100% Local — No Data Leaves Your Browser
PDF parsing is done entirely in-browser using [PDF.js](https://mozilla.github.io/pdf.js/). Nothing is sent to any server.

---

## 🚀 Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome or Edge and go to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Toggle on **Developer mode** (top right)
4. Click **Load unpacked** and select the `lab-autofill` folder
5. Pin the extension to your toolbar for easy access

---

## 💡 How to Use

1. Navigate to the tab on your portal where you want to enter results
2. Click the **Lab AutoFill** icon in your toolbar
3. Upload the patient's PDF lab report (only needed once per patient)
4. Click **Start Autofill**
5. Review the results panel:
   - **Filled X** — done automatically
   - **⚠️ Check X** — filled but value looks unusual, verify manually
   - **❌ Could not fill X** — not in PDF, enter manually
6. Switch tabs and click **Start Autofill** again — no re-upload needed

---

## 🛠️ Architecture

| File | Purpose |
|---|---|
| `manifest.json` | Chrome Extension config (Manifest V3, v1.1) |
| `popup.html/css/js` | Extension UI — file upload, memory state, results panel |
| `extractor.js` | Cleans and normalizes raw PDF text |
| `content.js` | Core engine — reads screen labels, matches PDF, fills inputs, validates ranges |
| `icons/` | Extension icons at 16×16, 48×48, 128×128 px |
| `store/` | Chrome Web Store listing copy |

---

## 📦 Chrome Web Store

See [`store/description.md`](store/description.md) for the ready-to-paste store listing text.

To publish:
1. Zip the `lab-autofill` folder
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Click **New Item**, upload the zip
4. Paste the store description and upload screenshots
