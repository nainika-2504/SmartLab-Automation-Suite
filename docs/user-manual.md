# UNIFIED USER MANUAL & OPERATIONS GUIDE
## SmartLab Automation Suite: End-to-End LIMS Workflow & Data Pipeline Engine

---

### Document Control

| Item | Details |
| :--- | :--- |
| **Project Title** | SmartLab Automation Suite |
| **Document Type** | User Manual & Operations Guide |
| **Document Version** | 2.0.0 |
| **Date** | September 2026 |
| **Target Audience** | Front-Desk Receptionists, Camp Coordinators, Lab Technicians, Pathologists |
| **Modules Covered** | Module 1 (`lab-auto-register`) & Module 2 (`lab-autofill`) |

---

## 1. Installation & Initial Setup

### 1.1 Loading Unpacked Extensions in Chrome / Edge / Brave
1. Download or locate the project directories:
   - `lab-auto-register` (Module 1: Intake)
   - `lab-autofill` (Module 2: AutoFill)
2. Open your web browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked**.
5. Select the `lab-auto-register` folder. Repeat for `lab-autofill`.
6. Pin both extension icons to your browser toolbar for easy access.

---

## 2. Module 1 User Guide: Batch Patient Intake (`lab-auto-register`)

*Target User: Front-Desk Receptionist / Camp Coordinator*

```
+-------------------------------------------------------------+
| LAB AUTO REGISTER                                           |
| Lab Name : [ Glukem Biocare PVT Limit             v ]       |
| Contract : [ MRP                                  v ]       |
| Package  : [ Glukem Health Checkup                v ]       |
| Doctor   : [ Employee Health Checkup               ]        |
|                                                             |
| [ Choose CSV File ]   OR   Paste text below:                |
| +---------------------------------------------------------+ |
| | SAROJANA M, 60, F                                       | |
| | RAVI KUMAR, 35, M                                       | |
| +---------------------------------------------------------+ |
|                                                             |
| [ ▶ Start Registration ]                                    |
+-------------------------------------------------------------+
```

### Step-by-Step Registration Instructions:
1. Log into your lab management web portal (`/admin/groups/create`).
2. Click the **Lab Auto Register** extension icon in the toolbar.
3. Select your batch presets:
   - **Lab Name**: Choose from 48 diagnostic center locations.
   - **Contract**: Select `MRP`, `L To L - A`, `L To L - B`, or `Platinum Card`.
   - **Package**: Select your test profile (e.g. *Glukem Health Checkup*, *Allergy Profiles*).
   - **Doctor**: Confirm supervising doctor name.
4. Supply your patient list:
   - Click **Choose CSV File** to upload a `.csv` / `.txt` file, OR
   - Paste patient rows directly into the text area (`Name, Age, Gender`).
5. Click **▶ Start Registration**.
6. The extension will automatically open the patient modal, fill demographic details (inferring `Mr.`, `Mrs.`, `Miss`), select options, click Save, and proceed patient-by-patient until completed.

---

## 3. Module 2 User Guide: Diagnostic Results AutoFill (`lab-autofill`)

*Target User: Lab Technician / Pathologist*

```
+-------------------------------------------------------------+
| LAB REPORT AUTOFILL                                         |
|                                                             |
| [ Choose PDF File ]   OR   Loaded PDF in Memory:            |
| 📄 Report_Patient_10042.pdf                                 |
|                                                             |
| [ Start AutoFill ]                                          |
|                                                             |
| Summary:                                                    |
| [ ✅ Filled 18 ]  [ ⚠️ Check 1 ]  [ ❌ Missed 0 ]            |
+-------------------------------------------------------------+
```

### Step-by-Step AutoFill Instructions:
1. Open the patient's test form page on your lab portal.
2. Click the **Lab AutoFill** extension icon in your toolbar.
3. Upload the patient's PDF report (`.pdf`). The extension parses and stores the text in memory.
4. Click **Start AutoFill**.
5. The extension populates input fields and dropdowns automatically across the test table.
6. Review the Results Panel:
   - **✅ Filled**: Successfully matched parameters.
   - **⚠️ Check**: Values that appear outside expected biological bounds (double-check these numbers!).
   - **❌ Missed**: Parameters not found in the PDF.
7. **Background Refill Feature**: When you save an individual test on the web portal and the table re-renders, the extension automatically refills empty fields in the background—you do **not** need to re-upload the PDF!

---

## 4. Troubleshooting & FAQ

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| Extension shows "Error: Refresh lab website" | Web tab lost active connection | Refresh the lab web page (`F5`) and click Start again. |
| Patient marked with `Miss` instead of `Mrs.` | Age listed under 20 years | Verify age field in CSV input. |
| Parameter yellow warning `⚠️ Check` shown | Extracted value outside expected range | Manually double-check the value against the original PDF report. |
| Modal doesn't open automatically | Portal loaded slowly | Increase page load delay or click "Not Listed" manually once. |
