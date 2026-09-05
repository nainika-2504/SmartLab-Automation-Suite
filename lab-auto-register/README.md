# Lab Auto Register

Batch patient registration tool for diagnostic lab portals. Built as a Chrome extension (Manifest V3) that reads a CSV list of patients and fills out the web-based registration form one-by-one — automatically.

Developed to speed up the daily intake workflow at **Glukem Biocare Pvt. Ltd.** and its partner diagnostic centers across Telangana. Instead of manually entering 30–60 patient records each morning, the front-desk staff uploads a single CSV file and the extension handles the rest.

---

## Problem

The lab management portal (`skyblue-boar-647070.hostingersite.com`) does not expose a bulk-upload API. Every patient has to be entered through the browser UI:

1. Click "Not Listed" to open a modal.
2. Fill in salutation, name, age, gender.
3. Select the contract type from a Select2 dropdown.
4. Save the modal.
5. Pick the doctor and test package on the main form.
6. Submit — which reloads the page.
7. Repeat from step 1 for the next patient.

For a batch of 40 patients, that is roughly 280 manual clicks and field entries. This extension automates every step.

---

## How It Works

```
popup.html/popup.js                    content.js
┌──────────────────┐                  ┌──────────────────────────┐
│  User loads CSV   │ ── settings ──► │  Injected into lab page  │
│  Picks lab, pkg,  │    + patient    │                          │
│  contract, doctor │    queue via    │  Loops through queue:    │
│                   │  chrome.storage │   1. Opens modal         │
│  Clicks ▶ Start   │                 │   2. Fills fields        │
└──────────────────┘                  │   3. Selects contract    │
         ▲                            │   4. Saves modal         │
         │  polls reg_status          │   5. Picks doctor/pkg    │
         │  every 1s for progress     │   6. Submits main form   │
         │                            │   7. Page reloads        │
         └────────────────────────────│   8. Resumes via storage │
                                      └──────────────────────────┘
```

**State persistence:** The queue index and per-patient status are stored in `chrome.storage.local` under the key `reg_status`. When the form submission triggers a full page reload, the content script picks up where it left off — no data is lost.

**Select2 handling:** The portal uses Select2 dropdowns (rendered as `<span>` containers on top of hidden `<select>` elements). The extension clicks the rendered container, types in the search box character-by-character, waits for results, and clicks the matching option. If Select2 is not found, it falls back to setting the native `<select>` value directly.

---

## File Structure

```
lab-auto-register/
├── manifest.json        # Extension manifest (MV3), permissions, content script config
├── popup.html           # Extension popup UI — settings panel, CSV input, progress bar
├── popup.css            # Styles for the popup (Inter font, responsive layout)
├── popup.js             # Popup logic — CSV parsing, settings persistence, status polling
├── content.js           # Content script — DOM automation, Select2 interaction, queue runner
├── patients.csv         # Sample CSV file with test data
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## CSV Format

One patient per line: **Name, Age, Gender**

```
PAREEDA NARSIMHA, 45, Male
HIRAMONI LASKAR, 60, Female
RAVI KUMAR, 35, M
PRIYA S, 15, F
```

- Header rows (lines starting with `Name`) are automatically skipped.
- Gender accepts full words (`Male`, `Female`) or abbreviations (`M`, `F`).
- Names are converted to uppercase internally.
- Salutation is inferred: Male → Mr., Female ≥ 20 → Mrs., Female < 20 → Miss.

A sample file is included in the repo — see `patients.csv`.

---

## Installation

1. Clone or download this repository:
   ```
   git clone https://github.com/nainika-2504/lab-auto-register.git
   ```
2. Open Chrome → go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** → select the `lab-auto-register` folder.
5. The extension icon should appear in the toolbar. Pin it for easy access.

---

## Configuration

Open the extension popup to configure the batch settings before starting:

| Setting      | Type     | Default                  | Description                                       |
|--------------|----------|--------------------------|---------------------------------------------------|
| Lab Name     | Dropdown | Glukem Biocare PVT Limit | 48 partner diagnostic centers available            |
| Contract     | Dropdown | MRP                      | Options: MRP, L To L - A, L To L - B, Platinum Card |
| Package      | Dropdown | Glukem Health Checkup    | 13 test packages (allergy profiles, health checkups, etc.) |
| Doctor       | Text     | Employee Health Checkup  | Free-text — must match a doctor name in the portal |

Settings are saved to `chrome.storage.local` and persist across sessions.

---

## Usage

1. Log into the lab portal and navigate to **Group Registration** (`/admin/groups/create`).
2. Click the Lab Auto Register icon in the toolbar.
3. Set Lab Name, Contract, Package, and Doctor as needed.
4. Upload a `.csv` or `.txt` file **or** paste entries directly into the text area.
5. The popup will show a preview with patient count. Verify it looks correct.
6. Click **▶ Start Registration**.
7. The extension will process patients sequentially. You can watch the progress bar in the popup.
8. When finished, the results panel shows which patients were registered successfully (with patient codes) and which ones failed.

You can close and reopen the popup mid-run — the progress bar syncs from storage automatically.

To stop early, click the **■ Stop** button.

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| "Cannot find Not Listed button" | Page hasn't fully loaded or you're on the wrong page | Navigate to `/admin/groups/create` and try again |
| Select2 option not found | The text doesn't match any dropdown entry | Double-check the contract/package/doctor names match what the portal shows |
| Extension does nothing on click | Content script not injected | Reload the page, then try again. If still broken, go to `chrome://extensions/` and reload the extension |
| Progress stuck at one patient | Modal validation failed (missing field, duplicate entry) | Check the browser console (`F12`) for error logs prefixed with `[AutoReg]` |
| Page reloads but queue doesn't resume | Storage was cleared or the extension was reloaded mid-run | Restart the batch |

All console output is prefixed with `[AutoReg]` — filter by that tag in DevTools to see the step-by-step execution log.

---

## Permissions

| Permission    | Reason                                                         |
|---------------|----------------------------------------------------------------|
| `activeTab`   | Access the current tab to inject the content script on demand  |
| `scripting`   | Programmatic script injection via `chrome.tabs.sendMessage`    |
| `storage`     | Persist queue state and settings across page reloads           |
| `<all_urls>`  | Host permission — needed because the portal URL can vary       |

---

## Technical Notes

- **Manifest Version:** 3 (Chrome's current standard for extensions).
- **No background service worker.** The content script runs directly in the page context and self-resumes on reload using stored state.
- **No external dependencies.** Pure vanilla JS — no jQuery, no frameworks, no build step.
- **Select2 interaction** is done through native DOM events (`mousedown`, `input`, `keyup`, `mouseup`). This avoids relying on jQuery triggers that may not be accessible from the content script's isolated world.
- **Timing:** Hard-coded `sleep()` delays (200–2500ms) are used between steps to account for modal animations, AJAX calls, and Select2 search debounce. These values were tuned against the production portal.

---

## License

Internal tool — not published to the Chrome Web Store.
