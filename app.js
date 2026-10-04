// SpinQuest Application Client Logic
(function() {
  'use strict';

  // --- State ---
  let domains = [];
  let activeDomain = 'Artificial Intelligence & ML';
  let adminToken = localStorage.getItem('spinquest_admin_token') || null;
  let adminUser = localStorage.getItem('spinquest_admin_user') || null;
  let seenProblems = JSON.parse(localStorage.getItem('spinquest_seen_problems') || '{}');
  let recentSpins = JSON.parse(localStorage.getItem('spinquest_recent_spins') || '[]');

  // Wheel animation state
  let isSpinning = false;
  let currentAngle = 0; // In radians
  let spinVelocity = 0;
  let spinAnimationFrame = null;

  // Web Audio Synth for Wheel Ticks
  let audioCtx = null;
  function playTickSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
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
    } catch (e) {
      // Audio autoplay may be prevented before user interaction
    }
  }

  // Domain Colors & Icons Palette
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
    // Fallback hash color
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return { name, icon: '💡', color: '#' + '00000'.substring(0, 6 - c.length) + c, dark: '#1e293b' };
  }

  // --- DOM Elements ---
  const navActiveDomainText = document.getElementById('navActiveDomainText');
  const authStatusContainer = document.getElementById('authStatusContainer');
  const domainListContainer = document.getElementById('domainListContainer');
  const spinDomainTarget = document.getElementById('spinDomainTarget');
  const spinStatusMessage = document.getElementById('spinStatusMessage');
  const spinCenterBtn = document.getElementById('spinCenterBtn');
  const spinMainBtn = document.getElementById('spinMainBtn');
  const wheelCanvas = document.getElementById('wheelCanvas');
  const wheelPointer = document.querySelector('.wheel-pointer');
  
  // Cycle elements
  const cycleProgressBar = document.getElementById('cycleProgressBar');
  const cycleCountText = document.getElementById('cycleCountText');
  const cycleRemainingText = document.getElementById('cycleRemainingText');
  const resetCycleBtn = document.getElementById('resetCycleBtn');
  
  // Upload elements
  const uploadLockBadge = document.getElementById('uploadLockBadge');
  const uploadLockedView = document.getElementById('uploadLockedView');
  const uploadUnlockedView = document.getElementById('uploadUnlockedView');
  const triggerAdminLoginFromLock = document.getElementById('triggerAdminLoginFromLock');
  const uploadDomainSelect = document.getElementById('uploadDomainSelect');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectedFileInfo = document.getElementById('selectedFileInfo');
  const selectedFileName = document.getElementById('selectedFileName');
  const removeFileBtn = document.getElementById('removeFileBtn');
  const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
  const fileUploadForm = document.getElementById('fileUploadForm');
  const openAdminManagerBtn = document.getElementById('openAdminManagerBtn');
  const resetSampleDataBtn = document.getElementById('resetSampleDataBtn');

  // History
  const recentSpinsList = document.getElementById('recentSpinsList');

  // Domain Management Elements
  const showAddDomainBtn = document.getElementById('showAddDomainBtn');
  const newDomainInlineForm = document.getElementById('newDomainInlineForm');
  const newDomainInput = document.getElementById('newDomainInput');
  const saveDomainBtn = document.getElementById('saveDomainBtn');
  const cancelDomainBtn = document.getElementById('cancelDomainBtn');
  const quickAddProblemBtn = document.getElementById('quickAddProblemBtn');

  // Problem Modal elements
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
  const modalDeleteProblemBtn = document.getElementById('modalDeleteProblemBtn');
  let currentRevealedProblemId = null;

  // Admin Login Modal
  const adminLoginModal = document.getElementById('adminLoginModal');
  const closeLoginModal = document.getElementById('closeLoginModal');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginErrorMsg = document.getElementById('loginErrorMsg');

  // Manager Modal
  const adminManagerModal = document.getElementById('adminManagerModal');
  const closeManagerModal = document.getElementById('closeManagerModal');
  const viewProblemsBtn = document.getElementById('viewProblemsBtn');
  const totalProblemsBadge = document.getElementById('totalProblemsBadge');
  const totalDocumentsBadge = document.getElementById('totalDocumentsBadge');
  const managerProblemsTableBody = document.getElementById('managerProblemsTableBody');
  const managerDocumentsTableBody = document.getElementById('managerDocumentsTableBody');
  const managerSearchInput = document.getElementById('managerSearchInput');
  const managerDomainFilter = document.getElementById('managerDomainFilter');
  const manualProblemForm = document.getElementById('manualProblemForm');
  const manualDomainSelect = document.getElementById('manualDomainSelect');
  const manualDifficultySelect = document.getElementById('manualDifficultySelect');
  const manualTitleInput = document.getElementById('manualTitleInput');
  const manualDescInput = document.getElementById('manualDescInput');
  const manualTagsInput = document.getElementById('manualTagsInput');

  // --- Initializer ---
  async function init() {
    setupCanvas();
    drawWheel();
    setupEventListeners();
    await verifyAdminStatus();
    await fetchDomains();
    renderRecentSpins();
  }

  // --- API Calls ---
  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains');
      const data = await res.json();
      domains = data.domains;
      
      // If current active domain not in list, select first
      if (!domains.find(d => d.name.toLowerCase() === activeDomain.toLowerCase()) && domains.length > 0) {
        activeDomain = domains[0].name;
      }

      renderDomains();
      updateActiveDomainUI();
      updateCycleDisplay();
      populateDomainSelects();
      drawWheel();
    } catch (err) {
      showToast('Failed to load domains: ' + err.message, 'error');
    }
  }

  async function verifyAdminStatus() {
    if (!adminToken) {
      setAdminState(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (data.valid) {
        setAdminState(true, data.username);
      } else {
        setAdminState(false);
      }
    } catch (e) {
      setAdminState(false);
    }
  }

  function setAdminState(isAdmin, username = 'admin') {
    if (isAdmin) {
      adminUser = username;
      localStorage.setItem('spinquest_admin_token', adminToken);
      localStorage.setItem('spinquest_admin_user', username);

      authStatusContainer.innerHTML = `
        <div class="active-admin-badge" style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:0.8rem; background:rgba(16,185,129,0.15); color:#34d399; padding:4px 10px; border-radius:999px; border:1px solid rgba(16,185,129,0.3); font-weight:600;">
            🛡️ Admin: ${username}
          </span>
          <button id="adminLogoutBtn" class="btn btn-secondary btn-sm">Logout</button>
        </div>
      `;
      document.getElementById('adminLogoutBtn').addEventListener('click', handleLogout);

      uploadLockBadge.textContent = '🔓 Admin Mode';
      uploadLockBadge.classList.add('unlocked');
      uploadLockedView.classList.add('hidden');
      uploadUnlockedView.classList.remove('hidden');

      if (showAddDomainBtn) showAddDomainBtn.classList.remove('hidden');
      if (quickAddProblemBtn) quickAddProblemBtn.classList.remove('hidden');
      if (modalDeleteProblemBtn) modalDeleteProblemBtn.classList.remove('hidden');
      renderDomains();
    } else {
      adminToken = null;
      adminUser = null;
      localStorage.removeItem('spinquest_admin_token');
      localStorage.removeItem('spinquest_admin_user');

      authStatusContainer.innerHTML = `
        <button id="navLoginBtn" class="btn btn-primary btn-sm">
          🔑 Admin Login
        </button>
      `;
      document.getElementById('navLoginBtn').addEventListener('click', () => openModal(adminLoginModal));

      uploadLockBadge.textContent = '🔒 Admin Only';
      uploadLockBadge.classList.remove('unlocked');
      uploadLockedView.classList.remove('hidden');
      uploadUnlockedView.classList.add('hidden');

      if (showAddDomainBtn) showAddDomainBtn.classList.add('hidden');
      if (newDomainInlineForm) newDomainInlineForm.classList.add('hidden');
      if (quickAddProblemBtn) quickAddProblemBtn.classList.add('hidden');
      if (modalDeleteProblemBtn) modalDeleteProblemBtn.classList.add('hidden');
      renderDomains();
    }
  }

  function handleLogout() {
    setAdminState(false);
    showToast('Logged out of Admin mode', 'info');
  }

  // --- Rendering UI ---
  function renderDomains() {
    domainListContainer.innerHTML = '';
    domains.forEach(d => {
      const theme = getDomainTheme(d.name);
      const isAct = d.name.toLowerCase() === activeDomain.toLowerCase();
      
      const item = document.createElement('div');
      item.className = `domain-item ${isAct ? 'active' : ''}`;
      
      const leftDiv = document.createElement('div');
      leftDiv.className = 'domain-item-left';
      leftDiv.innerHTML = `
        <span class="domain-icon">${theme.icon}</span>
        <span class="domain-name">${escapeHTML(d.name)}</span>
      `;

      const rightDiv = document.createElement('div');
      rightDiv.className = 'domain-item-right';

      const countBadge = document.createElement('span');
      countBadge.className = 'domain-count-badge';
      countBadge.textContent = `${d.count} PS`;
      rightDiv.appendChild(countBadge);

      if (adminToken) {
        const delBtn = document.createElement('button');
        delBtn.className = 'domain-delete-btn';
        delBtn.innerHTML = '🗑️';
        delBtn.title = `Delete domain "${d.name}" and its problem statements`;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteDomain(d.name, d.count);
        });
        rightDiv.appendChild(delBtn);
      }

      item.appendChild(leftDiv);
      item.appendChild(rightDiv);

      item.addEventListener('click', () => {
        selectDomain(d.name);
      });
      domainListContainer.appendChild(item);
    });
  }

  async function handleDeleteDomain(domainName, count) {
    if (!confirm(`Are you sure you want to permanently delete domain "${domainName}" and all of its ${count} problem statements?`)) {
      return;
    }
    if (!adminToken) {
      showToast('Admin login required', 'error');
      openModal(adminLoginModal);
      return;
    }
    try {
      const res = await fetch(`/api/domains/${encodeURIComponent(domainName)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete domain');

      delete seenProblems[domainName];
      localStorage.setItem('spinquest_seen_problems', JSON.stringify(seenProblems));

      showToast(data.message, 'success');
      await fetchDomains();
      if (activeDomain.toLowerCase() === domainName.toLowerCase() && domains.length > 0) {
        selectDomain(domains[0].name);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleSaveNewDomain() {
    const name = newDomainInput.value.trim();
    if (!name) {
      showToast('Please enter a domain name', 'error');
      return;
    }
    if (!adminToken) {
      showToast('Admin login required', 'error');
      openModal(adminLoginModal);
      return;
    }
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add domain');

      showToast(`Domain "${name}" created successfully!`, 'success');
      newDomainInput.value = '';
      newDomainInlineForm.classList.add('hidden');
      await fetchDomains();
      selectDomain(name);
    } catch (err) {
      showToast(err.message, 'error');
    }
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
    spinStatusMessage.innerHTML = `Ready to spin for <strong>${activeDomain}</strong>`;
  }

  function populateDomainSelects() {
    const selects = [uploadDomainSelect, managerDomainFilter, manualDomainSelect];
    selects.forEach(sel => {
      if (!sel) return;
      const currentVal = sel.value;
      if (sel === managerDomainFilter) {
        sel.innerHTML = '<option value="All">All Domains</option>';
      } else {
        sel.innerHTML = '';
      }
      domains.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.name;
        opt.textContent = `${d.name} (${d.count} PS)`;
        sel.appendChild(opt);
      });
      if (currentVal) sel.value = currentVal;
    });
  }

  // --- Cycle Tracker Management ---
  function getSeenList(domain) {
    if (!seenProblems[domain]) {
      seenProblems[domain] = [];
    }
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

  // --- Canvas Spinning Wheel ---
  let ctx = null;
  const numSlices = 12; // Visual segments on the wheel

  function setupCanvas() {
    ctx = wheelCanvas.getContext('2d');
  }

  function drawWheel() {
    if (!ctx) return;
    const width = wheelCanvas.width;
    const height = wheelCanvas.height;
    const center = width / 2;
    const radius = center - 16;

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentAngle);

    const sliceAngle = (Math.PI * 2) / numSlices;
    const activeTheme = getDomainTheme(activeDomain);

    // Color gradient variations based on active domain
    const palette = [
      activeTheme.color,
      '#1e293b',
      activeTheme.dark,
      '#334155',
      activeTheme.color,
      '#0f172a',
      '#64748b',
      activeTheme.dark,
      activeTheme.color,
      '#1e293b',
      '#475569',
      '#0f172a'
    ];

    for (let i = 0; i < numSlices; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Slice Fill
      ctx.fillStyle = palette[i % palette.length];
      ctx.fill();

      // Slice Border
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      // Slice Decorative Text / Icon
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px Plus Jakarta Sans, sans-serif';
      
      const label = (i % 2 === 0) ? `${activeTheme.icon} PS #${i + 1}` : `✨ CHALLENGE`;
      ctx.fillText(label, radius - 24, 5);

      // Outer rim LED bulb
      ctx.beginPath();
      ctx.arc(radius - 8, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = (i % 2 === 0) ? '#38bdf8' : '#f43f5e';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // Outer wheel ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#2a3a52';
    ctx.stroke();

    ctx.restore();
  }

  // Trigger Spin with non-repeating cycle fetch
  async function triggerSpin() {
    if (isSpinning) return;

    const seenIds = getSeenList(activeDomain);
    spinStatusMessage.innerHTML = `🎲 Rolling problem statement from <strong>${activeDomain}</strong>...`;
    isSpinning = true;
    spinMainBtn.disabled = true;
    spinCenterBtn.style.pointerEvents = 'none';

    try {
      // Call backend for problem statement according to non-repeating cycle logic
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

      // Run Physics Animation
      startWheelAnimation(() => {
        onSpinComplete(spinResult);
      });

    } catch (err) {
      isSpinning = false;
      spinMainBtn.disabled = false;
      spinCenterBtn.style.pointerEvents = 'auto';
      spinStatusMessage.innerHTML = `⚠️ Error: ${err.message}`;
      showToast(err.message, 'error');
    }
  }

  function startWheelAnimation(onFinish) {
    const totalRotations = 5 + Math.random() * 4; // 5 to 9 full turns
    const targetDelta = totalRotations * Math.PI * 2 + (Math.random() * Math.PI * 2);
    const startAngle = currentAngle;
    const finalAngle = startAngle + targetDelta;
    const duration = 3800; // ms
    const startTime = performance.now();
    let lastTickAngle = currentAngle;

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Quintic ease out for realistic heavy roulette spin
      const ease = 1 - Math.pow(1 - progress, 4);
      currentAngle = startAngle + targetDelta * ease;

      // Check pin tick for sound and needle wiggle
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

  function onSpinComplete(result) {
    const { problem, cycleCompleted, totalInDomain, remainingInCycle } = result;

    // Confetti celebration
    if (window.confetti) {
      window.confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    // Update cycle state
    if (cycleCompleted) {
      // If cycle completed, reset this domain's seen set then add current
      seenProblems[activeDomain] = [problem.id];
      cycleCompletionAlert.classList.remove('hidden');
    } else {
      addSeenProblem(activeDomain, problem.id);
      cycleCompletionAlert.classList.add('hidden');
    }

    localStorage.setItem('spinquest_seen_problems', JSON.stringify(seenProblems));
    updateCycleDisplay();

    // Add to recent spins history
    addRecentSpin(problem);

    // Track current revealed problem ID for deletion
    currentRevealedProblemId = problem.id;

    // Populate and open problem popup modal
    modalDomainTag.textContent = problem.domain;
    modalDifficultyTag.textContent = problem.difficulty || 'Intermediate';
    modalSourceTag.textContent = `Source: ${problem.source || 'General'}`;
    modalProblemTitle.textContent = problem.title;
    modalProblemDescription.textContent = problem.description;

    if (modalDeleteProblemBtn) {
      if (adminToken) {
        modalDeleteProblemBtn.classList.remove('hidden');
      } else {
        modalDeleteProblemBtn.classList.add('hidden');
      }
    }

    // Tags
    modalTagsContainer.innerHTML = '';
    if (problem.tags && problem.tags.length > 0) {
      problem.tags.forEach(t => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-badge';
        tagSpan.textContent = '#' + t;
        modalTagsContainer.appendChild(tagSpan);
      });
    }

    const currentSeenCount = getSeenList(activeDomain).length;
    modalCycleStatusText.textContent = `Cycle Progress: ${currentSeenCount} of ${totalInDomain} drawn (${remainingInCycle} remaining)`;

    openModal(problemModal);
    spinStatusMessage.innerHTML = `Result popped up: <strong>${problem.title}</strong>`;
  }

  function addRecentSpin(problem) {
    recentSpins.unshift({
      id: problem.id,
      title: problem.title,
      domain: problem.domain,
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
          <span class="history-domain">${item.domain}</span>
          <span class="history-time">${item.time}</span>
        </div>
        <div class="history-title">${item.title}</div>
      `;
      el.addEventListener('click', () => {
        // Quick preview
        currentRevealedProblemId = item.id;
        modalDomainTag.textContent = item.domain;
        modalDifficultyTag.textContent = 'Archived';
        modalSourceTag.textContent = 'Recent Spin';
        modalProblemTitle.textContent = item.title;
        modalProblemDescription.textContent = 'Selected from your spin history session.';
        modalTagsContainer.innerHTML = '';
        cycleCompletionAlert.classList.add('hidden');
        if (modalDeleteProblemBtn) {
          if (adminToken) {
            modalDeleteProblemBtn.classList.remove('hidden');
          } else {
            modalDeleteProblemBtn.classList.add('hidden');
          }
        }
        openModal(problemModal);
      });
      recentSpinsList.appendChild(el);
    });
  }

  // --- Document File Upload Handlers (Admin Only) ---
  let selectedFileObj = null;

  function setupFileUpload() {
    // Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    removeFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSelectedFile();
    });

    fileUploadForm.addEventListener('submit', handleUploadSubmit);
  }

  function handleFileSelect(file) {
    selectedFileObj = file;
    selectedFileName.textContent = file.name;
    const sizeElem = document.getElementById('selectedFileSize');
    if (sizeElem) {
      sizeElem.textContent = (file.size / 1024).toFixed(1) + ' KB';
    }
    dropZone.classList.add('hidden');
    selectedFileInfo.classList.remove('hidden');
    uploadSubmitBtn.disabled = false;
  }

  function clearSelectedFile() {
    selectedFileObj = null;
    fileInput.value = '';
    selectedFileInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
    uploadSubmitBtn.disabled = true;
    showToast('File upload cancelled', 'info');
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    if (!selectedFileObj) return;

    if (!adminToken) {
      showToast('Admin authorization required to upload files', 'error');
      openModal(adminLoginModal);
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFileObj);
    formData.append('domain', uploadDomainSelect.value);

    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.innerHTML = '<span>⏳ Processing & Parsing File...</span>';

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      showToast(`🎉 Success: Extracted ${data.extractedCount} problem statements!`, 'success');
      clearSelectedFile();
      await fetchDomains();
      selectDomain(data.domain);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.innerHTML = '<span>Extract & Add Problem Statements</span>';
    }
  }

  // --- Admin Login & Auth Form ---
  function setupAuthEvents() {
    triggerAdminLoginFromLock.addEventListener('click', () => openModal(adminLoginModal));

    const togglePasswordBtn = document.getElementById('togglePasswordVisibilityBtn');
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (loginPassword.type === 'password') {
          loginPassword.type = 'text';
          togglePasswordBtn.textContent = '🙈';
          togglePasswordBtn.title = 'Hide password';
        } else {
          loginPassword.type = 'password';
          togglePasswordBtn.textContent = '👁️';
          togglePasswordBtn.title = 'Show password';
        }
      });
    }

    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginErrorMsg.classList.add('hidden');

      const username = loginUsername.value.trim();
      const password = loginPassword.value.trim();

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Login failed');

        adminToken = data.token;
        setAdminState(true, data.username);
        closeModal(adminLoginModal);
        adminLoginForm.reset();
        showToast('Admin logged in successfully!', 'success');

      } catch (err) {
        loginErrorMsg.textContent = err.message;
        loginErrorMsg.classList.remove('hidden');
      }
    });
  }

  // --- Manager Modal (Problems & Documents Management) ---
  function setupManagerEvents() {
    viewProblemsBtn.addEventListener('click', () => {
      openModal(adminManagerModal);
      loadManagerProblems();
      loadManagerDocuments();
    });

    openAdminManagerBtn.addEventListener('click', () => {
      openModal(adminManagerModal);
      loadManagerProblems();
      loadManagerDocuments();
    });

    // Tabs
    const tabBtns = document.querySelectorAll('.tabs-nav .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(targetId).classList.remove('hidden');
      });
    });

    managerSearchInput.addEventListener('input', debounce(loadManagerProblems, 300));
    managerDomainFilter.addEventListener('change', loadManagerProblems);

    // Manual Problem Addition
    manualProblemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!adminToken) {
        showToast('Admin authorization required to add problem statements', 'error');
        openModal(adminLoginModal);
        return;
      }

      const domain = manualDomainSelect.value;
      const difficulty = manualDifficultySelect.value;
      const title = manualTitleInput.value.trim();
      const description = manualDescInput.value.trim();
      const tags = manualTagsInput.value;

      try {
        const res = await fetch('/api/problems', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ domain, difficulty, title, description, tags })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add problem');

        showToast('Problem statement added successfully!', 'success');
        manualProblemForm.reset();
        await fetchDomains();
        loadManagerProblems();

        // Switch to list tab
        document.querySelector('[data-tab="tabProblems"]').click();

      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Reset sample data
    resetSampleDataBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to restore the default sample dataset? This will reset all statements to initial state.')) return;
      if (!adminToken) {
        showToast('Admin login required', 'error');
        openModal(adminLoginModal);
        return;
      }
      try {
        const res = await fetch('/api/reset-data', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset data');

        seenProblems = {};
        localStorage.removeItem('spinquest_seen_problems');
        showToast(data.message, 'success');
        await fetchDomains();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  async function loadManagerProblems() {
    const search = managerSearchInput.value.trim();
    const domain = managerDomainFilter.value;

    let url = `/api/problems?domain=${encodeURIComponent(domain)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      totalProblemsBadge.textContent = data.total;
      renderManagerProblemsTable(data.problems);
    } catch (err) {
      managerProblemsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#f43f5e;">Error loading problems</td></tr>`;
    }
  }

  function renderManagerProblemsTable(problems) {
    if (problems.length === 0) {
      managerProblemsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#64748b;">No problem statements found matching criteria.</td></tr>`;
      return;
    }

    managerProblemsTableBody.innerHTML = '';
    problems.forEach(p => {
      const tr = document.createElement('tr');
      const isAdmin = Boolean(adminToken);

      tr.innerHTML = `
        <td><span class="domain-tag" style="font-size:0.7rem;">${p.domain}</span></td>
        <td>
          <strong style="color:#ffffff;">${escapeHTML(p.title)}</strong>
          <p style="font-size:0.75rem; color:#94a3b8; margin-top:4px; max-width:400px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
            ${escapeHTML(p.description)}
          </p>
        </td>
        <td><span class="difficulty-tag" style="font-size:0.7rem;">${p.difficulty || 'Intermediate'}</span></td>
        <td style="font-size:0.75rem; color:#64748b;">${escapeHTML(p.source || 'Default')}</td>
        <td>
          ${isAdmin ? `<button class="table-del-btn" data-id="${p.id}">Delete</button>` : `<span style="font-size:0.72rem; color:#64748b;">Admin Only</span>`}
        </td>
      `;

      if (isAdmin) {
        const delBtn = tr.querySelector('.table-del-btn');
        delBtn.addEventListener('click', () => handleDeleteProblem(p.id, p.title));
      }

      managerProblemsTableBody.appendChild(tr);
    });
  }

  async function handleDeleteProblem(id, title) {
    if (!confirm(`Are you sure you want to delete problem statement "${title}"?`)) return;
    if (!adminToken) return;

    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete problem');

      showToast('Problem deleted successfully', 'success');
      await fetchDomains();
      loadManagerProblems();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function loadManagerDocuments() {
    if (!adminToken) {
      managerDocumentsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#64748b;">Admin login required to view documents.</td></tr>`;
      return;
    }

    try {
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      totalDocumentsBadge.textContent = data.documents.length;

      if (data.documents.length === 0) {
        managerDocumentsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#64748b;">No documents uploaded yet. Upload a PDF, DOCX, TXT, or JSON file!</td></tr>`;
        return;
      }

      managerDocumentsTableBody.innerHTML = '';
      data.documents.forEach(doc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>📄 ${escapeHTML(doc.filename)}</strong></td>
          <td><span class="domain-tag" style="font-size:0.7rem;">${doc.domain}</span></td>
          <td><span style="font-family:monospace; color:#06b6d4; font-weight:bold;">${doc.extractedCount}</span> statements</td>
          <td style="font-size:0.75rem; color:#64748b;">${new Date(doc.uploadedAt).toLocaleString()}</td>
          <td><button class="table-del-btn" data-docid="${doc.id}">Delete</button></td>
        `;
        tr.querySelector('.table-del-btn').addEventListener('click', () => handleDeleteDocument(doc.id, doc.filename));
        managerDocumentsTableBody.appendChild(tr);
      });

    } catch (err) {
      managerDocumentsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#f43f5e;">Error loading documents</td></tr>`;
    }
  }

  async function handleDeleteDocument(id, filename) {
    if (!confirm(`Are you sure you want to remove "${filename}" and its associated problem statements?`)) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      showToast(data.message, 'success');
      await fetchDomains();
      loadManagerDocuments();
      loadManagerProblems();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // --- Modal Helpers ---
  function openModal(modal) {
    modal.classList.remove('hidden');
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
  }

  function setupEventListeners() {
    // Spin Triggers
    spinCenterBtn.addEventListener('click', triggerSpin);
    spinMainBtn.addEventListener('click', triggerSpin);

    // Keyboard Spacebar trigger
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        triggerSpin();
      }
    });

    // Reset Cycle Button
    resetCycleBtn.addEventListener('click', () => resetCycle(activeDomain));

    // Problem Modal buttons
    closeProblemModal.addEventListener('click', () => closeModal(problemModal));
    if (dismissProblemModalBtn) {
      dismissProblemModalBtn.addEventListener('click', () => closeModal(problemModal));
    }

    copyProblemBtn.addEventListener('click', () => {
      const title = modalProblemTitle.textContent;
      const desc = modalProblemDescription.textContent;
      const textToCopy = `[${activeDomain}] ${title}\n\n${desc}`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Problem statement copied to clipboard! 📋', 'success');
      }).catch(() => {
        showToast('Could not copy to clipboard', 'error');
      });
    });

    // Modal Close Triggers
    closeLoginModal.addEventListener('click', () => closeModal(adminLoginModal));
    closeManagerModal.addEventListener('click', () => closeModal(adminManagerModal));

    // Overlay click to close
    [problemModal, adminLoginModal, adminManagerModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Domain Management Listeners
    if (showAddDomainBtn) {
      showAddDomainBtn.addEventListener('click', () => {
        newDomainInlineForm.classList.toggle('hidden');
        if (!newDomainInlineForm.classList.contains('hidden') && newDomainInput) {
          newDomainInput.focus();
        }
      });
    }

    if (cancelDomainBtn) {
      cancelDomainBtn.addEventListener('click', () => {
        newDomainInlineForm.classList.add('hidden');
        if (newDomainInput) newDomainInput.value = '';
      });
    }

    if (saveDomainBtn) {
      saveDomainBtn.addEventListener('click', handleSaveNewDomain);
    }

    if (newDomainInput) {
      newDomainInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveNewDomain();
        }
      });
    }

    // Quick Add Problem Statement Button (Admin Only)
    if (quickAddProblemBtn) {
      quickAddProblemBtn.addEventListener('click', () => {
        openModal(adminManagerModal);
        const addTab = document.querySelector('[data-tab="tabAddManual"]');
        if (addTab) addTab.click();
        if (manualDomainSelect) manualDomainSelect.value = activeDomain;
      });
    }

    // Modal Problem Statement Delete Button (Admin Only)
    if (modalDeleteProblemBtn) {
      modalDeleteProblemBtn.addEventListener('click', async () => {
        if (!currentRevealedProblemId) return;
        if (!confirm(`Are you sure you want to delete problem statement "${modalProblemTitle.textContent}" from the database?`)) return;
        if (!adminToken) {
          showToast('Admin login required', 'error');
          openModal(adminLoginModal);
          return;
        }
        try {
          const res = await fetch(`/api/problems/${currentRevealedProblemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete problem statement');

          showToast('Problem statement deleted successfully!', 'success');
          closeModal(problemModal);
          await fetchDomains();
          loadManagerProblems();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    setupFileUpload();
    setupAuthEvents();
    setupManagerEvents();
  }

  // --- Utility Functions ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Run Init
  window.addEventListener('DOMContentLoaded', init);

})();
