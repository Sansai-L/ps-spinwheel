// SpinQuest PS — User Application Logic
(function () {
  'use strict';

  // ─── STATE ──────────────────────────────────────────────────────────────────
  let domains = [];
  let activeDomain = 'Artificial Intelligence & ML';
  let seenProblems = JSON.parse(localStorage.getItem('spinquest_seen_problems') || '{}');
  let recentSpins = JSON.parse(localStorage.getItem('spinquest_recent_spins') || '[]');
  let teamSession = JSON.parse(localStorage.getItem('spinquest_team_session') || 'null');
  let teamHasSpun = false;
  let assignedProblem = null;
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
  const keyboardHint = document.getElementById('keyboardHint');

  const assignedProblemCard = document.getElementById('assignedProblemCard');
  const assignedCardDomain = document.getElementById('assignedCardDomain');
  const assignedCardTitle = document.getElementById('assignedCardTitle');
  const assignedCardDesc = document.getElementById('assignedCardDesc');
  const assignedCardProblem = document.getElementById('assignedCardProblem');
  const assignedCardSolution = document.getElementById('assignedCardSolution');
  const assignedCardDownloadPdfBtn = document.getElementById('assignedCardDownloadPdfBtn');
  const assignedCardViewBtn = document.getElementById('assignedCardViewBtn');

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
  const teamSpinStatusBadge = document.getElementById('teamSpinStatusBadge');
  const teamSidebarPdfBox = document.getElementById('teamSidebarPdfBox');
  const teamSidebarDownloadPdfBtn = document.getElementById('teamSidebarDownloadPdfBtn');

  const recentSpinsList = document.getElementById('recentSpinsList');
  const viewProblemsBtn = document.getElementById('viewProblemsBtn');

  const problemModal = document.getElementById('problemModal');
  const closeProblemModal = document.getElementById('closeProblemModal');
  const modalDomainTag = document.getElementById('modalDomainTag');
  const modalDifficultyTag = document.getElementById('modalDifficultyTag');
  const modalSourceTag = document.getElementById('modalSourceTag');
  const modalProblemTitle = document.getElementById('modalProblemTitle');
  const modalProblemDescription = document.getElementById('modalProblemDescription');
  const modalProblemText = document.getElementById('modalProblemText');
  const modalSolutionText = document.getElementById('modalSolutionText');
  const modalTagsContainer = document.getElementById('modalTagsContainer');
  const modalCycleStatusText = document.getElementById('modalCycleStatusText');
  const cycleCompletionAlert = document.getElementById('cycleCompletionAlert');
  const copyProblemBtn = document.getElementById('copyProblemBtn');
  const modalDownloadPdfBtn = document.getElementById('modalDownloadPdfBtn');
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
      // Resume existing session & verify status
      await verifyAndResumeSession();
    } else {
      showEntryGate();
    }
  }

  async function verifyAndResumeSession() {
    try {
      const res = await fetch(`/api/team/status?sessionToken=${encodeURIComponent(teamSession.sessionToken)}`);
      if (res.ok) {
        const data = await res.json();
        teamSession.team = data.team;
        teamHasSpun = data.hasSpun;
        assignedProblem = data.assignedProblem;
        teamSession.hasSpun = teamHasSpun;
        teamSession.assignedProblem = assignedProblem;
        localStorage.setItem('spinquest_team_session', JSON.stringify(teamSession));
        showMainApp(data.team);
      } else {
        // Fallback to local session
        teamHasSpun = Boolean(teamSession.hasSpun);
        assignedProblem = teamSession.assignedProblem || null;
        showMainApp(teamSession.team);
      }

      // Auto-sync problem allocation with server database
      if (teamHasSpun && assignedProblem && teamSession?.team?.teamId) {
        fetch('/api/team/sync-spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: teamSession.team.teamId,
            domain: assignedProblem.domain || activeDomain,
            problem: assignedProblem,
            githubLink: teamSession.team.githubLink || ''
          })
        }).catch(() => {});
      }
    } catch (e) {
      teamHasSpun = Boolean(teamSession.hasSpun);
      assignedProblem = teamSession.assignedProblem || null;
      showMainApp(teamSession.team);
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
    if (team && team.domain) {
      activeDomain = team.domain;
    }
    fetchDomains();

    if (team && team.isAdmin) {
      unlockWheel();
      if (assignedProblem) {
        assignedCardDomain.textContent = assignedProblem.domain;
        assignedCardTitle.textContent = assignedProblem.title;
        assignedCardDesc.textContent = assignedProblem.description;
        assignedProblemCard.classList.remove('hidden');
        teamSidebarPdfBox.classList.remove('hidden');
        renderAssignedProblemList(assignedProblem);
      }
    } else if (teamHasSpun && assignedProblem) {
      lockWheelForAssignedProblem(assignedProblem);
    } else {
      unlockWheel();
    }
  }

  function renderTeamInfo(team) {
    teamNavName.textContent = team.teamName;
    teamInfoId.textContent = team.teamId;
    teamInfoName.textContent = team.teamName;
    if (team.githubLink) {
      teamInfoGithub.textContent = team.githubLink;
      teamInfoGithub.href = team.githubLink;
      teamGithubRow.style.display = 'flex';
    } else {
      teamGithubRow.style.display = 'none';
    }

    if (team && team.isAdmin) {
      teamSpinStatusBadge.textContent = 'Admin Mode (Unlimited Spins)';
      teamSpinStatusBadge.style.color = '#a855f7';
      if (assignedProblem) {
        teamSidebarPdfBox.classList.remove('hidden');
      } else {
        teamSidebarPdfBox.classList.add('hidden');
      }
    } else if (teamHasSpun) {
      teamSpinStatusBadge.textContent = '1 / 1 (Used)';
      teamSpinStatusBadge.style.color = '#38bdf8';
      teamSidebarPdfBox.classList.remove('hidden');
    } else {
      teamSpinStatusBadge.textContent = '0 / 1 (Available)';
      teamSpinStatusBadge.style.color = 'var(--accent-emerald)';
      teamSidebarPdfBox.classList.add('hidden');
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

    if (!teamId) { showEntryError('Please enter your Reg ID / Team ID.'); return; }

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

      teamHasSpun = Boolean(data.hasSpun);
      assignedProblem = data.assignedProblem || null;

      teamSession = {
        sessionToken: data.sessionToken,
        team: data.team,
        hasSpun: teamHasSpun,
        assignedProblem: assignedProblem
      };
      localStorage.setItem('spinquest_team_session', JSON.stringify(teamSession));

      if (data.isReturning) {
        if (data.team && data.team.isAdmin) {
          showToast(`Welcome back, Admin! ⚡ Main page test access granted.`, 'info');
        } else if (teamHasSpun) {
          showToast(`Welcome back, ${data.team.teamName}! Your assigned problem statement is ready. 📄`, 'info');
        } else {
          showToast(`Welcome back, ${data.team.teamName}! You have 1 spin available. ⚡`, 'info');
        }
      } else {
        if (data.team && data.team.isAdmin) {
          showToast(`Welcome Admin! ⚡ Main page test access granted.`, 'success');
        } else {
          showToast(`Welcome, ${data.team.teamName}! 🚀 You have 1 spin to draw your challenge.`, 'success');
        }
      }

      showMainApp(data.team);
    } catch (err) {
      showEntryError(err.message);
    } finally {
      entrySubmitLabel.textContent = 'Verify & Enter';
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
    teamSession = null;
    teamHasSpun = false;
    assignedProblem = null;
    entryTeamId.value = '';
    entryTeamName.value = '';
    entryGithubLink.value = '';
    unlockWheel();
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
      item.addEventListener('click', () => {
        if (teamHasSpun) {
          showToast('Domain is locked because your team has already drawn a problem statement.', 'info');
          return;
        }
        selectDomain(d.name);
      });
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
    if (!teamHasSpun) {
      spinStatusMessage.innerHTML = `Ready to spin for <strong>${escapeHTML(activeDomain)}</strong> (1 spin limit)`;
    }
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
    if (teamHasSpun) {
      showToast('Cycle is locked. Your team has already drawn its challenge.', 'info');
      return;
    }
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
    if (cycleProgressBar) cycleProgressBar.style.width = `${percent}%`;
    if (cycleCountText) cycleCountText.textContent = `${seen} / ${total} seen`;
    if (cycleRemainingText) cycleRemainingText.textContent = `${remaining} remaining in cycle`;
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

  // ─── EXTRACT STRUCTURED PROBLEM DETAILS (Title | Problem | Expected Solution) ─
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
      domain: problem.domain || activeDomain || 'Hackathon Track',
      difficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
      tags: problem.tags || []
    };
  }

  // ─── LOCK / UNLOCK 1-SPIN SYSTEM ──────────────────────────────────────────
  function lockWheelForAssignedProblem(problem) {
    teamHasSpun = true;
    assignedProblem = problem;
    const parts = extractProblemParts(problem);

    // Center Stage Controls Lock
    spinMainBtn.disabled = true;
    spinMainBtn.classList.add('btn-locked');
    spinMainBtn.innerHTML = `<span>🔒 PROBLEM ASSIGNED (1/1 SPIN USED)</span>`;
    spinCenterBtn.classList.add('center-btn-locked');
    spinStatusMessage.innerHTML = `🔒 Official Allocation: <strong>${escapeHTML(parts.title)}</strong>`;
    keyboardHint.textContent = '🔒 Spin completed. Each team receives strictly 1 problem statement.';

    // Show Allocated Challenge Card with Title, Problem & Expected Solution
    assignedCardDomain.textContent = parts.domain;
    assignedCardTitle.textContent = parts.title;
    if (assignedCardProblem) assignedCardProblem.textContent = parts.problem;
    if (assignedCardSolution) assignedCardSolution.textContent = parts.expectedSolution;
    if (assignedCardDesc) assignedCardDesc.textContent = parts.problem;
    assignedProblemCard.classList.remove('hidden');

    // Sidebar Team Info
    teamSpinStatusBadge.textContent = '1 / 1 (Used)';
    teamSpinStatusBadge.style.color = '#38bdf8';
    teamSidebarPdfBox.classList.remove('hidden');

    // Show in Assigned Problem List
    renderAssignedProblemList(problem);
  }

  function unlockWheel() {
    teamHasSpun = false;
    assignedProblem = null;
    spinMainBtn.disabled = false;
    spinMainBtn.classList.remove('btn-locked');
    spinMainBtn.innerHTML = `<span class="btn-icon">⚡</span><span>SPIN PROBLEM WHEEL</span>`;
    spinCenterBtn.classList.remove('center-btn-locked');
    keyboardHint.innerHTML = 'Tip: Press <kbd>Spacebar</kbd> anytime to spin! (1 spin allowed)';
    assignedProblemCard.classList.add('hidden');
    teamSpinStatusBadge.textContent = '0 / 1 (Available)';
    teamSpinStatusBadge.style.color = 'var(--accent-emerald)';
    teamSidebarPdfBox.classList.add('hidden');
    recentSpinsList.innerHTML = `<div class="empty-state">No spins yet. Choose a domain and spin! (1 spin allowed)</div>`;
  }

  function renderAssignedProblemList(problem) {
    recentSpinsList.innerHTML = `
      <div class="history-item" style="border-left: 3px solid var(--accent-cyan); background: rgba(6,182,212,0.06);">
        <div class="history-item-top">
          <span class="history-domain">${escapeHTML(problem.domain)}</span>
          <span class="history-time" style="color:#38bdf8;">Assigned</span>
        </div>
        <div class="history-title" style="font-weight:700;">${escapeHTML(problem.title)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
          Difficulty: ${escapeHTML(problem.difficulty || 'Intermediate')}
        </div>
      </div>
    `;
  }

  // ─── SPIN LOGIC ─────────────────────────────────────────────────────────────
  async function triggerSpin() {
    if (isSpinning) return;
    const isAdmin = Boolean(teamSession?.team?.isAdmin);
    if (teamHasSpun && !isAdmin) {
      showToast('Your team has already completed its 1 allowed spin! 🔒', 'info');
      if (assignedProblem) openProblemModal(assignedProblem);
      return;
    }

    const seenIds = getSeenList(activeDomain);
    spinStatusMessage.innerHTML = `🎲 Rolling problem statement from <strong>${escapeHTML(activeDomain)}</strong>...`;
    isSpinning = true;
    spinMainBtn.disabled = true;
    spinCenterBtn.style.pointerEvents = 'none';

    try {
      const response = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: activeDomain,
          seenIds,
          sessionToken: teamSession ? teamSession.sessionToken : null,
          teamId: teamSession ? teamSession.team?.teamId : null
        })
      });

      const spinResult = await response.json();

      if (!response.ok) {
        // 429 = spin lock (concurrent request) — retry once after a short delay
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, 1500));
          isSpinning = false;
          spinMainBtn.disabled = false;
          spinCenterBtn.style.pointerEvents = 'auto';
          triggerSpin();
          return;
        }
        if (spinResult.alreadySpun && spinResult.problem) {
          lockWheelForAssignedProblem(spinResult.problem);
          throw new Error(spinResult.error || 'Your team has already drawn a problem statement.');
        }
        throw new Error(spinResult.error || 'Failed to draw problem statement');
      }

      startWheelAnimation(() => onSpinComplete(spinResult));
    } catch (err) {
      isSpinning = false;
      if (!teamHasSpun) {
        spinMainBtn.disabled = false;
        spinCenterBtn.style.pointerEvents = 'auto';
        spinStatusMessage.innerHTML = `⚠️ Error: ${err.message}`;
      }
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
        if (onFinish) onFinish();
      }
    }
    spinAnimationFrame = requestAnimationFrame(animate);
  }

  async function onSpinComplete(result) {
    const { problem, cycleCompleted, totalInDomain, remainingInCycle } = result;

    if (window.confetti) {
      window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
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

    // Log spin permanently to team record
    if (teamSession && (teamSession.sessionToken || teamSession.team?.teamId)) {
      try {
        await fetch('/api/team/log-spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: teamSession.sessionToken,
            teamId: teamSession.team?.teamId,
            teamName: teamSession.team?.teamName,
            domain: activeDomain,
            problem
          })
        });
      } catch (e) {
        // Non-fatal fallback
      }
    }

    // Lock permanently to 1 spin (regular teams only; admin can test multiple spins)
    const isAdmin = Boolean(teamSession?.team?.isAdmin);
    assignedProblem = problem;

    if (!isAdmin) {
      teamHasSpun = true;
      if (teamSession) {
        teamSession.hasSpun = true;
        teamSession.assignedProblem = problem;
        localStorage.setItem('spinquest_team_session', JSON.stringify(teamSession));
      }
      lockWheelForAssignedProblem(problem);
    } else {
      teamHasSpun = false;
      if (teamSession) {
        teamSession.hasSpun = false;
        teamSession.assignedProblem = problem;
        localStorage.setItem('spinquest_team_session', JSON.stringify(teamSession));
      }
      const parts = extractProblemParts(problem);
      assignedCardDomain.textContent = parts.domain;
      assignedCardTitle.textContent = parts.title;
      if (assignedCardProblem) assignedCardProblem.textContent = parts.problem;
      if (assignedCardSolution) assignedCardSolution.textContent = parts.expectedSolution;
      if (assignedCardDesc) assignedCardDesc.textContent = parts.problem;
      assignedProblemCard.classList.remove('hidden');
      teamSidebarPdfBox.classList.remove('hidden');
      renderAssignedProblemList(problem);
      spinMainBtn.disabled = false;
      spinCenterBtn.style.pointerEvents = 'auto';
      spinStatusMessage.innerHTML = `✅ Test Allocation: <strong>${escapeHTML(parts.title)}</strong> (Admin can spin again)`;
    }

    openProblemModal(problem);
    showToast('Challenge officially allocated! You can now download your PDF. 📄', 'success');
  }

  // ─── PROBLEM MODAL ──────────────────────────────────────────────────────────
  function openProblemModal(problem) {
    const parts = extractProblemParts(problem);
    modalDomainTag.textContent = parts.domain;
    modalDifficultyTag.textContent = parts.difficulty;
    modalSourceTag.textContent = `1/1 Spin Allocated`;
    modalProblemTitle.textContent = parts.title;

    if (modalProblemText) modalProblemText.textContent = parts.problem;
    if (modalSolutionText) modalSolutionText.textContent = parts.expectedSolution;
    if (modalProblemDescription) modalProblemDescription.textContent = `Problem:\n${parts.problem}\n\nExpected Solution:\n${parts.expectedSolution}`;

    modalTagsContainer.innerHTML = '';
    if (parts.tags && parts.tags.length > 0) {
      parts.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag-badge';
        span.textContent = '#' + t;
        modalTagsContainer.appendChild(span);
      });
    }

    modalCycleStatusText.textContent = `Official Hackathon Allocation for ${teamSession?.team?.teamName || 'Your Team'}`;
    openModal(problemModal);
  }

  // ─── VISITOR PDF DOWNLOAD ──────────────────────────────────────────────────
  function printProblemCertificate(team, problem) {
    try {
      const printWin = window.open('', '_blank');
      if (!printWin) {
        showToast('Please allow popups to open and save your problem statement PDF.', 'info');
        return;
      }
      const teamName = team?.teamName || 'Team';
      const teamId = team?.teamId || 'N/A';
      const leader = team?.leader || '';
      const college = team?.college || '';
      const members = team?.members || '';
      const githubLink = team?.githubLink || 'Not provided';

      const parts = extractProblemParts(problem);
      const title = parts.title;
      const probText = parts.problem;
      const solText = parts.expectedSolution;
      const domain = parts.domain || activeDomain || 'Hackathon Track';
      const diff = parts.difficulty || 'Intermediate';
      const tags = (parts.tags && parts.tags.length) ? ('#' + parts.tags.join('   #')) : '';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Problem-Statement-${escapeHTML(teamId)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #0f172a; padding: 32px; max-width: 820px; margin: 0 auto; }
    .header { background: #0a0d14; color: #fff; padding: 22px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
    .header h1 { font-size: 24px; color: #06b6d4; letter-spacing: 1px; }
    .header p { font-size: 13px; color: #94a3b8; margin-top: 5px; }
    .badge { display: inline-block; background: #1e293b; color: #38bdf8; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-top: 8px; letter-spacing: 0.5px; }
    
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f8fafc; }
    .box-title { font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase; margin-bottom: 6px; }
    .team-name { font-size: 16px; font-weight: 700; color: #0f172a; }
    .team-meta { font-size: 12.5px; color: #475569; margin-top: 4px; line-height: 1.5; }
    
    .domain-bar { background: #1e293b; color: #fff; padding: 10px 16px; border-radius: 6px; font-size: 12.5px; font-weight: 600; display: flex; justify-content: space-between; margin-bottom: 16px; }
    .domain-title { color: #38bdf8; }
    
    .title-card { background: #f1f5f9; border: 1px solid #94a3b8; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
    .title-label { font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .title-text { font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.35; }
    
    .section-card { border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; }
    .card-problem { background: #f0f9ff; border: 1.5px solid #38bdf8; border-left: 5px solid #0284c7; }
    .card-solution { background: #ecfdf5; border: 1.5px solid #10b981; border-left: 5px solid #059669; }
    
    .card-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .label-problem { color: #0369a1; }
    .label-solution { color: #047857; }
    
    .card-content { font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-line; }
    
    .tags { font-size: 12px; color: #475569; font-weight: 600; margin-bottom: 16px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; }
    .rules { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; font-size: 11.5px; color: #92400e; line-height: 1.6; }
    .footer { text-align: center; margin-top: 24px; font-size: 10.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print {
      body { padding: 8px; }
      @page { margin: 1cm; size: A4; }
      .section-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CODIENYCH 1.0</h1>
    <p>Official Problem Statement Allocation Certificate</p>
    <div class="badge">VERIFIED HACKATHON ALLOCATION • 1 OF 1 PROBLEM ASSIGNMENT</div>
  </div>

  <div class="box">
    <div class="box-title">Registered Team Details (CODIENYCH 1.0)</div>
    <div class="team-name">${escapeHTML(teamName)}</div>
    <div class="team-meta">
      <strong>Reg ID:</strong> ${escapeHTML(teamId)} &nbsp;|&nbsp; <strong>Leader:</strong> ${escapeHTML(leader || 'Team Leader')} ${college ? `&nbsp;|&nbsp; <strong>College:</strong> ${escapeHTML(college)}` : ''}
      ${members ? `<br><strong>Members:</strong> ${escapeHTML(members)}` : ''}
      ${githubLink && githubLink !== 'Not provided' ? `<br><strong>GitHub:</strong> ${escapeHTML(githubLink)}` : ''}
    </div>
  </div>

  <div class="domain-bar">
    <span class="domain-title">Domain: ${escapeHTML(domain)}</span>
    <span>Difficulty: ${escapeHTML(diff)}</span>
  </div>

  <div class="title-card">
    <div class="title-label">ASSIGNED PROBLEM TITLE:</div>
    <div class="title-text">${escapeHTML(title)}</div>
  </div>

  <div class="section-card card-problem">
    <div class="card-label label-problem">📌 1. PROBLEM STATEMENT</div>
    <div class="card-content">${escapeHTML(probText)}</div>
  </div>

  <div class="section-card card-solution">
    <div class="card-label label-solution">💡 2. EXPECTED SOLUTION &amp; DELIVERABLES</div>
    <div class="card-content">${escapeHTML(solText)}</div>
  </div>

  ${tags ? `<div class="tags">Recommended Tech / Tags: ${escapeHTML(tags)}</div>` : ''}

  <div class="rules">
    <strong>📋 Competition Guidelines &amp; Submission Criteria:</strong><br>
    • Single Problem Allocation: Each team is granted strictly 1 spin and 1 problem statement.<br>
    • Version Control: Commit all project code, documentation, and architecture diagrams to your Git repository.<br>
    • Authenticity: Solution must be conceptualized and coded exclusively during this hackathon event.<br>
    • Evaluation Metrics: Innovation, problem coverage, engineering quality, usability, and presentation.
  </div>

  <div class="footer">
    Official Document • Team: ${escapeHTML(teamName)} (${escapeHTML(teamId)}) • Generated for Hackathon Submission
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 200);
    };
  </script>
</body>
</html>`;
      printWin.document.write(html);
      printWin.document.close();
      showToast('Print dialog opened. Select "Save as PDF" to save! 📄', 'success');
    } catch (e) {
      console.error('Error opening print certificate:', e);
    }
  }

  function downloadProblemPdf() {
    if (!teamSession) {
      showToast('Session expired. Please register your team first.', 'error');
      return;
    }
    const currentProblem = assignedProblem || (teamSession && teamSession.assignedProblem);
    if (!currentProblem) {
      showToast('Please spin the wheel first to receive a problem statement!', 'info');
      return;
    }

    showToast('Generating official Problem Statement PDF... 📄', 'info');

    const teamIdClean = (teamSession.team?.teamId || 'Team').replace(/[^a-zA-Z0-9_-]/g, '_');
    const bodyData = {
      sessionToken: teamSession.sessionToken,
      teamId: teamSession.team?.teamId,
      teamName: teamSession.team?.teamName,
      githubLink: teamSession.team?.githubLink,
      problem: currentProblem
    };

    fetch('/api/team/problem-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    })
      .then(async res => {
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || 'Server error while generating PDF');
        }
        return res.blob();
      })
      .then(blob => {
        if (blob.size < 100) {
          throw new Error('Downloaded PDF content was empty');
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Problem-Statement-${teamIdClean}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        showToast('PDF downloaded successfully! 📥 Good luck with your project!', 'success');
      })
      .catch(err => {
        console.warn('Direct PDF download hit an issue, launching print certificate fallback:', err.message);
        printProblemCertificate(teamSession.team, currentProblem);
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
    if (wheelCanvas) wheelCanvas.addEventListener('click', triggerSpin);

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        triggerSpin();
      }
    });

    if (resetCycleBtn) resetCycleBtn.addEventListener('click', () => resetCycle(activeDomain));

    // PDF Download handlers
    modalDownloadPdfBtn.addEventListener('click', downloadProblemPdf);
    assignedCardDownloadPdfBtn.addEventListener('click', downloadProblemPdf);
    teamSidebarDownloadPdfBtn.addEventListener('click', downloadProblemPdf);

    // View full statement from card
    assignedCardViewBtn.addEventListener('click', () => {
      if (assignedProblem) openProblemModal(assignedProblem);
    });

    closeProblemModal.addEventListener('click', () => closeModal(problemModal));
    if (dismissProblemModalBtn) dismissProblemModalBtn.addEventListener('click', () => closeModal(problemModal));

    copyProblemBtn.addEventListener('click', () => {
      const parts = extractProblemParts(assignedProblem || (teamSession && teamSession.assignedProblem));
      const text = `[${parts.domain}] ${parts.title}\n\nPROBLEM STATEMENT:\n${parts.problem}\n\nEXPECTED SOLUTION & DELIVERABLES:\n${parts.expectedSolution}`;
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
