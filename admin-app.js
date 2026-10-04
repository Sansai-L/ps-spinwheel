// SpinQuest PS — Admin Dashboard Logic
(function () {
  'use strict';

  // ─── STATE ──────────────────────────────────────────────────────────────────
  let adminToken = localStorage.getItem('spinquest_admin_token') || null;
  let allTeams = [];
  let allDomains = [];
  let allProblems = [];
  let allDocuments = [];
  let selectedAdminFile = null;
  let activeTab = 'tabTeams';

  // ─── DOM REFS ───────────────────────────────────────────────────────────────
  const loginScreen = document.getElementById('adminLoginScreen');
  const dashboard = document.getElementById('adminDashboard');
  const loginForm = document.getElementById('adminLoginForm');
  const loginError = document.getElementById('adminLoginError');
  const adminUsername = document.getElementById('adminUsername');
  const adminPassword = document.getElementById('adminPassword');
  const toggleAdminPwd = document.getElementById('toggleAdminPwd');
  const adminWelcomeText = document.getElementById('adminWelcomeText');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  // Teams
  const statTotalTeams = document.getElementById('statTotalTeams');
  const statTotalSpins = document.getElementById('statTotalSpins');
  const statAvgSpins = document.getElementById('statAvgSpins');
  const statActiveDomains = document.getElementById('statActiveDomains');
  const teamsTableBody = document.getElementById('teamsTableBody');
  const teamSearchInput = document.getElementById('teamSearchInput');
  const refreshTeamsBtn = document.getElementById('refreshTeamsBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  // Domains
  const newDomainName = document.getElementById('newDomainName');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const domainsTableBody = document.getElementById('domainsTableBody');

  // Problems
  const psSearchInput = document.getElementById('psSearchInput');
  const psDomainFilter = document.getElementById('psDomainFilter');
  const psTableBody = document.getElementById('psTableBody');
  const showAddPsFormBtn = document.getElementById('showAddPsFormBtn');
  const addPsFormWrap = document.getElementById('addPsFormWrap');
  const cancelAddPsBtn = document.getElementById('cancelAddPsBtn');
  const addPsForm = document.getElementById('addPsForm');
  const psNewDomain = document.getElementById('psNewDomain');
  const psNewDifficulty = document.getElementById('psNewDifficulty');
  const psNewTitle = document.getElementById('psNewTitle');
  const psNewDesc = document.getElementById('psNewDesc');
  const psNewTags = document.getElementById('psNewTags');

  // Upload
  const adminUploadForm = document.getElementById('adminUploadForm');
  const adminDropZone = document.getElementById('adminDropZone');
  const adminFileInput = document.getElementById('adminFileInput');
  const adminSelectedFile = document.getElementById('adminSelectedFile');
  const adminFileName = document.getElementById('adminFileName');
  const adminFileSize = document.getElementById('adminFileSize');
  const adminRemoveFile = document.getElementById('adminRemoveFile');
  const adminUploadBtn = document.getElementById('adminUploadBtn');
  const uploadDomainSelect = document.getElementById('uploadDomainSelect');
  const uploadResultBox = document.getElementById('uploadResultBox');
  const uploadResultMsg = document.getElementById('uploadResultMsg');

  // Documents
  const docsTableBody = document.getElementById('docsTableBody');
  const refreshDocsBtn = document.getElementById('refreshDocsBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');

  // Tabs
  const tabBtns = document.querySelectorAll('.admin-tab[data-atab]');
  const tabContents = document.querySelectorAll('.admin-tab-content');

  // ─── INIT ───────────────────────────────────────────────────────────────────
  async function init() {
    setupListeners();
    if (adminToken) {
      const valid = await verifyToken();
      if (valid) {
        showDashboard();
        loadTabData(activeTab);
      } else {
        handleAuthFailure();
      }
    } else {
      showLogin();
    }
  }

  async function verifyToken() {
    try {
      const res = await fetch('/api/admin/verify', { headers: { 'Authorization': 'Bearer ' + adminToken } });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.valid);
    } catch {
      return false;
    }
  }

  function handleAuthFailure(msg = 'Session expired. Please log in as admin.') {
    localStorage.removeItem('spinquest_admin_token');
    adminToken = null;
    showLogin();
    showToast(msg, 'error');
  }

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  function showLogin() { loginScreen.classList.remove('hidden'); dashboard.classList.add('hidden'); }
  function showDashboard() { loginScreen.classList.add('hidden'); dashboard.classList.remove('hidden'); }

  async function handleLogin(e) {
    e.preventDefault();
    loginError.classList.add('hidden');
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername.value, password: adminPassword.value })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      adminToken = data.token;
      localStorage.setItem('spinquest_admin_token', adminToken);
      adminWelcomeText.textContent = `Logged in as ${adminUsername.value}`;
      showDashboard();
      loadTabData(activeTab);
      showToast('Admin access granted ✅', 'success');
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    } finally {
      btn.textContent = 'Sign In as Admin'; btn.disabled = false;
    }
  }

  function handleLogout() {
    localStorage.removeItem('spinquest_admin_token');
    adminToken = null;
    showLogin();
    showToast('Logged out successfully.', 'info');
  }

  // ─── TABS ───────────────────────────────────────────────────────────────────
  function switchTab(tabId) {
    activeTab = tabId;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.atab === tabId));
    tabContents.forEach(c => c.classList.toggle('hidden', c.id !== tabId));
    loadTabData(tabId);
  }

  async function loadTabData(tabId) {
    if (tabId === 'tabTeams') await loadTeams();
    else if (tabId === 'tabDomains') await loadDomains();
    else if (tabId === 'tabProblems') await loadProblems();
    else if (tabId === 'tabDocuments') await loadDocuments();
    else if (tabId === 'tabUpload') await populateUploadDomainSelect();
  }

  // ─── TEAMS ──────────────────────────────────────────────────────────────────
  async function loadTeams() {
    teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="8">Loading teams...</td></tr>`;
    try {
      const res = await fetch('/api/admin/teams', { headers: { 'Authorization': 'Bearer ' + adminToken } });
      if (res.status === 401 || res.status === 403) {
        handleAuthFailure('Admin session expired. Please log in again.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load teams');
      const data = await res.json();
      allTeams = data.teams || [];
      renderTeamsStats(data);
      renderTeamsTable(allTeams);
      setupPdfDownloadBtn();
    } catch (err) {
      teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="8" style="color:#f43f5e;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderTeamsStats(data) {
    const { teams = [], total = 0, totalSpins = 0 } = data;
    statTotalTeams.textContent = total;
    statTotalSpins.textContent = totalSpins;
    statAvgSpins.textContent = total > 0 ? (totalSpins / total).toFixed(1) : '0';
    const usedDomains = [...new Set(teams.flatMap(t => (t.spins || []).map(s => s.domain)))].length;
    statActiveDomains.textContent = usedDomains;
  }

  function renderTeamsTable(teams) {
    const search = (teamSearchInput.value || '').toLowerCase();
    const filtered = search
      ? teams.filter(t => t.teamId.toLowerCase().includes(search) || t.teamName.toLowerCase().includes(search))
      : teams;

    if (filtered.length === 0) {
      teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="8">No teams registered yet.</td></tr>`;
      return;
    }
    teamsTableBody.innerHTML = '';
    filtered.forEach((team, idx) => {
      const tr = document.createElement('tr');
      const ghLink = team.githubLink
        ? `<a href="${escHTML(team.githubLink)}" target="_blank" rel="noopener" style="color:var(--accent-cyan);font-size:0.78rem;text-decoration:none;">🔗 GitHub Repo</a>`
        : '<span style="color:var(--text-muted);font-size:0.75rem;">Not provided</span>';

      const spin = (team.spins && team.spins.length > 0) ? team.spins[0] : null;

      let domainHtml = `<span style="color:#f59e0b;font-size:0.75rem;font-weight:600;">⏳ Not chosen yet</span>`;
      let problemHtml = `<span style="color:var(--text-muted);font-style:italic;font-size:0.8rem;">Waiting for team to spin wheel</span>`;
      let statusHtml = `<span style="color:#f59e0b;font-weight:700;font-size:0.78rem;">⏳ Pending</span>`;
      let actionsHtml = `<span style="color:var(--text-muted);font-size:0.75rem;">—</span>`;

      if (spin) {
        domainHtml = `<span class="domain-tag" style="font-size:0.74rem;padding:3px 9px;white-space:nowrap;">${escHTML(spin.domain)}</span>`;
        
        const title = spin.title || spin.problemTitle || 'Assigned Problem';
        const desc = spin.description || spin.problemDescription || '';
        const diff = spin.difficulty || spin.problemDifficulty || 'Intermediate';
        const pid = spin.problemId || spin.id || '';

        problemHtml = `
          <div style="max-width: 440px;">
            <strong style="color:#ffffff; font-size:0.86rem; display:block; margin-bottom:4px; line-height:1.3;">
              ${escHTML(title)}
            </strong>
            <p style="font-size:0.75rem; color:#94a3b8; line-height:1.4; margin:0 0 6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${escHTML(desc)}
            </p>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="difficulty-tag" style="font-size:0.68rem; padding:1px 7px;">
                ${escHTML(diff)}
              </span>
              <span style="font-size:0.7rem; color:var(--text-muted);">
                Ref: <code>${escHTML(pid)}</code>
              </span>
            </div>
          </div>
        `;

        const timeStr = spin.spunAt ? new Date(spin.spunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        statusHtml = `
          <span style="display:inline-flex; align-items:center; gap:4px; color:#34d399; font-weight:700; font-size:0.78rem;">
            🟢 Allocated
          </span>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${timeStr}</div>
        `;

        actionsHtml = `
          <button class="btn btn-accent btn-sm download-single-team-pdf" data-tid="${escHTML(team.teamId)}" style="padding:4px 10px; font-size:0.75rem;" title="Download PDF assignment for ${escHTML(team.teamName)}">
            📄 PDF
          </button>
        `;
      }

      tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:0.8rem;">${idx + 1}</td>
        <td><code style="font-size:0.82rem;color:#34d399;font-weight:700;">${escHTML(team.teamId)}</code></td>
        <td style="font-weight:600;font-size:0.88rem;color:#ffffff;">${escHTML(team.teamName)}</td>
        <td>${ghLink}</td>
        <td>${domainHtml}</td>
        <td>${problemHtml}</td>
        <td>${statusHtml}</td>
        <td>${actionsHtml}</td>
      `;
      teamsTableBody.appendChild(tr);
    });

    // Wire individual team PDF download buttons
    teamsTableBody.querySelectorAll('.download-single-team-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        downloadIndividualTeamPdf(tid);
      });
    });
  }

  function downloadIndividualTeamPdf(teamId) {
    showToast(`Downloading PDF for Team ${teamId}... 📄`, 'info');
    fetch(`/api/team/problem-pdf?teamId=${encodeURIComponent(teamId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to generate PDF for this team');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Problem-Statement-${teamId}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast(`Team ${teamId} PDF downloaded! 📥`, 'success');
      })
      .catch(err => showToast(err.message, 'error'));
  }

  function setupPdfDownloadBtn() {
    const token = adminToken;
    downloadPdfBtn.href = '#';
    downloadPdfBtn.onclick = (e) => {
      e.preventDefault();
      showToast('Generating overall Event Report PDF... 📄', 'info');
      fetch('/api/admin/teams/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => {
          if (!r.ok) throw new Error('PDF generation failed');
          return r.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'SpinQuest-Teams-Report.pdf';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          showToast('Event report PDF downloaded! 📥', 'success');
        })
        .catch(err => showToast('PDF error: ' + err.message, 'error'));
    };
  }

  // ─── DOMAINS ────────────────────────────────────────────────────────────────
  async function loadDomains() {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      allDomains = data.domains;
      renderDomainsTable();
      populateDomainSelects();
    } catch (err) {
      domainsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="3" style="color:#f43f5e;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderDomainsTable() {
    if (allDomains.length === 0) {
      domainsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="3">No domains found.</td></tr>`;
      return;
    }
    domainsTableBody.innerHTML = '';
    allDomains.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${escHTML(d.name)}</td>
        <td>${d.count} PS</td>
        <td><button class="expand-btn delete-domain-btn" data-dname="${escHTML(d.name)}">🗑️ Delete</button></td>
      `;
      domainsTableBody.appendChild(tr);
    });
    domainsTableBody.querySelectorAll('.delete-domain-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Delete domain "${btn.dataset.dname}"? This will also delete all its problem statements.`)) {
          deleteDomain(btn.dataset.dname);
        }
      });
    });
  }

  async function addDomain() {
    const name = newDomainName.value.trim();
    if (!name) { showToast('Enter a domain name', 'error'); return; }
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ domain: name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add domain');
      newDomainName.value = '';
      showToast(`Domain "${name}" added!`, 'success');
      loadDomains();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteDomain(name) {
    try {
      const res = await fetch(`/api/domains/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete domain');
      showToast(`Domain "${name}" removed.`, 'success');
      loadDomains();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ─── PROBLEMS ───────────────────────────────────────────────────────────────
  async function loadProblems() {
    const search = psSearchInput ? psSearchInput.value.trim() : '';
    const domain = psDomainFilter ? psDomainFilter.value : 'All';
    let url = `/api/problems?domain=${encodeURIComponent(domain)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      allProblems = data.problems;
      renderProblemsTable();
      if (psDomainFilter && psDomainFilter.options.length <= 1) populatePsDomainFilter();
    } catch (err) {
      psTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="5" style="color:#f43f5e;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderProblemsTable() {
    if (allProblems.length === 0) {
      psTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="5">No problem statements found.</td></tr>`;
      return;
    }
    psTableBody.innerHTML = '';
    allProblems.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="domain-tag" style="font-size:0.7rem;">${escHTML(p.domain)}</span></td>
        <td>
          <strong style="font-size:0.85rem;">${escHTML(p.title)}</strong>
          <p style="font-size:0.75rem;color:#94a3b8;margin-top:3px;max-width:380px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escHTML(p.description)}</p>
        </td>
        <td><span class="difficulty-tag" style="font-size:0.7rem;">${escHTML(p.difficulty || 'Intermediate')}</span></td>
        <td style="font-size:0.75rem;color:#64748b;">${escHTML(p.source || 'Default')}</td>
        <td><button class="expand-btn delete-ps-btn" data-pid="${escHTML(p.id)}">🗑️ Delete</button></td>
      `;
      psTableBody.appendChild(tr);
    });
    psTableBody.querySelectorAll('.delete-ps-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this problem statement?')) deleteProblem(btn.dataset.pid);
      });
    });
  }

  async function deleteProblem(id) {
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      showToast('Problem statement deleted.', 'success');
      loadProblems();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function addProblemManually(e) {
    e.preventDefault();
    const payload = {
      domain: psNewDomain.value, difficulty: psNewDifficulty.value,
      title: psNewTitle.value.trim(), description: psNewDesc.value.trim(),
      tags: psNewTags.value.split(',').map(t => t.trim()).filter(Boolean)
    };
    try {
      const res = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      showToast('Problem statement added!', 'success');
      addPsFormWrap.classList.add('hidden');
      addPsForm.reset();
      loadProblems();
    } catch (err) { showToast(err.message, 'error'); }
  }

  function populatePsDomainFilter() {
    const domainsForFilter = [...new Set(allProblems.map(p => p.domain))];
    psDomainFilter.innerHTML = '<option value="All">All Domains</option>';
    domainsForFilter.forEach(d => {
      const o = document.createElement('option'); o.value = d; o.textContent = d;
      psDomainFilter.appendChild(o);
    });
  }

  // ─── DOCUMENTS ──────────────────────────────────────────────────────────────
  async function loadDocuments() {
    try {
      const res = await fetch('/api/documents', { headers: { 'Authorization': 'Bearer ' + adminToken } });
      if (res.status === 401 || res.status === 403) return handleAuthFailure('Session expired. Please log in.');
      const data = await res.json();
      allDocuments = data.documents || [];
      renderDocumentsTable();
    } catch (err) {
      docsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="5" style="color:#f43f5e;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderDocumentsTable() {
    if (allDocuments.length === 0) {
      docsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="5">No documents uploaded yet.</td></tr>`;
      return;
    }
    docsTableBody.innerHTML = '';
    allDocuments.forEach(doc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:0.85rem;">📄 ${escHTML(doc.filename)}</td>
        <td><span class="domain-tag" style="font-size:0.7rem;">${escHTML(doc.domain)}</span></td>
        <td style="font-size:0.85rem;">${doc.problemCount || '?'}</td>
        <td style="font-size:0.78rem;color:var(--text-muted);">${new Date(doc.uploadedAt).toLocaleString()}</td>
        <td><button class="expand-btn delete-doc-btn" data-did="${escHTML(doc.id)}">🗑️ Delete</button></td>
      `;
      docsTableBody.appendChild(tr);
    });
    docsTableBody.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this document and all its extracted problems?')) deleteDocument(btn.dataset.did);
      });
    });
  }

  async function deleteDocument(id) {
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE', headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      showToast('Document deleted.', 'success');
      loadDocuments();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function resetSampleData() {
    if (!confirm('This will replace ALL current problems with the default sample dataset. Continue?')) return;
    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + adminToken }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset');
      showToast(`Default data restored! ${data.totalProblems} problems loaded.`, 'success');
      loadDocuments();
    } catch (err) { showToast(err.message, 'error'); }
  }

  // ─── UPLOAD ─────────────────────────────────────────────────────────────────
  async function populateUploadDomainSelect() {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      uploadDomainSelect.innerHTML = '<option value="">— Select Domain —</option>';
      psNewDomain.innerHTML = '';
      data.domains.forEach(d => {
        const o1 = document.createElement('option'); o1.value = d.name; o1.textContent = d.name;
        uploadDomainSelect.appendChild(o1);
        const o2 = document.createElement('option'); o2.value = d.name; o2.textContent = d.name;
        psNewDomain.appendChild(o2);
      });
    } catch (err) { /* non-critical */ }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedAdminFile) { showToast('Select a file first', 'error'); return; }
    const domain = uploadDomainSelect.value;
    if (!domain) { showToast('Select a target domain', 'error'); return; }
    const formData = new FormData();
    formData.append('file', selectedAdminFile);
    formData.append('domain', domain);
    adminUploadBtn.textContent = 'Uploading…'; adminUploadBtn.disabled = true;
    uploadResultBox.classList.add('hidden');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + adminToken },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      uploadResultMsg.textContent = `Extracted ${data.problemsAdded || '?'} problem statements from "${selectedAdminFile.name}" for domain "${domain}".`;
      uploadResultBox.classList.remove('hidden');
      clearFileSelection();
      showToast('Upload successful! 🎉', 'success');
    } catch (err) { showToast('Upload error: ' + err.message, 'error'); }
    finally {
      adminUploadBtn.textContent = 'Extract & Add Problem Statements';
      adminUploadBtn.disabled = !selectedAdminFile;
    }
  }

  function handleFileSelect(file) {
    if (!file) return;
    selectedAdminFile = file;
    adminFileName.textContent = file.name;
    adminFileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    adminSelectedFile.classList.remove('hidden');
    adminDropZone.style.display = 'none';
    adminUploadBtn.disabled = false;
  }

  function clearFileSelection() {
    selectedAdminFile = null;
    adminFileInput.value = '';
    adminSelectedFile.classList.add('hidden');
    adminDropZone.style.display = '';
    adminUploadBtn.disabled = true;
  }

  // ─── DOMAIN SELECTS HELPERS ─────────────────────────────────────────────────
  function populateDomainSelects() {
    populateUploadDomainSelect();
  }

  // ─── EVENT LISTENERS ────────────────────────────────────────────────────────
  function setupListeners() {
    loginForm.addEventListener('submit', handleLogin);
    adminLogoutBtn.addEventListener('click', handleLogout);
    toggleAdminPwd.addEventListener('click', () => {
      const isPass = adminPassword.type === 'password';
      adminPassword.type = isPass ? 'text' : 'password';
      toggleAdminPwd.textContent = isPass ? '🙈' : '👁️';
    });

    // Tabs
    tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.atab)));

    // Teams
    refreshTeamsBtn.addEventListener('click', loadTeams);
    teamSearchInput.addEventListener('input', debounce(() => renderTeamsTable(allTeams), 300));

    // Domains
    addDomainBtn.addEventListener('click', addDomain);
    newDomainName.addEventListener('keydown', e => { if (e.key === 'Enter') addDomain(); });

    // Problems
    showAddPsFormBtn.addEventListener('click', () => {
      addPsFormWrap.classList.toggle('hidden');
      populateUploadDomainSelect();
    });
    cancelAddPsBtn.addEventListener('click', () => addPsFormWrap.classList.add('hidden'));
    addPsForm.addEventListener('submit', addProblemManually);
    if (psSearchInput) psSearchInput.addEventListener('input', debounce(loadProblems, 300));
    if (psDomainFilter) psDomainFilter.addEventListener('change', loadProblems);

    // Upload
    adminDropZone.addEventListener('click', () => adminFileInput.click());
    adminFileInput.addEventListener('change', e => handleFileSelect(e.target.files[0]));
    adminRemoveFile.addEventListener('click', clearFileSelection);
    adminDropZone.addEventListener('dragover', e => { e.preventDefault(); adminDropZone.classList.add('drag-over'); });
    adminDropZone.addEventListener('dragleave', () => adminDropZone.classList.remove('drag-over'));
    adminDropZone.addEventListener('drop', e => {
      e.preventDefault(); adminDropZone.classList.remove('drag-over');
      handleFileSelect(e.dataTransfer.files[0]);
    });
    adminDropZone.querySelectorAll('.browse-link').forEach(l => l.addEventListener('click', e => {
      e.stopPropagation(); adminFileInput.click();
    }));
    adminUploadForm.addEventListener('submit', handleUpload);

    // Documents
    refreshDocsBtn.addEventListener('click', loadDocuments);
    resetDataBtn.addEventListener('click', resetSampleData);
  }

  // ─── UTILITIES ──────────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escHTML(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  window.addEventListener('DOMContentLoaded', init);
})();
