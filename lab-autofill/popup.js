document.addEventListener('DOMContentLoaded', () => {
    const fileInput       = document.getElementById('pdf-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const startBtn        = document.getElementById('start-btn');
    const statusDiv       = document.getElementById('status');
    const uploadArea      = document.getElementById('upload-area');
    const memoryState     = document.getElementById('memory-state');
    const memoryFileName  = document.getElementById('memory-file-name');
    const clearBtn        = document.getElementById('clear-btn');
    const resultsPanel    = document.getElementById('results-panel');

    let pdfTextToInject = null;

    // ── 1. Load saved PDF from memory on open ──────────────────────────────
    chrome.storage.local.get(['savedPdfText', 'savedPdfName'], (result) => {
        if (result.savedPdfText && result.savedPdfName) {
            pdfTextToInject = result.savedPdfText;
            showMemoryState(result.savedPdfName);
            enableStartBtn();
            setStatus('PDF loaded from memory. Ready to Autofill!', 'success');
        }
    });

    // ── 2. Clear memory ────────────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['savedPdfText', 'savedPdfName', 'sessionPdfText', 'sessionPatientInfo'], () => {
            pdfTextToInject = null;
            showUploadArea();
            disableStartBtn();
            hideResults();
            setStatus('');
        });
    });

    // ── 3. File selected ───────────────────────────────────────────────────
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) { return; }

        if (file.type !== 'application/pdf') {
            setStatus('Please select a valid PDF file.', 'error');
            disableStartBtn();
            return;
        }

        fileNameDisplay.textContent = file.name;
        setStatus('Reading PDF…');
        hideResults();

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                
                // Position-aware extraction: group text items by Y-coordinate (same row)
                // and sort by X-coordinate (left to right) to preserve tabular layout
                const rows = {};
                const yThreshold = 3; // items within 3 units are on the same row
                
                for (const item of content.items) {
                    if (!item.str || item.str.trim() === '') continue;
                    const y = Math.round(item.transform[5] / yThreshold) * yThreshold;
                    const x = item.transform[4];
                    if (!rows[y]) rows[y] = [];
                    rows[y].push({ x, text: item.str });
                }
                
                // Sort rows top-to-bottom (higher Y = higher on page in PDF coords)
                const sortedYs = Object.keys(rows).map(Number).sort((a, b) => b - a);
                
                for (const y of sortedYs) {
                    // Sort items left-to-right within each row
                    rows[y].sort((a, b) => a.x - b.x);
                    const line = rows[y].map(item => item.text).join(' ');
                    fullText += line + '\n';
                }
            }

            setStatus('Processing…');
            const labData = extractLabData(fullText);
            console.log('[AutoFill] Extracted PDF text:\n', labData);

            if (!labData || labData.trim().length === 0) {
                throw new Error('Could not extract any text from this PDF.');
            }

            pdfTextToInject = labData;

            chrome.storage.local.set({ savedPdfText: labData, savedPdfName: file.name }, () => {
                showMemoryState(file.name);
                enableStartBtn();
                setStatus('PDF ready. Click Start Autofill!', 'success');
            });

        } catch (err) {
            console.error(err);
            setStatus('Error: ' + err.message, 'error');
            disableStartBtn();
        }
    });

    // ── 4. Start Autofill ──────────────────────────────────────────────────
    startBtn.addEventListener('click', async () => {
        if (!pdfTextToInject) return;

        startBtn.disabled = true;
        startBtn.textContent = 'Filling…';
        setStatus('Working…');
        hideResults();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('Could not find active tab.');

            const patientInfo = extractPatientInfo(pdfTextToInject);
            console.log("Saving patient session for background refill:", patientInfo);

            // Save background session and retain PDF in memory
            chrome.storage.local.set({
                sessionPdfText: pdfTextToInject,
                sessionPatientInfo: patientInfo,
                savedPdfText: pdfTextToInject
            }, () => {
                // Trigger dynamic autofill on page
                chrome.tabs.sendMessage(tab.id, { action: 'FILL_LAB_DATA', data: pdfTextToInject }, (response) => {
                    startBtn.disabled = false;
                    startBtn.textContent = 'Start Autofill';

                    if (chrome.runtime.lastError) {
                        setStatus('Error: Refresh the lab website and try again.', 'error');
                        return;
                    }

                    if (response && response.status === 'success') {
                        renderResults(response.details);
                        setStatus('Autofill successful! PDF saved in memory for other tabs.', 'success');
                    } else {
                        setStatus('Error: ' + (response?.message || 'Unknown error'), 'error');
                    }
                });
            });

        } catch (err) {
            console.error(err);
            setStatus('Error: ' + err.message, 'error');
            startBtn.disabled = false;
            startBtn.textContent = 'Start Autofill';
        }
    });

    // ── Helpers ────────────────────────────────────────────────────────────
    function extractPatientInfo(text) {
        let name = null;
        const nameMatch = text.match(/Name\s*:\s*([^:\n]+)/i);
        if (nameMatch) {
            name = nameMatch[1].replace(/Barcode.*/i, '').trim();
        }
        
        const barcodes = [];
        const barcodeMatches = text.matchAll(/Barcode\s*No\s*:\s*(\d+)/gi);
        for (const match of barcodeMatches) {
            if (match[1] && !barcodes.includes(match[1])) {
                barcodes.push(match[1]);
            }
        }
        
        return { name, barcodes };
    }

    // ── Results Renderer ───────────────────────────────────────────────────
    function renderResults(details) {
        const filled   = details.filter(d => d.status === 'filled');
        const warnings = details.filter(d => d.status === 'warning');
        const missed   = details.filter(d => d.status === 'missed');

        // Summary chips
        document.getElementById('chip-filled').textContent = `✅ Filled ${filled.length + warnings.length}`;

        const warnChip = document.getElementById('chip-warn');
        if (warnings.length > 0) {
            warnChip.textContent = `⚠️ Check ${warnings.length}`;
            warnChip.style.display = '';
        } else {
            warnChip.style.display = 'none';
        }

        const missedChip = document.getElementById('chip-missed');
        if (missed.length > 0) {
            missedChip.textContent = `❌ Missed ${missed.length}`;
            missedChip.style.display = '';
        } else {
            missedChip.style.display = 'none';
        }

        // Warnings section
        const warnSection = document.getElementById('section-warnings');
        const warnList    = document.getElementById('list-warnings');
        warnList.innerHTML = '';
        if (warnings.length > 0) {
            warnings.forEach(d => {
                warnList.insertAdjacentHTML('beforeend', `
                    <div class="missed-item warn-item">
                        <span class="missed-icon">⚠️</span>
                        <div>
                            <div class="missed-label">${escapeHTML(d.label)}</div>
                            <div class="missed-reason">${escapeHTML(d.reason)}</div>
                        </div>
                    </div>`);
            });
            warnSection.style.display = '';
        } else {
            warnSection.style.display = 'none';
        }

        // Missed section
        const missedSection = document.getElementById('section-missed');
        const missedList    = document.getElementById('list-missed');
        missedList.innerHTML = '';
        if (missed.length > 0) {
            missed.forEach(d => {
                missedList.insertAdjacentHTML('beforeend', `
                    <div class="missed-item">
                        <span class="missed-icon">❌</span>
                        <div>
                            <div class="missed-label">${escapeHTML(d.label)}</div>
                            <div class="missed-reason">Not found in the PDF</div>
                        </div>
                    </div>`);
            });
            missedSection.style.display = '';
        } else {
            missedSection.style.display = 'none';
        }

        // All good message
        const allGood = document.getElementById('all-good');
        allGood.style.display = (warnings.length === 0 && missed.length === 0) ? '' : 'none';

        resultsPanel.style.display = '';
    }

    function showMemoryState(name) {
        uploadArea.style.display = 'none';
        memoryState.style.display = 'block';
        memoryFileName.textContent = name;
    }

    function showUploadArea() {
        fileInput.value = '';
        fileNameDisplay.textContent = 'No file chosen';
        uploadArea.style.display = 'flex';
        memoryState.style.display = 'none';
    }

    function enableStartBtn() {
        startBtn.disabled = false;
        startBtn.classList.remove('disabled');
    }

    function disableStartBtn() {
        startBtn.disabled = true;
        startBtn.classList.add('disabled');
    }

    function setStatus(text, type = '') {
        statusDiv.textContent = text;
        statusDiv.className = 'status' + (type ? ' ' + type : '');
    }

    function hideResults() {
        resultsPanel.style.display = 'none';
    }

    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
