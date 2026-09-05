document.addEventListener('DOMContentLoaded', () => {
    const fileInput     = document.getElementById('csv-upload');
    const fileNameDiv   = document.getElementById('file-name');
    const csvText       = document.getElementById('csv-text');
    const startBtn      = document.getElementById('start-btn');
    const stopBtn       = document.getElementById('stop-btn');
    const statusDiv     = document.getElementById('status');
    const clearBtn      = document.getElementById('clear-btn');
    const previewPanel  = document.getElementById('patient-preview');
    const patientCountEl= document.getElementById('patient-count');
    const patientListEl = document.getElementById('patient-list');
    const progressContainer = document.getElementById('progress-container');
    const progressFill  = document.getElementById('progress-fill');
    const progressText  = document.getElementById('progress-text');
    const resultsPanel  = document.getElementById('results-panel');
    const chipFilled    = document.getElementById('chip-filled');
    const chipMissed    = document.getElementById('chip-missed');
    const resultsList   = document.getElementById('results-list');

    // Settings
    const settingLab      = document.getElementById('setting-lab');
    const settingContract = document.getElementById('setting-contract');
    const settingPackage  = document.getElementById('setting-package');
    const settingDoctor   = document.getElementById('setting-doctor');

    let patients = [];
    let isRunning = false;

    // ── Load saved settings ──
    chrome.storage.local.get(['reg_lab', 'reg_contract', 'reg_package', 'reg_doctor'], (result) => {
        if (result.reg_lab) settingLab.value = result.reg_lab;
        if (result.reg_contract) settingContract.value = result.reg_contract;
        if (result.reg_package) settingPackage.value = result.reg_package;
        if (result.reg_doctor) settingDoctor.value = result.reg_doctor;
    });

    // Save settings on change
    settingLab.addEventListener('change', () => {
        chrome.storage.local.set({ reg_lab: settingLab.value });
    });
    settingContract.addEventListener('change', () => {
        chrome.storage.local.set({ reg_contract: settingContract.value });
    });
    settingPackage.addEventListener('change', () => {
        chrome.storage.local.set({ reg_package: settingPackage.value });
    });
    settingDoctor.addEventListener('input', () => {
        chrome.storage.local.set({ reg_doctor: settingDoctor.value });
    });

    // ── CSV File Upload ──
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        fileNameDiv.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (ev) => {
            csvText.value = ev.target.result;
            parsePatients();
        };
        reader.readAsText(file);
    });

    // ── Parse on text change ──
    csvText.addEventListener('input', () => parsePatients());

    // ── Clear ──
    clearBtn.addEventListener('click', () => {
        csvText.value = '';
        fileInput.value = '';
        fileNameDiv.textContent = 'No file chosen';
        patients = [];
        previewPanel.style.display = 'none';
        resultsPanel.style.display = 'none';
        progressContainer.style.display = 'none';
        disableStart();
        setStatus('');
    });

    // ── Parse CSV text into patient objects ──
    function parsePatients() {
        const text = csvText.value.trim();
        if (!text) {
            patients = [];
            previewPanel.style.display = 'none';
            disableStart();
            return;
        }

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        patients = [];

        for (const line of lines) {
            // Skip header row
            if (line.toLowerCase().startsWith('name')) continue;

            const parts = line.split(',').map(p => p.trim());
            if (parts.length < 2) continue;

            const name = parts[0].toUpperCase();
            const age = parseInt(parts[1], 10);
            const genderRaw = (parts[2] || 'F').toUpperCase().trim();
            const gender = genderRaw.startsWith('M') ? 'Male' : 'Female';

            // Title logic: Male → Mr., Female ≥ 20 → Mrs., Female < 20 → Miss
            let title;
            if (gender === 'Male') {
                title = 'Mr.';
            } else {
                title = age >= 20 ? 'Mrs.' : 'Miss';
            }

            patients.push({ name, age, gender, title, status: 'pending' });
        }

        renderPreview();
        if (patients.length > 0) {
            enableStart();
            setStatus(`${patients.length} patient(s) ready`, 'success');
        } else {
            disableStart();
            setStatus('No valid rows found. Use: Name, Age, Gender', 'error');
        }
    }

    function renderPreview() {
        if (patients.length === 0) {
            previewPanel.style.display = 'none';
            return;
        }
        previewPanel.style.display = '';
        patientCountEl.textContent = `${patients.length} patient${patients.length > 1 ? 's' : ''}`;

        patientListEl.innerHTML = patients.map((p, i) => {
            const statusIcon = p.status === 'done' ? '✅' : p.status === 'error' ? '❌' : p.status === 'running' ? '⏳' : '⬜';
            return `<div class="patient-item">
                <span class="pi-index">#${i + 1}</span>
                <span class="pi-name">${escapeHTML(p.name)}</span>
                <span class="pi-detail">${p.title} ${p.age}Y ${p.gender[0]}</span>
                <span class="pi-status">${statusIcon}</span>
            </div>`;
        }).join('');
    }

    // ── START REGISTRATION ──
    startBtn.addEventListener('click', async () => {
        if (isRunning || patients.length === 0) return;
        isRunning = true;

        startBtn.style.display = 'none';
        stopBtn.style.display = '';
        progressContainer.style.display = '';
        resultsPanel.style.display = 'none';

        const labName  = settingLab.value;
        const contract = settingContract.value;
        const packageName = settingPackage.value;
        const doctorName  = settingDoctor.value;
        const results = [];

        // Save progress session to storage in case tab reloads/navigates
        await new Promise(r => chrome.storage.local.set({
            reg_status: {
                patients,
                currentIndex: 0,
                settings: { labName, contract, packageName, doctorName },
                results,
                isRunning: true
            }
        }, r));

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab found');

            // Send message to start the queue
            chrome.tabs.sendMessage(tab.id, { action: 'START_QUEUE' });
        } catch (err) {
            setStatus('Error: Please refresh the page and try again.', 'error');
            isRunning = false;
            startBtn.style.display = '';
            stopBtn.style.display = 'none';
        }
    });

    // Check status periodically while popup is open to update UI
    function startStatusPoller() {
        setInterval(() => {
            chrome.storage.local.get(['reg_status'], (result) => {
                if (result.reg_status && result.reg_status.isRunning) {
                    const status = result.reg_status;
                    patients = status.patients;
                    isRunning = status.isRunning;
                    
                    if (isRunning) {
                        startBtn.style.display = 'none';
                        stopBtn.style.display = '';
                        progressContainer.style.display = '';
                    } else {
                        startBtn.style.display = '';
                        stopBtn.style.display = 'none';
                    }
                    
                    renderPreview();
                    updateProgress(status.currentIndex, patients.length);
                    
                    if (status.currentIndex < patients.length) {
                        setStatus(`Registering ${patients[status.currentIndex].name}...`);
                    } else {
                        setStatus(`Done! ${status.results.filter(r => r.success).length} registered.`, 'success');
                        renderResults(status.results);
                        chrome.storage.local.remove(['reg_status']);
                    }
                }
            });
        }, 1000);
    }
    startStatusPoller();

    // ── STOP ──
    stopBtn.addEventListener('click', () => {
        isRunning = false;
        stopBtn.style.display = 'none';
        startBtn.style.display = '';
        setStatus('Stopped by user.', 'error');
    });

    // ── Helpers ──
    function enableStart() {
        startBtn.disabled = false;
        startBtn.classList.remove('disabled');
    }
    function disableStart() {
        startBtn.disabled = true;
        startBtn.classList.add('disabled');
    }
    function setStatus(text, type = '') {
        statusDiv.textContent = text;
        statusDiv.className = 'status' + (type ? ' ' + type : '');
    }
    function updateProgress(current, total) {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        progressFill.style.width = pct + '%';
        progressText.textContent = `${current} / ${total}`;
    }
    function renderResults(results) {
        const success = results.filter(r => r.success);
        const failed  = results.filter(r => !r.success);

        chipFilled.textContent = `✅ Registered ${success.length}`;
        if (failed.length > 0) {
            chipMissed.textContent = `❌ Failed ${failed.length}`;
            chipMissed.style.display = '';
        } else {
            chipMissed.style.display = 'none';
        }

        resultsList.innerHTML = results.map(r => {
            if (r.success) {
                return `<div class="result-item">
                    <span class="ri-icon">✅</span>
                    <span class="ri-name">${escapeHTML(r.name)}</span>
                    <span class="ri-detail">${r.code ? 'Code: ' + r.code : 'Saved'}</span>
                </div>`;
            } else {
                return `<div class="result-item failed">
                    <span class="ri-icon">❌</span>
                    <span class="ri-name">${escapeHTML(r.name)}</span>
                    <span class="ri-detail">${escapeHTML(r.error)}</span>
                </div>`;
            }
        }).join('');

        resultsPanel.style.display = '';
    }
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
