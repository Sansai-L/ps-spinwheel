// SpinQuest PS — User Application Logic
(function () {
  'use strict';

  // ─── STATE ──────────────────────────────────────────────────────────────────
  let domains = [];
  let activeDomain = 'Artificial Intelligence & ML';
  let seenProblems = JSON.parse(localStorage.getItem('spinquest_seen_problems') || '{}');
  let recentSpins = JSON.parse(localStorage.getItem('spinquest_recent_spins') || '[]');
  let teamSession = JSON.parse(localStorage.getItem('spinquest_team_session') || 'null');
  let teamSpinCount = 0;
  let isSpinning = false;
  let currentAngle = 0;
  let spinAnimationFrame = null;

  // ─── WEB AUDIO TICK ─────────────────────────────────────────────────────────
  let audioCtx = null;
  function playTickSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420 + Math.random() * 100, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  // ─── DOMAIN THEMES ──────────────────────────────────────────────────────────
  const DOMAIN_THEMES = [
    { name: 'Artificial Intelligence & ML', icon: '🤖', color: '#06b6d4', dark: '#083344' },
    { name: 'Cybersecurity & Privacy', icon: '🛡️', color: '#f43f5e', dark: '#4c0519' },
    { name: 'Web & Mobile Development', icon: '🌐', color: '#8b5cf6', dark: '#2e1065' },
    { name: 'Internet of Things (IoT)', icon: '📡', color: '#10b981', dark: '#022c22' },
    { name: 'Cloud & DevOps', icon: '☁️', color: '#3b82f6', dark: '#172554' }
  ];

  function getDomainTheme(name) {
    const found = DOMAIN_THEMES.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return { name, icon: '💡', color: '#' + '00000'.substring(0, 6 - c.length) + c, dark: '#1e293b' };
  }

  // ─── DOM REFS ───────────────────────────────────────────────────────────────
  const entryGate = document.getElementById('entryGate');
  const mainApp = document.getElementById('mainApp');
  const teamEntryForm = document.getElementById('teamEntryForm');
  const entryTeamId = document.getElementById('entryTeamId');
  const entryTeamName = document.getElementById('entryTeamName');
  const entryGithubLink = document.getElementById('entryGithubLink');
  const entryErrorMsg = document.getElementById('entryErrorMsg');
  const entrySubmitBtn = document.getElementById('entrySubmitBtn');
  const entrySubmitLabel = document.getElementById('entrySubmitLabel');

  const navActiveDomainText = document.getElementById('navActiveDomainText');
  const domainListContainer = document.getElementById('domainListContainer');
  const spinDomainTarget = document.getElementById('spinDomainTarget');
  const spinStatusMessage = document.getElementById('spinStatusMessage');
  const spinCenterBtn = document.getElementById('spinCenterBtn');
  const spinMainBtn = document.getElementById('spinMainBtn');
  const wheelCanvas = document.getElementById('wheelCanvas');
  const wheelPointer = document.querySelector('.wheel-pointer');

  const cycleProgressBar = document.getElementById('cycleProgressBar');
  const cycleCountText = document.getElementById('cycleCountText');
  const cycleRemainingText = document.getElementById('cycleRemainingText');
  const resetCycleBtn = document.getElementById('resetCycleBtn');

  const teamNavPill = document.getElementById('teamNavPill');
  const teamNavName = document.getElementById('teamNavName');
  const switchTeamBtn = document.getElementById('switchTeamBtn');
  const teamInfoId = document.getElementById('teamInfoId');
  const teamInfoName = document.getElementById('teamInfoName');
  const teamInfoGithub = document.getElementById('teamInfoGithub');
  const teamGithubRow = document.getElementById('teamGithubRow');
  const teamInfoSpins = document.getElementById('teamInfoSpins');

  const recentSpinsList = document.getElementById('recentSpinsList');
  const viewProblemsBtn = document.getElementById('viewProblemsBtn');

  const problemModal = document.getElementById('problemModal');
  const closeProblemModal = document.getElementById('closeProblemModal');
  const modalDomainTag = document.getElementById('modalDomainTag');
  const modalDifficultyTag = document.getElementById('modalDifficultyTag');
  const modalSourceTag = document.getElementById('modalSourceTag');
  const modalProblemTitle = document.getElementById('modalProblemTitle');
  const modalProblemDescription = document.getElementById('modalProblemDescription');
  const modalTagsContainer = document.getElementById('modalTagsContainer');
  const modalCycleStatusText = document.getElementById('modalCycleStatusText');
  const cycleCompletionAlert = document.getElementById('cycleCompletionAlert');
  const copyProblemBtn = document.getElementById('copyProblemBtn');
  const dismissProblemModalBtn = document.getElementById('dismissProblemModalBtn');

  const exploreModal = document.getElementById('exploreModal');
  const closeExploreModal = document.getElementById('closeExploreModal');
  const exploreSearchInput = document.getElementById('exploreSearchInput');
  const exploreDomainFilter = document.getElementById('exploreDomainFilter');
  const exploreProblemsTableBody = document.getElementById('exploreProblemsTableBody');

  // ─── INIT ───────────────────────────────────────────────────────────────────
  async function init() {
    setupEventListeners();
    setupCanvas();
    drawWheel();

    if (teamSession && teamSession.sessionToken && teamSession.team) {
      // Resume existing session
      showMainApp(teamSession.team);
    } else {
      showEntryGate();
    }
  }

  // ─── ENTRY GATE ─────────────────────────────────────────────────────────────
  function showEntryGate() {
    entryGate.classList.remove('hidden');
    mainApp.classList.add('hidden');
  }

  function showMainApp(team) {
    entryGate.classList.add('hidden');
    mainApp.classList.remove('hidden');
    renderTeamInfo(team);
    fetchDomains();
    renderRecentSpins();
  }

  function renderTeamInfo(team) {
    teamNavName.textContent = team.teamName;
    teamInfoId.textContent = team.teamId;
    teamInfoName.textContent = team.teamName;
    teamSpinCount = parseInt(localStorage.getItem('spinquest_team_spin_count') || '0', 10);
    teamInfoSpins.textContent = teamSpinCount;
    if (team.githubLink) {
      teamInfoGithub.textContent = team.githubLink;
      teamInfoGithub.href = team.githubLink;
      teamGithubRow.style.display = 'flex';
    } else {
      teamGithubRow.style.display = 'none';
    }
  }

  // ─── TEAM REGISTRATION ──────────────────────────────────────────────────────
  async function handleTeamRegister(e) {
    e.preventDefault();
    entryErrorMsg.classList.add('hidden');
    entryErrorMsg.textContent = '';

    const teamId = entryTeamId.value.trim();
    const teamName = entryTeamName.value.trim();
    const githubLink = entryGithubLink.value.trim();

    if (!teamId) { showEntryError('Please enter your Team ID.'); return; }
    if (!teamName) { showEntryError('Please enter your Team Name.'); return; }

    entrySubmitLabel.textContent = 'Entering...';
    entrySubmitBtn.disabled = true;

    try {
      const res = await fetch('/api/team/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, teamName, githubLink })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      teamSession = { sessionToken: data.sessionToken, team: data.team };
      localStorage.setItem('spinquest_team_session', JSON.stringify(teamSession));
      localStorage.setItem('spinquest_team_spin_count', '0');

      if (data.isReturning) showToast(`Welcome back, ${data.team.teamName}! 👋`, 'info');
      else showToast(`Welcome, ${data.team.teamName}! 🚀 Let's spin!`, 'success');

      showMainApp(data.team);
    } catch (err) {
      showEntryError(err.message);
    } finally {
      entrySubmitLabel.textContent = 'Enter Competition';
      entrySubmitBtn.disabled = false;
    }
  }

  function showEntryError(msg) {
    entryErrorMsg.textContent = msg;
    entryErrorMsg.classList.remove('hidden');
  }

  function handleSwitchTeam() {
    if (!confirm('Are you sure you want to switch teams? Your current session will end.')) return;
    localStorage.removeItem('spinquest_team_session');
    localStorage.removeItem('spinquest_team_spin_count');
    teamSession = null;
    teamSpinCount = 0;
    entryTeamId.value = '';
    entryTeamName.value = '';
    entryGithubLink.value = '';
    showEntryGate();
  }

  // ─── DOMAIN API ─────────────────────────────────────────────────────────────
  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      domains = data.domains;
      if (!domains.find(d => d.name.toLowerCase() === activeDomain.toLowerCase()) && domains.length > 0) {
        activeDomain = domains[0].name;
      }
      renderDomains();
      updateActiveDomainUI();
      updateCycleDisplay();
      populateExploreFilter();
      drawWheel();
    } catch (err) {
      showToast('Failed to load domains: ' + err.message, 'error');
    }
  }

  function renderDomains() {
    domainListContainer.innerHTML = '';
    domains.forEach(d => {
      const theme = getDomainTheme(d.name);
      const isAct = d.name.toLowerCase() === activeDomain.toLowerCase();
      const item = document.createElement('div');
      item.className = `domain-item ${isAct ? 'active' : ''}`;
      item.innerHTML = `
        <div class="domain-item-left">
          <span class="domain-icon">${theme.icon}</span>
          <span class="domain-name">${escapeHTML(d.name)}</span>
        </div>
        <div class="domain-item-right">
          <span class="domain-count-badge">${d.count} PS</span>
        </div>
      `;
      item.addEventListener('click', () => selectDomain(d.name));
      domainListContainer.appendChild(item);
    });
  }

  function selectDomain(name) {
    activeDomain = name;
    updateActiveDomainUI();
    renderDomains();
    updateCycleDisplay();
    drawWheel();
  }

  function updateActiveDomainUI() {
    navActiveDomainText.textContent = activeDomain;
    spinDomainTarget.textContent = activeDomain;
    spinStatusMessage.innerHTML = `Ready to spin for <strong>${escapeHTML(activeDomain)}</strong>`;
  }

  function populateExploreFilter() {
    exploreDomainFilter.innerHTML = '<option value="All">All Domains</option>';
    domains.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = `${d.name} (${d.count} PS)`;
      exploreDomainFilter.appendChild(opt);
    });
  }

  // ─── CYCLE TRACKER ──────────────────────────────────────────────────────────
  function getSeenList(domain) {
    if (!seenProblems[domain]) seenProblems[domain] = [];
    return seenProblems[domain];
  }

  function addSeenProblem(domain, problemId) {
    const list = getSeenList(domain);
    if (!list.includes(problemId)) {
      list.push(problemId);
      seenProblems[domain] = list;
      localStorage.setItem('spinquest_seen_problems', JSON.stringify(seenProblems));
    }
    updateCycleDisplay();
  }

  function resetCycle(domain) {
    seenProblems[domain] = [];
    localStorage.setItem('spinquest_seen_problems', JSON.stringify(seenProblems));
    updateCycleDisplay();
    showToast(`Cycle reset for ${domain}! All problems are now available.`, 'info');
  }

  function updateCycleDisplay() {
    const currentDomainObj = domains.find(d => d.name.toLowerCase() === activeDomain.toLowerCase());
    const total = currentDomainObj ? currentDomainObj.count : 0;
    const seen = getSeenList(activeDomain).length;
    const remaining = Math.max(0, total - seen);
    const percent = total > 0 ? Math.min(100, Math.round((seen / total) * 100)) : 0;
    cycleProgressBar.style.width = `${percent}%`;
    cycleCountText.textContent = `${seen} / ${total} seen`;
    cycleRemainingText.textContent = `${remaining} remaining in cycle`;
  }

  // ─── CANVAS WHEEL ───────────────────────────────────────────────────────────
  let ctx = null;
  const numSlices = 12;

  function setupCanvas() {
    ctx = wheelCanvas.getContext('2d');
  }

  function drawWheel() {
    if (!ctx) return;
    const width = wheelCanvas.width;
    const center = width / 2;
    const radius = center - 16;
    ctx.clearRect(0, 0, width, width);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentAngle);
    const sliceAngle = (Math.PI * 2) / numSlices;
    const activeTheme = getDomainTheme(activeDomain);
    const palette = [
      activeTheme.color, '#1e293b', activeTheme.dark, '#334155',
      activeTheme.color, '#0f172a', '#64748b', activeTheme.dark,
      activeTheme.color, '#1e293b', '#475569', '#0f172a'
    ];
    for (let i = 0; i < numSlices; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle); ctx.closePath();
      ctx.fillStyle = palette[i % palette.length]; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.stroke();
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Plus Jakarta Sans, sans-serif';
      const label = (i % 2 === 0) ? `${activeTheme.icon} PS #${i + 1}` : `✨ CHALLENGE`;
      ctx.fillText(label, radius - 24, 5);
      ctx.beginPath();
      ctx.arc(radius - 8, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = (i % 2 === 0) ? '#38bdf8' : '#f43f5e';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 8; ctx.strokeStyle = '#2a3a52'; ctx.stroke();
    ctx.restore();
  }

  // ─── SPIN LOGIC ─────────────────────────────────────────────────────────────
  async function triggerSpin() {
    if (isSpinning) return;
    const seenIds = getSeenList(activeDomain);
    spinStatusMessage.innerHTML = `🎲 Rolling problem statement from <strong>${escapeHTML(activeDomain)}</strong>...`;
    isSpinning = true;
    spinMainBtn.disabled = true;
    spinCenterBtn.style.pointerEvents = 'none';
    try {
      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: activeDomain, seenIds })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to draw problem statement');
      }
      const spinResult = await response.json();
      startWheelAnimation(() => onSpinComplete(spinResult));
    } catch (err) {
      isSpinning = false;
      spinMainBtn.disabled = false;
      spinCenterBtn.style.pointerEvents = 'auto';
      spinStatusMessage.innerHTML = `⚠️ Error: ${err.message}`;
      showToast(err.message, 'error');
    }
  }

  function startWheelAnimation(onFinish) {
    const totalRotations = 5 + Math.random() * 4;
    const targetDelta = totalRotations * Math.PI * 2 + (Math.random() * Math.PI * 2);
    const startAngle = currentAngle;
    const finalAngle = startAngle + targetDelta;
    const duration = 3800;
    const startTime = performance.now();
    let lastTickAngle = currentAngle;

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 4);
      currentAngle = startAngle + targetDelta * ease;
      const sliceAngle = (Math.PI * 2) / numSlices;
      if (Math.abs(currentAngle - lastTickAngle) >= sliceAngle) {
        lastTickAngle = currentAngle;
        playTickSound();
        if (wheelPointer) {
          wheelPointer.classList.add('tick');
          setTimeout(() => wheelPointer && wheelPointer.classList.remove('tick'), 50);
        }
      }
      drawWheel();
      if (progress < 1) {
        spinAnimationFrame = requestAnimationFrame(animate);
      } else {
        isSpinning = false;
        spinMainBtn.disabled = false;
        spinCenterBtn.style.pointerEvents = 'auto';
        if (onFinish) onFinish();
      }
    }
    spinAnimationFrame = requestAnimationFrame(animate);
  }

  async function onSpinComplete(result) {
    const { problem, cycleCompleted, totalInDomain, remainingInCycle } = result;

    if (window.confetti) {
      window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    if (cycleCompleted) {
      seenProblems[activeDomain] = [problem.id];
      cycleCompletionAlert.classList.remove('hidden');
    } else {
      addSeenProblem(activeDomain, problem.id);
      cycleCompletionAlert.classList.add('hidden');
    }
    localStorage.setItem('spinquest_seen_problems', JSON.stringify(seenProblems));
    updateCycleDisplay();

    // Log spin to team session
    if (teamSession && teamSession.sessionToken) {
      try {
        await fetch('/api/team/log-spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: teamSession.sessionToken, domain: activeDomain, problem })
        });
        teamSpinCount++;
        localStorage.setItem('spinquest_team_spin_count', String(teamSpinCount));
        teamInfoSpins.textContent = teamSpinCount;
      } catch (e) {
        // Non-fatal: spin still shows
      }
    }

    addRecentSpin(problem);

    // Populate modal
    modalDomainTag.textContent = problem.domain;
    modalDifficultyTag.textContent = problem.difficulty || 'Intermediate';
    modalSourceTag.textContent = `Source: ${problem.source || 'Default'}`;
    modalProblemTitle.textContent = problem.title;
    modalProblemDescription.textContent = problem.description;

    modalTagsContainer.innerHTML = '';
    if (problem.tags && problem.tags.length > 0) {
      problem.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag-badge';
        span.textContent = '#' + t;
        modalTagsContainer.appendChild(span);
      });
    }

    const currentSeenCount = getSeenList(activeDomain).length;
    modalCycleStatusText.textContent = `Cycle Progress: ${currentSeenCount} of ${totalInDomain} drawn (${remainingInCycle} remaining)`;

    openModal(problemModal);
    spinStatusMessage.innerHTML = `Result: <strong>${escapeHTML(problem.title)}</strong>`;
  }

  // ─── RECENT SPINS ───────────────────────────────────────────────────────────
  function addRecentSpin(problem) {
    recentSpins.unshift({
      id: problem.id, title: problem.title, domain: problem.domain,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (recentSpins.length > 10) recentSpins.pop();
    localStorage.setItem('spinquest_recent_spins', JSON.stringify(recentSpins));
    renderRecentSpins();
  }

  function renderRecentSpins() {
    if (recentSpins.length === 0) {
      recentSpinsList.innerHTML = `<div class="empty-state">No spins yet. Choose a domain and spin!</div>`;
      return;
    }
    recentSpinsList.innerHTML = '';
    recentSpins.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-item-top">
          <span class="history-domain">${escapeHTML(item.domain)}</span>
          <span class="history-time">${item.time}</span>
        </div>
        <div class="history-title">${escapeHTML(item.title)}</div>
      `;
      recentSpinsList.appendChild(el);
    });
  }

  // ─── EXPLORE MODAL ──────────────────────────────────────────────────────────
  async function loadExploreProblems() {
    const search = exploreSearchInput.value.trim();
    const domain = exploreDomainFilter.value;
    let url = `/api/problems?domain=${encodeURIComponent(domain)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      renderExploreTable(data.problems);
    } catch (err) {
      exploreProblemsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#f43f5e;">Error loading problems</td></tr>`;
    }
  }

  function renderExploreTable(problems) {
    if (problems.length === 0) {
      exploreProblemsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#64748b;">No problem statements found.</td></tr>`;
      return;
    }
    exploreProblemsTableBody.innerHTML = '';
    problems.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="domain-tag" style="font-size:0.7rem;">${escapeHTML(p.domain)}</span></td>
        <td>
          <strong style="color:#ffffff;">${escapeHTML(p.title)}</strong>
          <p style="font-size:0.75rem;color:#94a3b8;margin-top:4px;max-width:380px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHTML(p.description)}</p>
        </td>
        <td><span class="difficulty-tag" style="font-size:0.7rem;">${p.difficulty || 'Intermediate'}</span></td>
        <td style="font-size:0.75rem;color:#64748b;">${escapeHTML(p.source || 'Default')}</td>
      `;
      exploreProblemsTableBody.appendChild(tr);
    });
  }

  // ─── MODALS ─────────────────────────────────────────────────────────────────
  function openModal(modal) { modal.classList.remove('hidden'); }
  function closeModal(modal) { modal.classList.add('hidden'); }

  // ─── EVENT LISTENERS ────────────────────────────────────────────────────────
  function setupEventListeners() {
    teamEntryForm.addEventListener('submit', handleTeamRegister);
    switchTeamBtn.addEventListener('click', handleSwitchTeam);

    spinCenterBtn.addEventListener('click', triggerSpin);
    spinMainBtn.addEventListener('click', triggerSpin);

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        triggerSpin();
      }
    });

    resetCycleBtn.addEventListener('click', () => resetCycle(activeDomain));

    closeProblemModal.addEventListener('click', () => closeModal(problemModal));
    if (dismissProblemModalBtn) dismissProblemModalBtn.addEventListener('click', () => closeModal(problemModal));

    copyProblemBtn.addEventListener('click', () => {
      const text = `[${activeDomain}] ${modalProblemTitle.textContent}\n\n${modalProblemDescription.textContent}`;
      navigator.clipboard.writeText(text)
        .then(() => showToast('Problem statement copied to clipboard! 📋', 'success'))
        .catch(() => showToast('Could not copy to clipboard', 'error'));
    });

    viewProblemsBtn.addEventListener('click', () => {
      openModal(exploreModal);
      loadExploreProblems();
    });

    closeExploreModal.addEventListener('click', () => closeModal(exploreModal));
    exploreSearchInput.addEventListener('input', debounce(loadExploreProblems, 300));
    exploreDomainFilter.addEventListener('change', loadExploreProblems);

    [problemModal, exploreModal].forEach(modal => {
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
    });
  }

  // ─── UTILITIES ──────────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
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
