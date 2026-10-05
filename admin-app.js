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

  // Teams & Master Sheet Controls
  const statTotalTeams = document.getElementById('statTotalTeams');
  const statTotalAllocated = document.getElementById('statTotalAllocated');
  const statTotalPending = document.getElementById('statTotalPending');
  const statActiveDomains = document.getElementById('statActiveDomains');
  const teamsTableBody = document.getElementById('teamsTableBody');
  const teamSearchInput = document.getElementById('teamSearchInput');
  const teamStatusFilter = document.getElementById('teamStatusFilter');
  const teamDomainFilter = document.getElementById('teamDomainFilter');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const backupJsonBtn = document.getElementById('backupJsonBtn');
  const triggerRestoreBtn = document.getElementById('triggerRestoreBtn');
  const restoreJsonInput = document.getElementById('restoreJsonInput');
  const refreshTeamsBtn = document.getElementById('refreshTeamsBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');

  // Team Details Modal
  const teamDetailsModal = document.getElementById('teamDetailsModal');
  const closeTeamModalBtn = document.getElementById('closeTeamModalBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');
  const modalResetSpinBtn = document.getElementById('modalResetSpinBtn');
  const modalDownloadPdfBtn = document.getElementById('modalDownloadPdfBtn');
  const modalTeamId = document.getElementById('modalTeamId');
  const modalTeamName = document.getElementById('modalTeamName');
  const modalTeamStatusBadge = document.getElementById('modalTeamStatusBadge');
  const modalLeader = document.getElementById('modalLeader');
  const modalPhone = document.getElementById('modalPhone');
  const modalEmail = document.getElementById('modalEmail');
  const modalTrack = document.getElementById('modalTrack');
  const modalCollege = document.getElementById('modalCollege');
  const modalMembers = document.getElementById('modalMembers');
  const modalUtr = document.getElementById('modalUtr');
  const modalGithub = document.getElementById('modalGithub');
  const modalProblemSection = document.getElementById('modalProblemSection');
  const modalProblemBox = document.getElementById('modalProblemBox');
  const modalProblemTitle = document.getElementById('modalProblemTitle');
  const modalProblemDesc = document.getElementById('modalProblemDesc');
  const modalProblemText = document.getElementById('modalProblemText');
  const modalSolutionText = document.getElementById('modalSolutionText');
  const modalProblemDiff = document.getElementById('modalProblemDiff');
  const modalProblemDomain = document.getElementById('modalProblemDomain');
  let selectedModalTeam = null;

  // Domains
  const newDomainName = document.getElementById('newDomainName');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const domainsTableBody = document.getElementById('domainsTableBody');

  // Problems
  const psSearchInput = document.getElementById('psSearchInput');
  const psDomainFilter = document.getElementById('psDomainFilter');
  const psTableBody = document.getElementById('psTableBody');
  const clearAllPsBtn = document.getElementById('clearAllPsBtn');
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
        localStorage.removeItem('spinquest_admin_token');
        adminToken = null;
        showLogin();
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
    if (msg) showToast(msg, 'error');
  }

  // ─── AUTH ───────────────────────────────────────────────────────────────────
  function showLogin() { loginScreen.classList.remove('hidden'); dashboard.classList.add('hidden'); }
  function showDashboard() { loginScreen.classList.add('hidden'); dashboard.classList.remove('hidden'); }

  async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    loginError.classList.add('hidden');
    loginError.textContent = '';
    const btn = loginForm.querySelector('button[type="submit"]');
    const uVal = (adminUsername.value || '').trim();
    const pVal = (adminPassword.value || '').trim();

    if (!uVal || !pVal) {
      loginError.textContent = 'Please enter both username and password';
      loginError.classList.remove('hidden');
      return;
    }

    if (btn) {
      btn.textContent = 'Signing in…';
      btn.disabled = true;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uVal, password: pVal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed. Please check credentials.');
      adminToken = data.token;
      localStorage.setItem('spinquest_admin_token', adminToken);
      if (adminWelcomeText) adminWelcomeText.textContent = `Logged in as ${uVal}`;
      showDashboard();
      await loadTabData(activeTab);
      showToast('Admin access granted ✅', 'success');
    } catch (err) {
      console.error('Admin login error:', err);
      loginError.textContent = err.message || 'Login failed. Please check credentials.';
      loginError.classList.remove('hidden');
    } finally {
      if (btn) {
        btn.textContent = 'Sign In as Admin';
        btn.disabled = false;
      }
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

  // ─── TEAMS & MASTER SHEET ───────────────────────────────────────────────────
  async function loadTeams() {
    teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="9">Loading teams...</td></tr>`;
    try {
      const res = await fetch('/api/admin/teams', { headers: { 'Authorization': 'Bearer ' + adminToken } });
      if (res.status === 401) {
        handleAuthFailure('Admin session expired. Please log in again.');
        return;
      }
      if (!res.ok) throw new Error('Failed to load teams (HTTP ' + res.status + ')');
      const data = await res.json();
      allTeams = data.teams || [];
      renderTeamsStats(data);
      populateTeamDomainFilter();
      renderTeamsTable(allTeams);
      setupPdfDownloadBtn();
    } catch (err) {
      console.error('loadTeams error:', err);
      teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="9" style="color:#f43f5e;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderTeamsStats(data) {
    const { teams = [], total = 0, allocatedCount = 0, pendingCount = 0 } = data;
    if (statTotalTeams) statTotalTeams.textContent = total || teams.length;
    if (statTotalAllocated) statTotalAllocated.textContent = allocatedCount;
    if (statTotalPending) statTotalPending.textContent = pendingCount;
    const tracks = [...new Set(teams.map(t => t.domain || t.originalTrack).filter(Boolean))];
    if (statActiveDomains) statActiveDomains.textContent = tracks.length || 5;
  }

  function populateTeamDomainFilter() {
    if (!teamDomainFilter) return;
    const currentVal = teamDomainFilter.value;
    const tracks = [...new Set(allTeams.map(t => t.domain || t.originalTrack).filter(Boolean))].sort();
    teamDomainFilter.innerHTML = '<option value="All">All Tracks</option>';
    tracks.forEach(tr => {
      const opt = document.createElement('option');
      opt.value = tr;
      opt.textContent = tr;
      if (tr === currentVal) opt.selected = true;
      teamDomainFilter.appendChild(opt);
    });
  }

  function renderTeamsTable(teams) {
    const search = (teamSearchInput?.value || '').trim().toLowerCase();
    const statusVal = teamStatusFilter ? teamStatusFilter.value : 'All';
    const domainVal = teamDomainFilter ? teamDomainFilter.value : 'All';

    const filtered = teams.filter(team => {
      // 1. Status filter
      const hasSpun = Boolean(team.spins && team.spins.length > 0);
      if (statusVal === 'Allocated' && !hasSpun) return false;
      if (statusVal === 'Pending' && hasSpun) return false;

      // 2. Domain / Track filter
      const track = team.domain || team.originalTrack || '';
      if (domainVal !== 'All' && track.toLowerCase() !== domainVal.toLowerCase()) return false;

      // 3. Search filter across all details
      if (search) {
        const textToSearch = [
          team.teamId,
          team.regId,
          team.teamName,
          team.leader,
          team.college,
          team.members,
          team.phone,
          team.email,
          track,
          hasSpun ? (team.spins[0].title || team.spins[0].problemTitle) : ''
        ].filter(Boolean).join(' ').toLowerCase();

        if (!textToSearch.includes(search)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      teamsTableBody.innerHTML = `<tr class="empty-table-row"><td colspan="9">No matching teams found.</td></tr>`;
      return;
    }

    teamsTableBody.innerHTML = '';
    filtered.forEach((team, idx) => {
      const tr = document.createElement('tr');
      const hasSpun = team.spins && team.spins.length > 0;
      const spin = hasSpun ? team.spins[0] : null;

      // Leader & Contact
      const leaderHtml = `
        <div style="font-weight:600;color:#ffffff;font-size:0.83rem;">${escHTML(team.leader || '—')}</div>
        ${team.phone ? `<div style="font-size:0.75rem;color:#38bdf8;margin-top:2px;">📞 ${escHTML(team.phone)}</div>` : ''}
        ${team.email ? `<div style="font-size:0.7rem;color:var(--text-muted);">${escHTML(team.email)}</div>` : ''}
      `;

      // College
      const collegeHtml = `<div style="font-size:0.78rem;color:#cbd5e1;line-height:1.35;max-width:210px;">${escHTML(team.college || '—')}</div>`;

      // Track / Domain
      const trackName = team.domain || team.originalTrack || 'General';
      const domainHtml = `<span class="domain-tag" style="font-size:0.72rem;padding:3px 8px;white-space:nowrap;">${escHTML(trackName)}</span>`;

      // Allocated Problem Statement
      let problemHtml = `<span style="color:#f59e0b;font-size:0.78rem;font-style:italic;">⏳ Waiting for spin draw</span>`;
      let statusHtml = `<span style="color:#f59e0b;font-weight:700;font-size:0.78rem;">⏳ Pending</span>`;

      if (spin) {
        const title = spin.title || spin.problemTitle || 'Assigned Problem';
        const desc = spin.description || spin.problemDescription || '';
        const diff = spin.difficulty || spin.problemDifficulty || 'Intermediate';

        problemHtml = `
          <div style="max-width: 320px;">
            <strong style="color:#ffffff; font-size:0.84rem; display:block; margin-bottom:3px; line-height:1.3;">
              ${escHTML(title)}
            </strong>
            <p style="font-size:0.74rem; color:#94a3b8; line-height:1.35; margin:0 0 4px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${escHTML(desc)}
            </p>
            <span class="difficulty-tag" style="font-size:0.65rem; padding:1px 6px;">
              ${escHTML(diff)}
            </span>
          </div>
        `;

        const timeStr = spin.spunAt ? new Date(spin.spunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        statusHtml = `
          <span style="display:inline-flex; align-items:center; gap:4px; color:#34d399; font-weight:700; font-size:0.78rem;">
            🟢 Allocated
          </span>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${timeStr}</div>
        `;
      }

      // Actions
      const actionsHtml = `
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-secondary btn-sm view-team-details" data-tid="${escHTML(team.teamId)}" style="padding:4px 9px;font-size:0.74rem;" title="View all team details">
            👁️ Details
          </button>
          ${hasSpun 
            ? `<button class="btn btn-accent btn-sm download-single-team-pdf" data-tid="${escHTML(team.teamId)}" style="padding:4px 9px;font-size:0.74rem;" title="Download PDF assignment">
                📄 PDF
               </button>`
            : `<button class="btn btn-outline btn-sm" disabled style="padding:4px 9px;font-size:0.74rem;opacity:0.35;" title="Team has not spun yet">
                📄 PDF
               </button>`
          }
        </div>
      `;

      tr.innerHTML = `
        <td style="color:var(--text-muted);font-size:0.78rem;">${idx + 1}</td>
        <td><code style="font-size:0.8rem;color:#38bdf8;font-weight:700;">${escHTML(team.teamId)}</code></td>
        <td style="font-weight:700;font-size:0.85rem;color:#ffffff;">${escHTML(team.teamName)}</td>
        <td>${leaderHtml}</td>
        <td>${collegeHtml}</td>
        <td>${domainHtml}</td>
        <td>${problemHtml}</td>
        <td>${statusHtml}</td>
        <td>${actionsHtml}</td>
      `;
      teamsTableBody.appendChild(tr);
    });

    // Wire Details buttons
    teamsTableBody.querySelectorAll('.view-team-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        const team = allTeams.find(t => t.teamId.toLowerCase() === tid.toLowerCase());
        if (team) openTeamDetailsModal(team);
      });
    });

    // Wire individual team PDF download buttons
    teamsTableBody.querySelectorAll('.download-single-team-pdf').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.tid;
        downloadIndividualTeamPdf(tid);
      });
    });
  }

  // Helper: Extract structured problem details (Title | Problem | Expected Solution)
  function extractProblemParts(problem) {
    if (!problem) return { title: 'Assigned Problem Statement', problem: '', expectedSolution: '', tags: [] };
    const title = problem.title || problem.problemTitle || 'Assigned Problem Statement';
    let probText = problem.problem || problem.problemText || '';
    let solText = problem.expectedSolution || problem.solution || '';

    if (!probText || !solText) {
      const rawDesc = problem.description || problem.problemDescription || '';
      const probIdx = rawDesc.search(/(?:^|\n)\s*Problem\s*:\s*/i);
      const solIdx = rawDesc.search(/(?:^|\n)\s*Expected\s+Solution\s*:\s*/i);

      if (probIdx !== -1 && solIdx !== -1 && solIdx > probIdx) {
        const afterProb = rawDesc.substring(probIdx).replace(/^(?:^|\n)\s*Problem\s*:\s*/i, '');
        const nextSol = afterProb.search(/(?:^|\n)\s*Expected\s+Solution\s*:\s*/i);
        if (nextSol !== -1) {
          probText = afterProb.substring(0, nextSol).trim();
          solText = afterProb.substring(nextSol).replace(/^(?:^|\n)\s*Expected\s+Solution\s*:\s*/i, '').trim();
        }
      } else if (solIdx !== -1) {
        probText = rawDesc.substring(0, solIdx).trim();
        solText = rawDesc.substring(solIdx).replace(/^(?:^|\n)\s*Expected\s+Solution\s*:\s*/i, '').trim();
      } else {
        probText = rawDesc.trim();
        solText = 'Design and implement a complete, production-grade software solution addressing the core challenges, with clean architecture and deployment artifacts.';
      }
    }

    return {
      title,
      problem: probText,
      expectedSolution: solText,
      domain: problem.domain || '',
      difficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
      tags: problem.tags || []
    };
  }

  // ─── TEAM DETAILS MODAL ─────────────────────────────────────────────────────
  function openTeamDetailsModal(team) {
    selectedModalTeam = team;
    modalTeamId.textContent = team.teamId || team.regId;
    modalTeamName.textContent = team.teamName;

    const hasSpun = team.spins && team.spins.length > 0;
    modalTeamStatusBadge.textContent = hasSpun ? '🟢 Allocated' : '⏳ Pending Draw';
    modalTeamStatusBadge.style.color = hasSpun ? '#34d399' : '#f59e0b';

    modalLeader.textContent = team.leader || 'Not specified';
    modalPhone.textContent = team.phone || 'Not specified';
    modalEmail.textContent = team.email || 'Not specified';
    modalTrack.textContent = team.domain || team.originalTrack || 'General';
    modalCollege.textContent = team.college || 'Not specified';
    modalMembers.textContent = team.members || 'Not specified';
    modalUtr.textContent = team.utr || 'Not recorded';

    if (team.githubLink) {
      modalGithub.innerHTML = `<a href="${escHTML(team.githubLink)}" target="_blank" rel="noopener" style="color:#38bdf8;">${escHTML(team.githubLink)}</a>`;
    } else {
      modalGithub.textContent = 'Not provided';
    }

    if (hasSpun) {
      const spin = team.spins[0];
      const parts = extractProblemParts(spin);
      modalProblemTitle.textContent = parts.title;
      if (modalProblemText) modalProblemText.textContent = parts.problem;
      if (modalSolutionText) modalSolutionText.textContent = parts.expectedSolution;
      if (modalProblemDesc) modalProblemDesc.textContent = parts.problem;
      modalProblemDiff.textContent = parts.difficulty;
      modalProblemDomain.textContent = spin.domain || team.domain || 'Challenge';
      modalProblemSection.style.display = 'block';
      modalDownloadPdfBtn.style.display = 'inline-block';
      modalResetSpinBtn.style.display = 'inline-block';
    } else {
      modalProblemSection.style.display = 'none';
      modalDownloadPdfBtn.style.display = 'none';
      modalResetSpinBtn.style.display = 'none';
    }

    teamDetailsModal.classList.remove('hidden');
  }

  function closeTeamDetailsModal() {
    teamDetailsModal.classList.add('hidden');
    selectedModalTeam = null;
  }

  async function handleResetSpin() {
    if (!selectedModalTeam) return;
    if (!confirm(`Are you sure you want to reset the spin for "${selectedModalTeam.teamName}"? They will be allowed to spin the wheel again.`)) return;

    try {
      const res = await fetch('/api/admin/teams/reset-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ teamId: selectedModalTeam.teamId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset spin');
      showToast(data.message || 'Spin reset successfully!', 'success');
      closeTeamDetailsModal();
      loadTeams();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ─── EXPORT CSV & BACKUP/RESTORE ────────────────────────────────────────────
  function exportTeamsCsv() {
    if (allTeams.length === 0) {
      showToast('No teams to export', 'error');
      return;
    }
    const headers = [
      '#', 'Reg ID', 'Team Name', 'Leader', 'Phone', 'Email',
      'College', 'Members', 'Original Track', 'Assigned Domain',
      'Status', 'Problem Title', 'Problem Description', 'Difficulty',
      'Allocated At', 'GitHub Link', 'UTR Ref'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = allTeams.map((team, idx) => {
      const hasSpun = team.spins && team.spins.length > 0;
      const spin = hasSpun ? team.spins[0] : null;
      return [
        idx + 1,
        team.teamId || team.regId,
        team.teamName,
        team.leader || '',
        team.phone || '',
        team.email || '',
        team.college || '',
        team.members || '',
        team.originalTrack || '',
        team.domain || '',
        hasSpun ? 'Allocated' : 'Pending',
        spin ? (spin.title || spin.problemTitle || '') : '',
        spin ? (spin.description || spin.problemDescription || '') : '',
        spin ? (spin.difficulty || spin.problemDifficulty || '') : '',
        spin && spin.spunAt ? new Date(spin.spunAt).toLocaleString() : '',
        team.githubLink || '',
        team.utr || ''
      ].map(escapeCsv).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'CODIENYCH-1.0-Master-Allocation-Sheet.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Exported CSV spreadsheet! 📥', 'success');
  }

  function backupJsonData() {
    const backupObj = {
      exportedAt: new Date().toISOString(),
      teams: allTeams,
      problems: allProblems,
      domains: allDomains
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codienych-database-backup-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Database JSON backup downloaded! 💾', 'success');
  }

  async function handleRestoreJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.teams || !Array.isArray(parsed.teams)) {
        throw new Error('Invalid backup file. Missing teams array.');
      }
      if (!confirm(`Restore ${parsed.teams.length} teams from backup "${file.name}"?`)) {
        restoreJsonInput.value = '';
        return;
      }
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
        body: JSON.stringify({ backupData: parsed })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      showToast(data.message || 'Database restored successfully!', 'success');
      loadTeams();
    } catch (err) {
      showToast('Restore error: ' + err.message, 'error');
    } finally {
      restoreJsonInput.value = '';
    }
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
      showToast('Generating Master Event Report PDF... 📄', 'info');
      fetch('/api/admin/teams/pdf', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => {
          if (!r.ok) throw new Error('PDF generation failed');
          return r.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'CODIENYCH-1.0-Teams-Report.pdf';
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          showToast('Master event report PDF downloaded! 📥', 'success');
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
        body: JSON.stringify({ name })
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
        <td style="font-size:0.85rem;">${doc.extractedCount || doc.problemCount || '—'}</td>
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
      uploadResultMsg.textContent = `Extracted ${data.extractedCount || '?'} problem statements from "${selectedAdminFile.name}" for domain "${domain}".`;
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

    // Teams & Master Sheet
    refreshTeamsBtn.addEventListener('click', loadTeams);
    teamSearchInput.addEventListener('input', debounce(() => renderTeamsTable(allTeams), 300));
    if (teamStatusFilter) teamStatusFilter.addEventListener('change', () => renderTeamsTable(allTeams));
    if (teamDomainFilter) teamDomainFilter.addEventListener('change', () => renderTeamsTable(allTeams));
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportTeamsCsv);
    if (backupJsonBtn) backupJsonBtn.addEventListener('click', backupJsonData);
    if (triggerRestoreBtn && restoreJsonInput) {
      triggerRestoreBtn.addEventListener('click', () => restoreJsonInput.click());
      restoreJsonInput.addEventListener('change', handleRestoreJsonFile);
    }

    // Modal controls
    if (closeTeamModalBtn) closeTeamModalBtn.addEventListener('click', closeTeamDetailsModal);
    if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeTeamDetailsModal);
    if (modalResetSpinBtn) modalResetSpinBtn.addEventListener('click', handleResetSpin);
    if (modalDownloadPdfBtn) modalDownloadPdfBtn.addEventListener('click', () => {
      if (selectedModalTeam) downloadIndividualTeamPdf(selectedModalTeam.teamId);
    });
    // Close modal when clicking the backdrop outside the modal card
    if (teamDetailsModal) {
      teamDetailsModal.addEventListener('click', (e) => {
        if (e.target === teamDetailsModal) closeTeamDetailsModal();
      });
    }

    // Domains
    addDomainBtn.addEventListener('click', addDomain);
    newDomainName.addEventListener('keydown', e => { if (e.key === 'Enter') addDomain(); });

    // Problems
    if (clearAllPsBtn) {
      clearAllPsBtn.addEventListener('click', async () => {
        if (!confirm('⚠️ Are you sure you want to permanently delete ALL problem statements and documents? This will completely empty the problem statement repository.')) {
          return;
        }
        try {
          const res = await fetch('/api/admin/clear-all-problems', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + adminToken }
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast('All problem statements have been deleted successfully. The repository is now fresh and empty.', 'success');
            loadProblems();
            loadDomains();
            loadDocuments();
          } else {
            showToast(data.error || 'Failed to clear problem statements', 'error');
          }
        } catch (err) {
          showToast('Error: ' + err.message, 'error');
        }
      });
    }
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

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
