document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const views = document.querySelectorAll('.view');

    // Custom Select
    const modeTrigger = document.getElementById('mode-trigger');
    const modeOptions = document.getElementById('mode-options');
    const customSelect = document.getElementById('custom-mode-select');
    const modeOptionsList = document.querySelectorAll('.select-option');

    const copyBtn = document.getElementById('copy-btn');
    const scanBtn = document.getElementById('scan-btn');
    const copyPreviewBtn = document.getElementById('copy-preview-btn');

    const settingsToggle = document.getElementById('settings-toggle');
    const optionsPanel = document.getElementById('options-panel');
    const previewBox = document.getElementById('preview-box');
    const statusBar = document.getElementById('status-bar');
    const statsBadge = document.getElementById('stats-badge');
    const previewSearch = document.getElementById('preview-search');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportMdBtn = document.getElementById('export-md-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const clearResultsBtn = document.getElementById('clear-results-btn');
    const popGhostBtn = document.getElementById('pop-ghost-btn');

    // Options
    const optDedup = document.getElementById('opt-dedup');
    const optMerge = document.getElementById('opt-merge');
    const optTiny = document.getElementById('opt-tiny');
    const optTransparency = document.getElementById('opt-transparency');
    const optAutoCopy = document.getElementById('opt-autocopy');
    const optStudy = document.getElementById('opt-study');
    const optNumbering = document.getElementById('opt-numbering');

    // State
    let currentMode = 'full';
    let currentData = [];

    // --- Initialization ---

    // Ghost Mode Detection
    const urlParams = new URLSearchParams(window.location.search);
    const isGhostMode = urlParams.get('ghost') === 'true';
    if (isGhostMode) {
        document.body.classList.add('transparent-mode');
        document.querySelectorAll('.ghost-hidden').forEach(el => el.style.display = 'none');
        // Compact height for Ghost iframe
        const app = document.getElementById('app');
        if (app) {
            app.style.height = '100vh';
            app.style.minHeight = '100vh';
        }
    }

    // Mini-Bar Mode Detection (Only allowed in Ghost/Transparency window)
    const checkMiniBar = () => {
        if (isGhostMode && window.innerHeight < 100) {
            document.body.classList.add('mini-bar-mode');
        } else {
            document.body.classList.remove('mini-bar-mode');
        }
    };
    window.addEventListener('resize', checkMiniBar);
    checkMiniBar();

    // Auto-Theme Detection
    initTheme();

    async function initTheme() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id || tab.url.startsWith('chrome://')) return;

            const response = await sendMessageToTab(tab.id, {
                action: 'extract',
                mode: 'full',
                options: { format: 'json', limit: 1 }
            });

            if (response && response.theme) {
                if (response.theme === 'light') document.body.classList.add('light');
                else document.body.classList.remove('light');
            }
        } catch (e) {
            console.log('Context check failed (normal if not on webpage)');
        }
    }

    // --- Event Listeners ---

    // Custom Dropdown Logic
    if (modeTrigger && customSelect) {
        modeTrigger.addEventListener('click', () => {
            customSelect.classList.toggle('open');
        });
    }

    if (modeOptionsList) {
        modeOptionsList.forEach(opt => {
            opt.addEventListener('click', () => {
                currentMode = opt.dataset.value;
                if (modeTrigger) modeTrigger.textContent = opt.textContent;

                modeOptionsList.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                if (customSelect) customSelect.classList.remove('open');

                updateStatus(`Mode: ${opt.textContent}`);
            });
        });
    }

    window.addEventListener('click', (e) => {
        if (customSelect && !customSelect.contains(e.target)) {
            customSelect.classList.remove('open');
        }
    });

    if (optAutoCopy) {
        optAutoCopy.addEventListener('change', (e) => {
            localStorage.setItem('grabbr_autocopy', e.target.checked);
        });
    }

    if (clearResultsBtn) {
        clearResultsBtn.addEventListener('click', () => {
            currentData = [];
            if (previewBox) previewBox.value = '';
            if (previewSearch) previewSearch.value = '';
            updateStats(0);
            if (statsBadge) statsBadge.style.display = 'none';
            updateStatus('Results cleared');
        });
    }

    if (previewSearch) {
        previewSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (!currentData.length) return;

            const filtered = currentData.filter(item => {
                const textMatch = (item.text || '').toLowerCase().includes(query);
                const questionMatch = (item.question || '').toLowerCase().includes(query);
                const choicesMatch = (item.choices || []).some(choiceObj => {
                    const text = typeof choiceObj === 'string' ? choiceObj : choiceObj.text;
                    return text.toLowerCase().includes(query);
                });
                return textMatch || questionMatch || choicesMatch;
            });
            renderPreview(filtered);
        });
    }

    if (popGhostBtn) {
        popGhostBtn.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab || !tab.id) return;
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleGhostMode', enabled: true });
                window.close();
            } catch (err) {
                updateStatus('Reload page first', 'error');
            }
        });
    }

    if (exportMdBtn) {
        exportMdBtn.addEventListener('click', () => {
            if (!currentData.length) {
                updateStatus('Nothing to export', 'error');
                return;
            }
            downloadMarkdown(currentData);
        });
    }

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            if (!currentData.length) {
                updateStatus('Nothing to export', 'error');
                return;
            }
            downloadJSON(currentData);
        });
    }

    if (optStudy) {
        optStudy.addEventListener('change', () => {
            renderPreview(currentData);
        });
    }

    if (optNumbering) {
        optNumbering.addEventListener('change', () => {
            renderPreview(currentData);
            updateStatus('Numbering updated');
        });
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (!currentData.length) {
                updateStatus('Nothing to export', 'error');
                return;
            }
            downloadCSV(currentData);
        });
    }

    if (optTransparency) {
        optTransparency.addEventListener('change', async (e) => {
            const isChecked = e.target.checked;
            localStorage.setItem('grabbr_transparent', isChecked ? 'true' : 'false');

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) return;

            if (isChecked) {
                // Automatically Pop Out into Ghost Mode for TRUE transparency
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleGhostMode', enabled: true });
                if (!isGhostMode) window.close(); // Only close real popup
            } else {
                document.body.classList.remove('transparent-mode');
                // If we are currently in Ghost Mode and user turns it off, remove the ghost
                if (isGhostMode) {
                    await chrome.tabs.sendMessage(tab.id, { action: 'toggleGhostMode', enabled: false });
                }
            }
        });
    }

    if (tabTriggers) {
        tabTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                tabTriggers.forEach(t => t.classList.remove('active'));
                views.forEach(v => {
                    v.classList.remove('visible');
                    v.classList.add('hidden');
                });

                trigger.classList.add('active');
                const targetView = document.getElementById(`view-${trigger.dataset.tab}`);
                if (targetView) {
                    targetView.classList.remove('hidden');
                    targetView.classList.add('visible');
                }
            });
        });
    }

    if (settingsToggle && optionsPanel) {
        settingsToggle.addEventListener('click', () => {
            optionsPanel.scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            updateStatus('Scanning...', 'loading');

            const response = await triggerExtraction(true);
            if (response && response.data) {
                currentData = response.data;
                renderPreview(response.data);
                updateStats(response.data.length);

                if (response.theme === 'light') document.body.classList.add('light');
                else document.body.classList.remove('light');

                if (optAutoCopy && optAutoCopy.checked) {
                    const textResponse = await triggerExtraction(false);
                    if (textResponse && textResponse.data) {
                        await copyTextToClipboard(textResponse.data, scanBtn);
                    }
                }

                const previewTabBtn = document.querySelector('[data-tab="preview"]');
                if (previewTabBtn && !document.body.classList.contains('mini-bar-mode')) {
                    previewTabBtn.click();
                }
                updateStatus('Scan complete', 'success');

                // Mini-Bar specific behavior: Always auto-copy so user can "just paste"
                if (document.body.classList.contains('mini-bar-mode')) {
                    const textResponse = await triggerExtraction(false);
                    if (textResponse && textResponse.data) {
                        await copyTextToClipboard(textResponse.data, scanBtn);

                        // "Done Scan" feedback replaces "Copied!" for the Mini-Bar vibe
                        const originalHTML = scanBtn.innerHTML;
                        scanBtn.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Done Scan
                        `;
                        setTimeout(() => { scanBtn.innerHTML = originalHTML; }, 2000);
                    }
                }
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            updateStatus('Extracting...', 'loading');
            const response = await triggerExtraction(false);
            if (response) {
                await copyTextToClipboard(response.data || '', copyBtn);
            } else {
                updateStatus('Extraction failed', 'error');
            }
        });
    }

    if (copyPreviewBtn) {
        copyPreviewBtn.addEventListener('click', async () => {
            await copyTextToClipboard(previewBox ? previewBox.value : '', copyPreviewBtn);
        });
    }

    // --- Helpers ---

    function renderPreview(items) {
        if (!previewBox) return;
        let output = '';
        let qCount = 0;

        for (const item of items) {
            if (item.type === 'question') {
                qCount++;
                if (output) output += '\n\n';
                if (item.imageDesc) output += `${item.imageDesc}\n`;

                const prefix = (optNumbering && optNumbering.checked) ? `${qCount}. ` : '';
                output += `Question: ${prefix}${item.question}\n`;

                if (item.choices && item.choices.length > 0) {
                    output += `Choices:\n`;
                    item.choices.forEach(choiceObj => {
                        const text = typeof choiceObj === 'string' ? choiceObj : choiceObj.text;
                        const isCorrect = typeof choiceObj === 'object' && choiceObj.isAnswer;
                        const mark = (isCorrect && optStudy && optStudy.checked) ? ' [✓ Correct?]' : '';
                        output += `   ${text}${mark}\n`;
                    });
                }
            } else {
                if (output) output += '\n';
                if (item.imageDesc) output += `${item.imageDesc}\n`;
                output += `${item.text || ''}\n`;
            }
        }
        previewBox.value = output.trim();
    }

    function updateStats(count) {
        if (!statsBadge) return;
        statsBadge.textContent = `${count} items`;
        statsBadge.style.display = 'inline-block';
    }

    function downloadMarkdown(data) {
        let md = "# grabbr Export - " + new Date().toLocaleDateString() + "\n\n";
        let qCount = 0;
        data.forEach(item => {
            if (item.type === 'question') {
                qCount++;
                if (item.imageDesc) md += `> ${item.imageDesc}\n\n`;
                const prefix = (optNumbering && optNumbering.checked) ? `${qCount}. ` : '';
                md += `## ${prefix}${item.question}\n\n`;
                if (item.choices && item.choices.length > 0) {
                    item.choices.forEach(choiceObj => {
                        const text = typeof choiceObj === 'string' ? choiceObj : choiceObj.text;
                        const isCorrect = typeof choiceObj === 'object' && choiceObj.isAnswer;
                        const mark = (isCorrect && optStudy && optStudy.checked) ? " [Correct]" : "";
                        md += `- [ ] ${text}${mark}\n`;
                    });
                }
                md += '\n---\n\n';
            } else if (item.type === 'header') {
                md += `\n# ${item.text}\n\n`;
            } else {
                if (item.imageDesc) md += `> ${item.imageDesc}\n\n`;
                md += `${item.text}\n\n`;
            }
        });
        const link = document.createElement("a");
        const blob = new Blob([md], { type: 'text/markdown' });
        link.href = URL.createObjectURL(blob);
        link.download = `grabbr_notes_${Date.now()}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        updateStatus('Markdown Exported', 'success');
    }

    function downloadJSON(data) {
        const json = JSON.stringify(data, null, 2);
        const link = document.createElement("a");
        const blob = new Blob([json], { type: 'application/json' });
        link.href = URL.createObjectURL(blob);
        link.download = `grabbr_data_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        updateStatus('JSON Exported', 'success');
    }

    function downloadCSV(data) {
        const escape = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let csvContent = "Type,Question,Content/Choices\n";
        data.forEach(item => {
            if (item.type === 'question') {
                const choices = (item.choices || [])
                    .map(c => typeof c === 'string' ? c : c.text)
                    .join(' | ');
                csvContent += `${escape('question')},${escape(item.question)},${escape(choices)}\n`;
            } else {
                csvContent += `${escape(item.type)},${escape('')},${escape(item.text)}\n`;
            }
        });
        const link = document.createElement("a");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        link.href = URL.createObjectURL(blob);
        link.download = `grabbr_export_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        updateStatus('CSV Downloaded', 'success');
    }

    async function copyTextToClipboard(text, btnElement) {
        if (!text && text !== '') {
            updateStatus('Nothing to copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            updateStatus('Copied!', 'success');

            if (btnElement) {
                const originalHTML = btnElement.innerHTML;
                const originalWidth = btnElement.offsetWidth;
                btnElement.style.minWidth = `${originalWidth}px`; // Prevent jump

                btnElement.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copied!
                `;

                setTimeout(() => {
                    btnElement.innerHTML = originalHTML;
                    btnElement.style.minWidth = '';
                }, 2000);
            }
        } catch (err) {
            console.error('Clipboard failed:', err);
            updateStatus('Failed to copy', 'error');

            if (btnElement) {
                const originalHTML = btnElement.innerHTML;
                btnElement.innerHTML = `Error!`;
                setTimeout(() => { btnElement.innerHTML = originalHTML; }, 2000);
            }
        }
    }

    async function triggerExtraction(asJson = false) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) return null;

            const opts = {
                removeDuplicates: optDedup ? optDedup.checked : false,
                mergeBrokenSentences: optMerge ? optMerge.checked : false,
                ignoreTinyText: optTiny ? optTiny.checked : true,
                format: asJson ? 'json' : 'text'
            };

            const response = await sendMessageToTab(tab.id, { action: 'extract', mode: currentMode, options: opts });
            if (response && response.success) return response;
            updateStatus(response?.error || 'Failed', 'error');
            return null;
        } catch (err) {
            updateStatus('Reload page first', 'error');
            return null;
        }
    }

    function sendMessageToTab(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(response);
            });
        });
    }

    function updateStatus(msg, type = 'normal') {
        if (!statusBar) return;
        statusBar.textContent = msg;
        statusBar.style.color = type === 'error' ? 'var(--destructive)' : 'var(--muted-foreground)';
    }
});
