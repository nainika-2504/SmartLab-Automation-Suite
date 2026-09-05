# Software Requirements Specification (SRS)
## SmartLab Automation Suite: End-to-End LIMS Workflow & Data Pipeline Engine

---

### Document Control

| Item | Details |
| :--- | :--- |
| **Project Title** | SmartLab Automation Suite (Unified LIMS Workflow Engine) |
| **Document Version** | 2.0.0 (Unified Release) |
| **Date** | September 2026 |
| **Author** | Automated Laboratory Solutions Engineering Team |
| **Target Platform** | Google Chrome / Chromium Browsers (Manifest V3) |
| **Modules Covered** | Module 1: Patient Intake Engine (`lab-auto-register`)<br>Module 2: Diagnostic Results AutoFill Engine (`lab-autofill`) |
| **Status** | Final Approved |

---

## Table of Contents
1. [Introduction](#1-introduction)
   - 1.1 Purpose
   - 1.2 Scope
   - 1.3 Definitions, Acronyms, and Abbreviations
   - 1.4 Architectural Overview
2. [Overall Description](#2-overall-description)
   - 2.1 Product Perspective & Modular Design Justification
   - 2.2 Product Functions (Module 1 vs Module 2)
   - 2.3 User Classes and Operational Roles
   - 2.4 Operating Environment
   - 2.5 Design & Technical Constraints
3. [System Features & Functional Requirements](#3-system-features--functional-requirements)
   - 3.1 Module 1: Batch Intake & Patient Registration Engine (`lab-auto-register`)
     - FR-1.1: CSV Data Parsing & Title Inference
     - FR-1.2: Select2 DOM Dropdown Synthesizer
     - FR-1.3: Pre-Configured Location, Contract, Package & Doctor Settings
     - FR-1.4: Pre-Commit Queue State Persistence & Page Reload Recovery
   - 3.2 Module 2: Diagnostic Results AutoFill Engine (`lab-autofill`)
     - FR-2.1: Position-Aware Tabular PDF Text Extraction
     - FR-2.2: Multi-Strategy Parameter Matching & Alias Synonym Dictionary
     - FR-2.3: Substring Collision Guarding (`isAliasMatch`)
     - FR-2.4: Dropdown Option Matching & Range Validation (`checkRange`)
     - FR-2.5: Persistent Background Refill Monitor & DOM Mutation Observer
4. [Non-Functional Requirements](#4-non-functional-requirements)
   - 4.1 Performance & Throughput Metrics
   - 4.2 Reliability & Fault Tolerance
   - 4.3 Usability & User Experience
   - 4.4 Security, Privacy & Local Storage
   - 4.5 Maintainability & MV3 Compliance
5. [System Diagram & Screenshot Placeholders](#5-system-diagram--screenshot-placeholders)
   - 5.1 Unified System Use Case Diagram
   - 5.2 Module 1 Sequence Diagram (Batch Registration Flow)
   - 5.3 Module 2 Sequence Diagram (PDF AutoFill & Background Refill Flow)
   - 5.4 State Machine Diagram (Pre-Commit Reload Recovery)
   - 5.5 User Interface Screenshots

---

## 1. Introduction

### 1.1 Purpose
This Unified Software Requirements Specification (SRS) document provides a comprehensive technical specification for the **SmartLab Automation Suite**. It covers both specialized modules:
1. **Module 1 (`lab-auto-register`)**: Batch Patient Intake & Registration Engine.
2. **Module 2 (`lab-autofill`)**: Diagnostic Results AutoFill Engine.

### 1.2 Scope
The SmartLab Automation Suite automates the complete end-to-end data pipeline of web-based Laboratory Information Management Systems (LIMS). It handles bulk front-desk patient intake (CSV parsing, title inference, Select2 modal filling, contract/package defaults) and laboratory diagnostic result entry (position-aware PDF report parsing, alias matching, background auto-refill across reloads).

### 1.3 Definitions, Acronyms, and Abbreviations
- **SRS**: Software Requirements Specification
- **MV3**: Google Chrome Extension Manifest Version 3
- **LIMS**: Laboratory Information Management System
- **DOM**: Document Object Model
- **Select2**: Searchable jQuery dropdown control replacement
- **PDF.js**: Mozilla JavaScript PDF rendering and text parsing engine
- **SRP**: Single Responsibility Principle

### 1.4 Architectural Overview
The suite uses a **Dual-Extension Modular Architecture**. Both extensions run on Chrome MV3 standards, utilizing `chrome.storage.local` for isolated state management and content script DOM injection for browser automation.

---

## 2. Overall Description

### 2.1 Product Perspective & Modular Design Justification
Rather than building a single monolithic extension, the suite is intentionally decoupled into two specialized extension modules:
- **Separation of Roles**: Front-desk receptionists perform patient intake at patient arrival (Module 1); lab technicians input test result values hours later after sample analysis (Module 2).
- **Zero UI Clutter**: Keeping modules distinct prevents UI bloat and eliminates unnecessary option toggles during high-speed laboratory operations.

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

### 2.2 Product Functions
- **Batch CSV Intake**: Converts raw `Name, Age, Gender` CSV lists into registered patient group entries.
- **Rule-Based Title Inference**: Assigns salutations (`Mr.`, `Mrs.`, `Miss`) based on gender and age rules.
- **Select2 DOM Event Synthesizer**: Interacts with searchable dropdowns using native browser DOM events.
- **Pre-Commit Reload Recovery**: Saves status to `chrome.storage.local` before form submit page reloads to prevent duplicate registration attempts.
- **Position-Aware PDF Parser**: Groups PDF text items into rows (Y-threshold) and columns (X-sorting).
- **Medical Synonym & Collision Guarding**: Matches test parameters via alias dictionaries while preventing substring collisions (e.g. `VLDL` vs `LDL`).
- **Persistent Background Refill**: Monitors DOM table re-renders via `MutationObserver` to refill empty fields automatically when saving individual tests.

### 2.3 User Classes and Operational Roles
- **Front-Desk Receptionists / Camp Coordinators**: Operators utilizing Module 1 for bulk registration during routine ops or medical camps.
- **Laboratory Technicians & Pathologists**: Technical staff utilizing Module 2 to transfer PDF report values into LIMS portal fields.

### 2.4 Operating Environment
- **Browser**: Google Chrome v102+ or Chromium-based browsers (Edge, Brave, Vivaldi).
- **Extension Standard**: Chrome Extension Manifest V3.
- **Target Host**: Web-based LIMS portals (e.g., `*://skyblue-boar-647070.hostingersite.com/*`).

---

## 3. System Features & Functional Requirements

### 3.1 Module 1: Batch Intake Engine (`lab-auto-register`)

#### FR-1.1: CSV Parsing & Title Inference
- Ingests CSV files or text area strings (`Name, Age, Gender`).
- Converts names to `UPPERCASE`.
- Applies title logic:
  - Male $\rightarrow$ `Mr.`
  - Female ($\text{Age} \ge 20$) $\rightarrow$ `Mrs.`
  - Female ($\text{Age} < 20$) $\rightarrow$ `Miss`

#### FR-1.2: Select2 DOM Dropdown Synthesizer
- Detects `.select2-container` elements next to `<select>` controls.
- Dispatches native `mousedown` events to open dropdowns.
- Types query strings into `.select2-search__field` with `input` and `keyup` keyboard events.
- Matches `.select2-results__option` items and dispatches `mouseup` and `click`.

#### FR-1.3: Settings Configuration Management
- **Lab Name**: Select dropdown supporting **48 location choices** (Default: `Glukem Biocare PVT Limit`).
- **Contract**: Options for `MRP`, `L To L - A`, `L To L - B`, `Platinum Card`.
- **Package**: Select dropdown supporting **13 profiles** (`Glukem Health Checkup`, `Allergy Profiles A-E`, `HepatitisB Marker`, `Immuno Check`, etc.).
- **Doctor**: Configurable default doctor text (`Employee Health Checkup`).

#### FR-1.4: Pre-Commit State Persistence & Reload Recovery
- Saves queue state (`patients`, `currentIndex`, `settings`, `results`, `isRunning`) to `chrome.storage.local`.
- Updates `patients[i].status = 'done'`, pushes result code, and advances `currentIndex = i + 1` **immediately BEFORE** clicking the main form Save button.
- On page reload, reads `currentIndex = i + 1` and skips retrying completed patients.

---

### 3.2 Module 2: Diagnostic Results AutoFill Engine (`lab-autofill`)

#### FR-2.1: Position-Aware Tabular PDF Text Extraction
- Uses `pdf.js` to extract text items per page.
- Groups items into rows using Y-coordinate thresholding (`Math.round(y / 3) * 3`).
- Sorts items left-to-right by X-coordinate (`a.x - b.x`).
- Reconstructs tabular report structures reliably.

#### FR-2.2: Multi-Strategy Parameter Matching
- **Attempt 1**: Exact label regex matching.
- **Attempt 2**: Shortened label matching (stripping parenthetical text like `(TT3)`).
- **Attempt 3**: Synonym alias group lookup (`SGPT/ALT`, `WBC/Leucocyte`, `HbA1c`, `LDL/HDL/VLDL`, `Indirect Bilirubin`, `Serum Creatinine`, `ESR`, `RDW`).

#### FR-2.3: Substring Collision Guarding (`isAliasMatch`)
- Enforces character prefix and suffix checks to prevent false positive substring matches:
  - Prevents `VLDL` from matching `LDL`.
  - Prevents `Erythrocytes` from matching `Erythrocyte`.
  - Prevents `T4` from matching inside `T3`.

#### FR-2.4: Medical Range Validation (`checkRange`)
- Validates extracted numerical values against standard biological ranges (e.g. Hemoglobin 4-20, Glucose 20-700, Creatinine 0.1-20).
- Triggers a `⚠️ Check` warning chip in the popup UI if values are outside expected bounds.

#### FR-2.5: Persistent Background Refill Monitor
- Stores PDF text and patient metadata (`name`, `barcodes`) in `chrome.storage.local`.
- Operates a 1000ms timer + a `MutationObserver` on `document.body`.
- Refills empty fields automatically when table rows re-render after saving individual tests.

---

## 4. Non-Functional Requirements

### 4.1 Performance & Throughput Metrics
- **Registration Intake Time**: Reduced from ~45s per patient to ~5s per patient (**$88.8\%$ speedup**).
- **Report Result AutoFill Time**: Reduced from ~3 minutes to < 2 seconds (**$98.8\%$ speedup**).
- **Memory Overhead**: $< 15 \text{ MB}$ footprint per extension instance.

### 4.2 Reliability & Fault Tolerance
- Automatic error recovery: If a duplicate patient error occurs, the system logs the exact failure reason, increments `currentIndex`, and proceeds without breaking the queue.

### 4.3 Security & Privacy
- All patient data remains strictly in browser local storage (`chrome.storage.local`). Zero data is transmitted to external servers or third-party analytics APIs.

---

## 5. System Diagram & Screenshot Placeholders

### 5.1 Unified System Use Case Diagram

```
================================================================================
|             [ PLACEHOLDER: UNIFIED SYSTEM USE CASE DIAGRAM ]                 |
|                                                                              |
|  +--------------------+                               +-------------------+  |
|  | Front-Desk Staff   | ---- (1. Upload CSV Batch) -> | Module 1: Intake  |  |
|  | (Receptionist)     | ---- (2. Select Settings) ->  | (lab-auto-reg)    |  |
|  +--------------------+                               +---------+---------+  |
|                                                                 |            |
|                                                                 v            |
|                                                       [ LIMS Web Portal ]    |
|                                                                 ^            |
|  +--------------------+                                         |            |
|  | Lab Technician     | ---- (3. Upload PDF Report) ->| Module 2: AutoFill|  |
|  | (Pathologist)      | ---- (4. Auto-Fill Results) ->| (lab-autofill)    |  |
|  +--------------------+                               +-------------------+  |
|                                                                              |
================================================================================
```

---

### 5.2 Module 1 Sequence Diagram (Batch Registration Flow)

```
================================================================================
|          [ PLACEHOLDER: MODULE 1 BATCH REGISTRATION SEQUENCE ]               |
|                                                                              |
|   Popup.js         Chrome Storage          Content.js            LIMS Portal |
|      |                   |                     |                      |      |
|      |-- Save Queue ---->|                     |                      |      |
|      |-- START_QUEUE --->|                     |                      |      |
|      |                   |                     |-- Open Modal ------->|      |
|      |                   |                     |-- Fill Inputs ------>|      |
|      |                   |<-- Save Done Index -|                      |      |
|      |                   |                     |-- Form Submit ------>|      |
|      |                   |<-- Page Reload ----------------------------|      |
|      |                   |<-- Read Next Index -|                      |      |
|      v                   v                     v                      v      |
================================================================================
```

---

### 5.3 Module 2 Sequence Diagram (PDF AutoFill & Refill Flow)

```
================================================================================
|          [ PLACEHOLDER: MODULE 2 PDF AUTOFILL SEQUENCE DIAGRAM ]             |
|                                                                              |
|   Popup.js            pdf.js Engine         Content.js           LIMS Portal |
|      |                     |                    |                     |      |
|      |-- Upload PDF ------>|                    |                     |      |
|      |<-- Tabular Text ----|                    |                     |      |
|      |-- FILL_LAB_DATA ------------------------>|                     |      |
|      |                                          |-- Match Parameters->|      |
|      |                                          |-- Fill Inputs ----->|      |
|      |                                          |<-- MutationObserver-|      |
|      |                                          |-- Auto-Refill ----->|      |
|      v                     v                    v                     v      |
================================================================================
```

---

### 5.4 State Machine Diagram (Pre-Commit Reload Recovery)

```
================================================================================
|           [ PLACEHOLDER: PRE-COMMIT STATE MACHINE DIAGRAM ]                  |
|                                                                              |
|  [ Idle ] ---> [ Reading CSV ] ---> [ Storage Init ] ---> [ Processing ]     |
|                                                                 |            |
|                                                                 v            |
|  [ Complete ] <--- [ Queue Finished ] <--- [ Storage Saved ] <--- [ Modal Done]
|                                                  |                           |
|                                                  +------> [ Page Reload ] ---+
|                                                                              |
================================================================================
```

---

### 5.5 User Interface Screenshots

```
================================================================================
|         [ PLACEHOLDER: SCREENSHOT 1 - INTAKE EXTENSION POPUP ]               |
|                                                                              |
|  (Insert screenshot of lab-auto-register popup displaying Lab Name,          |
|   Contract, Package, Doctor dropdowns, and CSV upload preview)               |
================================================================================
```

```
================================================================================
|         [ PLACEHOLDER: SCREENSHOT 2 - AUTOFILL EXTENSION POPUP ]             |
|                                                                              |
|  (Insert screenshot of lab-autofill popup displaying PDF upload,             |
|   memory state, and status chips for filled/warning/missed parameters)       |
================================================================================
```

```
================================================================================
|         [ PLACEHOLDER: SCREENSHOT 3 - TARGET LIMS PORTAL IN ACTION ]         |
|                                                                              |
|  (Insert screenshot showing the web portal form auto-filling in real time)   |
================================================================================
```
