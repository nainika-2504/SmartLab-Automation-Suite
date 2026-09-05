// ═══════════════════════════════════════════════════════════════════════════
// Lab Auto Register — Content Script v2
// Runs on: https://skyblue-boar-647070.hostingersite.com/*
// Uses PURE DOM clicks on Select2 UI elements — no jQuery needed
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_QUEUE') {
        console.log('[AutoReg] START_QUEUE received');
        runQueue();
        sendResponse({ status: "started" });
    }
});

// Auto-run queue on page load if one was in progress
setTimeout(() => {
    chrome.storage.local.get(['reg_status'], (result) => {
        if (result.reg_status && result.reg_status.isRunning) {
            console.log('[AutoReg] Resuming queue on page load...');
            // If not on create page, navigate there first
            if (!window.location.href.includes('/admin/groups/create')) {
                console.log('[AutoReg] Redirecting to create page...');
                window.location.href = window.location.origin + '/admin/groups/create';
                return; // Will re-trigger on next page load
            }
            runQueue();
        }
    });
}, 2000); // Wait 2s for page to fully load

let isQueueExecuting = false;

async function runQueue() {
    if (isQueueExecuting) return;
    isQueueExecuting = true;

    try {
        const result = await chromeStorageGet('reg_status');
        if (!result || !result.isRunning) return;

        const status = result;
        const i = status.currentIndex;
        const patients = status.patients;
        const settings = status.settings;
        const results = status.results;

        if (i >= patients.length) {
            status.isRunning = false;
            await chromeStorageSet('reg_status', status);
            console.log('[AutoReg] ✅ All patients processed!');
            return;
        }

        // If patient i was ALREADY processed (done or error), move directly to next
        if (patients[i].status === 'done' || patients[i].status === 'error') {
            console.log(`[AutoReg] Patient #${i + 1} (${patients[i].name}) already marked ${patients[i].status}, moving to index ${i + 1}`);
            status.currentIndex = i + 1;
            await chromeStorageSet('reg_status', status);
            isQueueExecuting = false;
            runQueue();
            return;
        }

        patients[i].status = 'running';
        await chromeStorageSet('reg_status', status);

        try {
            await registerPatient(patients[i], settings, status, i);
        } catch (err) {
            console.error('[AutoReg] Registration error for patient #', i + 1, err);
            const latestStatus = (await chromeStorageGet('reg_status')) || status;
            latestStatus.patients[i].status = 'error';
            // Only add to results if not already present
            if (!latestStatus.results.some(r => r.name === patients[i].name)) {
                latestStatus.results.push({ name: patients[i].name, success: false, error: err.message });
            }
            latestStatus.currentIndex = i + 1;
            await chromeStorageSet('reg_status', latestStatus);
        }

        // Check if there are remaining patients and trigger navigation to create page if still on page
        const checkStatus = await chromeStorageGet('reg_status');
        if (checkStatus && checkStatus.isRunning && checkStatus.currentIndex < checkStatus.patients.length) {
            console.log(`[AutoReg] Moving to next patient (${checkStatus.currentIndex}/${checkStatus.patients.length})...`);
            await sleep(500);
            if (!window.location.href.includes('/admin/groups/create')) {
                window.location.href = window.location.origin + '/admin/groups/create';
            } else {
                // If already on create page (e.g. main save stayed on page), trigger next queue step
                isQueueExecuting = false;
                runQueue();
            }
        }
    } finally {
        isQueueExecuting = false;
    }
}

// ── Main registration flow ──────────────────────────────────────────────

async function registerPatient(patient, settings, currentStatus, patientIndex) {
    console.log(`[AutoReg] ▶ Starting: ${patient.name}`);

    // Wait for the page to be fully ready (Not Listed button must exist)
    await waitForElement('button.add_patient', 8000);
    await sleep(500);

    // Step 1: Click "Not Listed" to open Create Patient modal
    const notListedBtn = document.querySelector('button.add_patient');
    if (!notListedBtn) throw new Error('Cannot find "Not Listed" button');
    notListedBtn.click();
    console.log('[AutoReg] Clicked "Not Listed"');

    // Wait for modal
    await waitForElement('.modal.show, .modal.in, .modal[style*="display: block"]', 5000);
    await sleep(600);

    // Step 2: Fill form fields
    // Title/Salutation — plain <select>
    const salutation = document.querySelector('select#salutation');
    if (salutation) {
        setNativeSelect(salutation, patient.title);
        console.log(`[AutoReg] Title: ${patient.title}`);
    }

    // Name
    const nameInput = document.querySelector('input#create_name');
    if (nameInput) {
        setNativeInput(nameInput, patient.name);
        console.log(`[AutoReg] Name: ${patient.name}`);
    }

    // Gender
    const genderSelect = document.querySelector('select#create_gender');
    if (genderSelect) {
        setNativeSelect(genderSelect, patient.gender);
        console.log(`[AutoReg] Gender: ${patient.gender}`);
    }

    // Age
    const ageInput = document.querySelector('input#create_age');
    if (ageInput) {
        setNativeInput(ageInput, String(patient.age));
        console.log(`[AutoReg] Age: ${patient.age}`);
    }

    // Age Unit
    const ageUnit = document.querySelector('select#create_age_unit');
    if (ageUnit) {
        setNativeSelect(ageUnit, 'Year');
        if (!ageUnit.value) setNativeSelect(ageUnit, 'Years');
        console.log(`[AutoReg] Age unit: ${ageUnit.value}`);
    }

    await sleep(300);

    // Contract — This is a Select2 dropdown. Click the rendered UI element.
    const contractSelect = document.querySelector('select#patient_contract_id');
    if (contractSelect) {
        await clickSelect2Option(contractSelect, settings.contract);
        console.log(`[AutoReg] Contract: ${settings.contract}`);
    } else {
        console.warn('[AutoReg] Contract select not found by ID, trying broader search...');
        const modalSelects = document.querySelectorAll('.modal select');
        for (const sel of modalSelects) {
            const hasContract = Array.from(sel.options).some(o => o.textContent.trim() === 'MRP');
            if (hasContract) {
                await clickSelect2Option(sel, settings.contract);
                console.log(`[AutoReg] Contract (fallback): ${settings.contract}`);
                break;
            }
        }
    }

    await sleep(400);

    // Step 3: Click Save on modal
    let modalSaveBtn = null;
    const modalEl = document.querySelector('.modal.show, .modal.in, .modal[style*="display: block"]');
    if (modalEl) {
        const allBtns = modalEl.querySelectorAll('button');
        for (const btn of allBtns) {
            const txt = btn.textContent.trim().toLowerCase();
            if (txt === 'save' || txt.includes('save')) {
                modalSaveBtn = btn;
                break;
            }
        }
        if (!modalSaveBtn) {
            modalSaveBtn = modalEl.querySelector('button.btn-primary');
        }
    }

    if (!modalSaveBtn) throw new Error('Cannot find modal Save button');
    modalSaveBtn.click();
    console.log('[AutoReg] Clicked modal Save');

    // Wait for modal to process
    await sleep(2000);

    // Check if modal is still showing (validation error?)
    const stillOpenModal = document.querySelector('.modal.show, .modal.in, .modal[style*="display: block"]');
    if (stillOpenModal) {
        const errors = stillOpenModal.querySelectorAll('.text-danger, .invalid-feedback, .alert-danger');
        if (errors.length > 0) {
            const errorText = Array.from(errors).map(e => e.textContent.trim()).filter(t => t).join('; ');
            throw new Error('Modal validation: ' + errorText);
        }
        await sleep(1500);
    }

    // Extract patient code
    let patientCode = '';
    const codeContainer = document.querySelector('#select2-code-container');
    if (codeContainer) {
        patientCode = codeContainer.textContent.trim();
    }
    console.log(`[AutoReg] Patient saved in modal. Code: ${patientCode}`);

    // Step 4: Select Doctor
    const doctorSelect = document.querySelector('select#doctor, select[name="doctor_id"]');
    const targetDoctor = settings.doctorName || 'Employee Health Checkup';
    if (doctorSelect) {
        await clickSelect2Option(doctorSelect, targetDoctor);
        console.log(`[AutoReg] Doctor: ${targetDoctor}`);
    }
    await sleep(400);

    // Step 5: Select Package
    const packageSelect = document.querySelector('select#select_package, select[name="package_id"]');
    if (packageSelect && settings.packageName) {
        await clickSelect2Option(packageSelect, settings.packageName);
        console.log(`[AutoReg] Package: ${settings.packageName}`);
    }
    await sleep(400);

    // ── CRITICAL FIX: SAVE DONE STATUS & ADVANCE INDEX BEFORE FORM SUBMISSION RELOAD ──
    const latestStatus = (await chromeStorageGet('reg_status')) || currentStatus;
    latestStatus.patients[patientIndex].status = 'done';
    if (!latestStatus.results.some(r => r.name === patient.name)) {
        latestStatus.results.push({ name: patient.name, success: true, code: patientCode });
    }
    latestStatus.currentIndex = patientIndex + 1;
    await chromeStorageSet('reg_status', latestStatus);
    console.log(`[AutoReg] ✅ Patient ${patient.name} marked DONE! Storage updated for next index (${patientIndex + 1}).`);

    // Step 6: Click main Save button
    const mainSaveBtn = findMainSaveButton();
    if (!mainSaveBtn) throw new Error('Cannot find main Save button');
    mainSaveBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(200);
    mainSaveBtn.click();
    console.log('[AutoReg] Clicked main Save button');

    // Wait for form submit navigation / reload
    await sleep(2500);
    return { status: 'success', code: patientCode };
}


// ═══════════════════════════════════════════════════════════════════════════
// Select2 Interaction — PURE DOM CLICKS (no jQuery required)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Click a Select2 dropdown and pick the matching option by text.
 * Works by:
 * 1. Finding the Select2 container rendered next to the <select> element
 * 2. Clicking it to open the dropdown
 * 3. Typing in the search box if present
 * 4. Clicking the matching result
 */
async function clickSelect2Option(selectEl, targetText) {
    // Find the Select2 container — it's usually the next sibling span.select2-container
    let s2container = selectEl.nextElementSibling;
    if (!s2container || !s2container.classList.contains('select2-container')) {
        // Try parent's children
        s2container = selectEl.parentElement?.querySelector('.select2-container');
    }
    if (!s2container || !s2container.classList.contains('select2-container')) {
        // Last resort: just set the native select value
        console.warn('[AutoReg] No Select2 container found, using native set');
        setNativeSelect(selectEl, targetText);
        return;
    }

    // Click the Select2 container to open dropdown
    const selection = s2container.querySelector('.select2-selection');
    if (selection) {
        selection.click();
        // Also try mousedown which some Select2 versions need
        selection.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    } else {
        s2container.click();
    }
    console.log(`[AutoReg] Opened Select2 dropdown for: ${targetText}`);
    await sleep(400);

    // Type in search box if it exists
    const searchInput = document.querySelector('.select2-search__field');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        // Type character by character for better compatibility
        const searchChars = targetText.substring(0, 4); // First 4 chars
        for (const char of searchChars) {
            searchInput.value += char;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char }));
            await sleep(50);
        }
        await sleep(600);
    }

    // Find and click the matching result
    const resultItems = document.querySelectorAll('.select2-results__option');
    let found = false;
    for (const item of resultItems) {
        const itemText = item.textContent.trim().toLowerCase();
        const target = targetText.toLowerCase();
        if (itemText === target || itemText.includes(target) || target.includes(itemText)) {
            // Don't click "Searching..." or "Loading..." items
            if (item.classList.contains('select2-results__option--disabled') || 
                itemText.includes('searching') || itemText.includes('loading')) {
                continue;
            }
            item.click();
            // Also dispatch mouseup for Select2 compatibility
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            found = true;
            console.log(`[AutoReg] Selected: "${item.textContent.trim()}"`);
            break;
        }
    }

    if (!found) {
        console.warn(`[AutoReg] No Select2 match for "${targetText}", trying native fallback`);
        // Close dropdown by pressing Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(200);
        setNativeSelect(selectEl, targetText);
    }

    await sleep(200);
}


// ═══════════════════════════════════════════════════════════════════════════
// DOM Utility Functions  
// ═══════════════════════════════════════════════════════════════════════════

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitFor(conditionFn, timeout = 5000, interval = 100) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (conditionFn()) { resolve(); return; }
            if (Date.now() - startTime > timeout) { reject(new Error('Timed out waiting for condition')); return; }
            setTimeout(check, interval);
        };
        check();
    });
}

function waitForElement(selector, timeout = 5000) {
    return waitFor(() => document.querySelector(selector) !== null, timeout);
}

// Set value on a native <input>
function setNativeInput(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
        nativeSetter.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
}

// Set value on a native <select> and dispatch change
function setNativeSelect(select, valueOrText) {
    const matchByText = Array.from(select.options).find(opt =>
        opt.textContent.trim().toLowerCase() === valueOrText.toLowerCase()
    );
    if (matchByText) {
        select.value = matchByText.value;
    } else {
        const matchByValue = Array.from(select.options).find(opt =>
            opt.value.toLowerCase() === valueOrText.toLowerCase()
        );
        if (matchByValue) {
            select.value = matchByValue.value;
        }
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

// Find the main Save button on the registration form (not inside modal)
function findMainSaveButton() {
    // Look for Save buttons that are NOT inside a modal
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
        if (btn.closest('.modal')) continue; // Skip modal buttons
        const txt = btn.textContent.trim().toLowerCase();
        if (txt === 'save' || txt.includes('save')) {
            return btn;
        }
    }
    // Fallback: submit buttons not in modal
    for (const btn of allBtns) {
        if (btn.closest('.modal')) continue;
        if (btn.classList.contains('btn-primary') && btn.type !== 'button') {
            return btn;
        }
    }
    return null;
}

// Chrome storage helpers (promisified)
function chromeStorageGet(key) {
    return new Promise(resolve => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || null);
        });
    });
}

function chromeStorageSet(key, value) {
    return new Promise(resolve => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}
