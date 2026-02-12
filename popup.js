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
    const clearResultsBtn = document.getElementById('clear-results-btn');

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

    // Preferences Persistence
    const isTransparent = localStorage.getItem('grabbr_transparent') === 'true';
    if (isTransparent && optTransparency) {
        document.body.classList.add('transparent-mode');
        optTransparency.checked = true;
    }
    if (optAutoCopy) {
        optAutoCopy.checked = localStorage.getItem('grabbr_autocopy') === 'true';
    }

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
                const choicesMatch = (item.choices || []).some(c => c.toLowerCase().includes(query));
                return textMatch || questionMatch || choicesMatch;
            });
            renderPreview(filtered);
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
        optTransparency.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
                document.body.classList.add('transparent-mode');
                localStorage.setItem('grabbr_transparent', 'true');
            } else {
                document.body.classList.remove('transparent-mode');
                localStorage.setItem('grabbr_transparent', 'false');
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

                const previewTab = document.querySelector('[data-tab="preview"]');
                if (previewTab) previewTab.click();
                updateStatus('Scan complete', 'success');
            }
        });
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            updateStatus('Extracting...', 'loading');
            const response = await triggerExtraction(false);
            if (response && response.data) {
                await copyTextToClipboard(response.data, copyBtn);
            }
        });
    }

    if (copyPreviewBtn) {
        copyPreviewBtn.addEventListener('click', async () => {
            if (previewBox && previewBox.value) {
                await copyTextToClipboard(previewBox.value, copyPreviewBtn);
            } else {
                updateStatus('Nothing to copy', 'error');
            }
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
                        // choices are now {text, isAnswer}
                        const text = typeof choiceObj === 'string' ? choiceObj : choiceObj.text;
                        const isCorrect = typeof choiceObj === 'object' && choiceObj.isAnswer;

                        // Study Mode logic: Only show mark if Study Mode is ON
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
        let md = "# grabbr Export\n\n";
        let qCount = 0;
        data.forEach(item => {
            if (item.type === 'question') {
                qCount++;
                if (item.imageDesc) md += `> ${item.imageDesc}\n\n`;
                const prefix = (optNumbering && optNumbering.checked) ? `${qCount}. ` : '';
                md += `### ${prefix}${item.question}\n`;
                if (item.choices && item.choices.length > 0) {
                    item.choices.forEach(choiceObj => {
                        const text = typeof choiceObj === 'string' ? choiceObj : choiceObj.text;
                        md += `- [ ] ${text}\n`;
                    });
                }
                md += '\n';
            } else {
                if (item.imageDesc) md += `> ${item.imageDesc}\n\n`;
                md += `${item.text}\n\n`;
            }
        });
        const link = document.createElement("a");
        link.setAttribute("href", 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md));
        link.setAttribute("download", `grabbr_notes_${Date.now()}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        updateStatus('Markdown Exported', 'success');
    }

    function downloadCSV(data) {
        let csvContent = "data:text/csv;charset=utf-8,Type,Question,Content/Choices\n";
        data.forEach(item => {
            if (item.type === 'question') {
                const choices = (item.choices || []).map(c => typeof c === 'string' ? c : c.text).join(' | ').replace(/"/g, '""');
                const row = `"question","${(item.question || '').replace(/"/g, '""')}","${choices}"`;
                csvContent += row + "\n";
            } else {
                const row = `"${item.type}","","${(item.text || '').replace(/"/g, '""')}"`;
                csvContent += row + "\n";
            }
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `grabbr_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        updateStatus('CSV Downloaded', 'success');
    }

    async function copyTextToClipboard(text, btnElement) {
        try {
            await navigator.clipboard.writeText(text);
            updateStatus('Copied!', 'success');
            const originalHTML = btnElement.innerHTML;
            btnElement.innerHTML = `✓ Copied!`;
            setTimeout(() => { btnElement.innerHTML = originalHTML; }, 2000);
        } catch (err) {
            updateStatus('Failed to copy', 'error');
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
