const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mammoth = require('mammoth');
const zlib = require('zlib');
let pdfParseModule = null;
try {
  pdfParseModule = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse module warning:', e.message);
}

let PDFDocument = null;
try {
  PDFDocument = require('pdfkit');
  // Explicitly require font modules so Vercel's NFT bundler includes them in serverless output
  try { require('pdfkit/js/standard-fonts/Helvetica.cjs'); } catch (err) {}
  try { require('pdfkit/js/standard-fonts/HelveticaBold.cjs'); } catch (err) {}
  try { require('pdfkit/js/standard-fonts/chunks/standardGlyphNames-DNHAb7rp.cjs'); } catch (err) {}
} catch (e) {
  console.warn('pdfkit module warning:', e.message);
}

let sampleProblems = [];
try {
  sampleProblems = require('./sampleProblems');
} catch (e) {
  try {
    sampleProblems = require('./data/sampleProblems');
  } catch (err) {
    sampleProblems = [];
  }
}

let authorizedTeams = [];
try {
  authorizedTeams = require('./authorizedTeams');
} catch (e) {
  try {
    authorizedTeams = require('./data/authorizedTeams');
  } catch (err) {
    authorizedTeams = [];
  }
}

const app = express();
const isVercel = process.env.VERCEL === '1' || Boolean(process.env.NOW_REGION);
const DB_FILE = isVercel
  ? path.join('/tmp', 'database.json')
  : (fs.existsSync(path.join(__dirname, 'database.json'))
      ? path.join(__dirname, 'database.json')
      : (fs.existsSync(path.join(__dirname, 'data', 'database.json'))
          ? path.join(__dirname, 'data', 'database.json')
          : path.join(__dirname, 'database.json')));
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Ignored in read-only environment
}

// In-memory + persistent DB helper
function loadDB() {
  let loaded = null;
  const candidateSeeds = [
    path.join(__dirname, 'database.json'),
    path.join(process.cwd(), 'database.json'),
    path.join(__dirname, 'data', 'database.json')
  ];

  if (isVercel && !fs.existsSync(DB_FILE)) {
    for (const seedPath of candidateSeeds) {
      if (fs.existsSync(seedPath)) {
        try {
          const seedContent = fs.readFileSync(seedPath, 'utf-8');
          fs.writeFileSync(DB_FILE, seedContent);
          loaded = JSON.parse(seedContent);
          break;
        } catch (err) {
          console.warn('Could not copy seed to /tmp:', err.message);
        }
      }
    }
  }

  if (!loaded && fs.existsSync(DB_FILE)) {
    try {
      loaded = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {}
  }

  if (!loaded) {
    for (const seedPath of candidateSeeds) {
      if (fs.existsSync(seedPath)) {
        try {
          loaded = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
          break;
        } catch (e) {}
      }
    }
  }

  if (!loaded) {
    loaded = {
      problems: [],
      documents: [],
      domains: [
        "Artificial Intelligence & ML",
        "Cybersecurity & Privacy",
        "Web & Mobile Development",
        "Internet of Things (IoT)",
        "Cloud & DevOps"
      ],
      teams: [],
      adminTokens: []
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(loaded, null, 2));
    } catch (e) {}
  } else {
    if (!Array.isArray(loaded.problems)) loaded.problems = [];
    if (!Array.isArray(loaded.documents)) loaded.documents = [];
    if (!Array.isArray(loaded.domains) || loaded.domains.length === 0) {
      loaded.domains = [
        "Artificial Intelligence & ML",
        "Cybersecurity & Privacy",
        "Web & Mobile Development",
        "Internet of Things (IoT)",
        "Cloud & DevOps"
      ];
    }
  }

  // Ensure teams array always contains all authorized teams with complete metadata
  if (!loaded.teams) loaded.teams = [];
  if (!loaded.adminTokens) loaded.adminTokens = [];

  if (authorizedTeams && authorizedTeams.length > 0) {
    for (const at of authorizedTeams) {
      const existing = loaded.teams.find(t => 
        (t.teamId && t.teamId.toLowerCase() === at.regId.toLowerCase()) ||
        (t.regId && t.regId.toLowerCase() === at.regId.toLowerCase())
      );
      if (!existing) {
        loaded.teams.push({
          id: at.id,
          teamId: at.regId,
          regId: at.regId,
          teamName: at.teamName,
          originalTrack: at.originalTrack,
          domain: at.domain,
          size: at.size,
          leader: at.leader,
          email: at.email,
          phone: at.phone,
          college: at.college,
          members: at.members,
          utr: at.utr,
          isAdmin: Boolean(at.isAdmin),
          githubLink: '',
          hasEntered: false,
          registeredAt: null,
          sessionTokens: [],
          spins: []
        });
      } else {
        // Backfill any missing fields from authorizedTeams master sheet
        if (!existing.regId) existing.regId = at.regId;
        if (!existing.leader) existing.leader = at.leader;
        if (!existing.phone) existing.phone = at.phone;
        if (!existing.email) existing.email = at.email;
        if (!existing.college) existing.college = at.college;
        if (!existing.members) existing.members = at.members;
        if (!existing.domain) existing.domain = at.domain;
        if (!existing.originalTrack) existing.originalTrack = at.originalTrack;
        if (!existing.utr) existing.utr = at.utr;
        if (at.isAdmin) existing.isAdmin = true;
      }
    }
  }

  return loaded;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'Sansai-L/ps-spinwheel';

let lastGitHubFetchTime = 0;
let isPullingFromGitHub = false;
let gitHubSyncLock = false;

// ─── HIGH-CONCURRENCY SYNC QUEUE ─────────────────────────────────────────────
// For 150 simultaneous users: debounce GitHub syncs so many rapid writes
// are batched into a single GitHub PUT instead of 150 separate API calls.
let syncPending = false;
let syncDebounceTimer = null;

function debouncedSync(delayMs = 2000) {
  if (!syncPending) {
    syncPending = true;
  }
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(async () => {
    syncPending = false;
    try { await syncToGitHub(); } catch (e) {}
  }, delayMs);
}

// Merge remote teams into local db.teams preserving assigned spins and honoring admin resets
function mergeTeams(remoteTeams = []) {
  if (!db.teams) db.teams = [];
  const teamMap = new Map();

  for (const rt of remoteTeams) {
    const key = (rt.teamId || rt.regId || '').toLowerCase();
    if (key) teamMap.set(key, { ...rt });
  }

  for (const lt of db.teams) {
    const key = (lt.teamId || lt.regId || '').toLowerCase();
    if (!key) continue;

    if (!teamMap.has(key)) {
      teamMap.set(key, { ...lt });
    } else {
      const rt = teamMap.get(key);
      const localHasSpin = Array.isArray(lt.spins) && lt.spins.length > 0;
      const remoteHasSpin = Array.isArray(rt.spins) && rt.spins.length > 0;

      const localResetTime = lt.spinResetAt ? new Date(lt.spinResetAt).getTime() : 0;
      const remoteResetTime = rt.spinResetAt ? new Date(rt.spinResetAt).getTime() : 0;
      const localSpunTime = localHasSpin && lt.spins[0]?.spunAt ? new Date(lt.spins[0].spunAt).getTime() : 0;
      const remoteSpunTime = remoteHasSpin && rt.spins[0]?.spunAt ? new Date(rt.spins[0].spunAt).getTime() : 0;

      let spinsToKeep = [];
      if (localResetTime > remoteSpunTime && localResetTime > localSpunTime) {
        spinsToKeep = [];
      } else if (remoteResetTime > localSpunTime && remoteResetTime > remoteSpunTime) {
        spinsToKeep = [];
      } else if (localSpunTime > remoteSpunTime) {
        spinsToKeep = lt.spins;
      } else if (remoteHasSpin) {
        spinsToKeep = rt.spins;
      } else if (localHasSpin) {
        spinsToKeep = lt.spins;
      }

      const mergedTokens = Array.from(new Set([...(rt.sessionTokens || []), ...(lt.sessionTokens || [])]));

      teamMap.set(key, {
        ...rt,
        ...lt,
        spins: spinsToKeep,
        sessionTokens: mergedTokens,
        spinResetAt: localResetTime > remoteResetTime ? lt.spinResetAt : rt.spinResetAt,
        hasEntered: spinsToKeep.length > 0 || rt.hasEntered || lt.hasEntered
      });
    }
  }

  db.teams = Array.from(teamMap.values());
}

// Pull latest database.json from GitHub repo to survive Vercel lambda recycling
async function pullLatestFromGitHub() {
  if (!GITHUB_TOKEN || isPullingFromGitHub) return;
  isPullingFromGitHub = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/database.json?ref=main`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'ps-spinwheel-server',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) {
      isPullingFromGitHub = false;
      return;
    }
    const data = await res.json();
    if (!data.content) {
      isPullingFromGitHub = false;
      return;
    }
    const rawStr = Buffer.from(data.content, 'base64').toString('utf8');
    const parsed = JSON.parse(rawStr);
    
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.problems)) {
        db.problems = parsed.problems;
      }
      if (Array.isArray(parsed.documents)) {
        db.documents = parsed.documents;
      }
      if (Array.isArray(parsed.domains) && parsed.domains.length > 0) {
        db.domains = parsed.domains;
      }
      if (Array.isArray(parsed.teams)) {
        mergeTeams(parsed.teams);
      }
      saveDB(db);
      lastGitHubFetchTime = Date.now();
    }
  } catch (err) {
    console.warn('pullLatestFromGitHub non-fatal error:', err.message);
  } finally {
    isPullingFromGitHub = false;
  }
}

// Persist database.json directly to GitHub repository so data is NEVER lost
async function syncToGitHub(retryCount = 2) {
  if (!GITHUB_TOKEN) return false;
  
  for (let i = 0; i < 5 && gitHubSyncLock; i++) {
    await new Promise(r => setTimeout(r, 400));
  }
  gitHubSyncLock = true;

  try {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/database.json?ref=main`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'ps-spinwheel-server',
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        let sha = null;
        if (getRes.ok) {
          const fileInfo = await getRes.json();
          sha = fileInfo.sha;
          if (fileInfo.content) {
            try {
              const remoteStr = Buffer.from(fileInfo.content, 'base64').toString('utf8');
              const remoteDb = JSON.parse(remoteStr);
              if (remoteDb && Array.isArray(remoteDb.teams)) {
                mergeTeams(remoteDb.teams);
              }
            } catch (e) {}
          }
        }

        const content = Buffer.from(JSON.stringify(db, null, 2)).toString('base64');
        const body = {
          message: 'chore: auto-sync database state (problems, teams, domains)',
          content,
          branch: 'main'
        };
        if (sha) body.sha = sha;

        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/database.json`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'ps-spinwheel-server',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (putRes.ok) {
          lastGitHubFetchTime = Date.now();
          return true;
        }

        if (putRes.status === 409 && attempt < retryCount) {
          await new Promise(r => setTimeout(r, 600));
          continue;
        }

        const errData = await putRes.json().catch(() => ({}));
        console.warn(`GitHub PUT failed (${putRes.status}):`, errData.message);
        return false;
      } catch (err) {
        if (attempt >= retryCount) throw err;
        await new Promise(r => setTimeout(r, 600));
      }
    }
  } catch (err) {
    console.error('syncToGitHub error:', err.message);
    return false;
  } finally {
    gitHubSyncLock = false;
  }
}

function scheduleGitHubSync() {
  syncToGitHub().catch(() => {});
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('saveDB warning (non-fatal):', err.message);
  }
}

let db = loadDB();
// Asynchronously pull latest on startup
pullLatestFromGitHub().catch(() => {});

// Middleware — body size limit protects against large payload attacks under high concurrency
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ─── GITHUB PULL THROTTLE ─────────────────────────────────────────────────────
// For 150 concurrent users: pull GitHub at most once per 20 seconds,
// but ONLY await it on a true cold start (lastGitHubFetchTime === 0).
// All other refreshes are fire-and-forget to keep response times fast.
app.use(async (req, res, next) => {
  const now = Date.now();
  const needsFresh = req.path === '/api/team/register' ||
                     req.path === '/api/team/status' ||
                     req.path === '/api/spin' ||
                     req.path === '/api/problems' ||
                     req.path === '/api/domains' ||
                     req.path.startsWith('/api/admin/');

  if (!lastGitHubFetchTime) {
    // True cold start — await exactly one pull to bootstrap in-memory db
    try { await pullLatestFromGitHub(); } catch (e) {}
  } else if (now - lastGitHubFetchTime > 20000 && needsFresh) {
    // Stale data — refresh fire-and-forget so we don't block the response
    pullLatestFromGitHub().catch(() => {});
    lastGitHubFetchTime = now; // Optimistically update to prevent stampede
  }
  next();
});
const staticDir = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : __dirname;
app.use(express.static(staticDir));

let staticAssets = {};
try {
  staticAssets = require('./staticAssets');
} catch (e) {
  staticAssets = {};
}

function findFile(filename) {
  const candidates = [
    path.join(__dirname, filename),
    path.join(process.cwd(), filename),
    path.join(__dirname, '..', filename),
    path.join(__dirname, 'public', filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  return null;
}

function sendAsset(res, filename, contentType) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const filePath = findFile(filename);
  if (filePath && fs.existsSync(filePath)) {
    return res.type(contentType).sendFile(filePath);
  }
  if (staticAssets && staticAssets[filename]) {
    return res.type(contentType).send(staticAssets[filename]);
  }
  res.status(404).send(filename + ' not found');
}

// Explicit Root & HTML Route Handlers (Resolves Vercel "Cannot GET /" permanently)
app.get(['/', '/index.html'], (req, res) => {
  sendAsset(res, 'index.html', 'text/html; charset=utf-8');
});

app.get(['/admin', '/admin.html'], (req, res) => {
  sendAsset(res, 'admin.html', 'text/html; charset=utf-8');
});

// Explicit Static Asset Handlers
app.get('/style.css', (req, res) => {
  sendAsset(res, 'style.css', 'text/css; charset=utf-8');
});

app.get('/app.js', (req, res) => {
  sendAsset(res, 'app.js', 'application/javascript; charset=utf-8');
});

app.get('/admin-app.js', (req, res) => {
  sendAsset(res, 'admin-app.js', 'application/javascript; charset=utf-8');
});

// Admin Auth Token Store & Stateless Cryptographic Verification
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};
const ADMIN_HMAC_SECRET = process.env.ADMIN_SECRET || 'codienych-spinquest-admin-secret-key-2026';
const VALID_TOKENS = new Set(['demo-admin-token-2026', ...(db.adminTokens || [])]);

function createAdminToken(user = 'admin') {
  const ts = Date.now();
  const payload = `${user}:${ts}`;
  const sig = crypto.createHmac('sha256', ADMIN_HMAC_SECRET).update(payload).digest('hex');
  return `adm.${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  if (token === 'demo-admin-token-2026') return true;
  if (VALID_TOKENS.has(token)) return true;

  if (token.startsWith('adm.')) {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    try {
      const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
      const [user, tsStr] = payload.split(':');
      const ts = parseInt(tsStr, 10);
      // Valid for 14 days
      if (isNaN(ts) || Date.now() - ts > 14 * 24 * 60 * 60 * 1000) return false;
      const expectedSig = crypto.createHmac('sha256', ADMIN_HMAC_SECRET).update(payload).digest('hex');
      return parts[2] === expectedSig;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin login required' });
  }
  const token = authHeader.split(' ')[1];
  if (!verifyAdminToken(token)) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
  }
  next();
}

// Multer Storage Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Auth Endpoints
const handleAdminLogin = (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  const isStandardAdmin = (cleanUser === 'admin') && (cleanPass === 'admin123' || cleanPass === 'admin');
  const isEnvAdmin = (cleanUser === (process.env.ADMIN_USER || 'admin').toLowerCase()) && (cleanPass === (process.env.ADMIN_PASSWORD || 'admin123'));
  const isEventAdmin = (cleanUser === 'codienych-admin') && (cleanPass.toLowerCase() === 'admin team' || cleanPass === 'admin123' || cleanPass === 'admin');

  if (isStandardAdmin || isEnvAdmin || isEventAdmin) {
    const token = createAdminToken(cleanUser);
    VALID_TOKENS.add(token);
    if (!db.adminTokens) db.adminTokens = [];
    db.adminTokens.push(token);
    saveDB(db);
    return res.json({
      success: true,
      token,
      username: username.trim() || 'admin',
      message: 'Login successful'
    });
  }
  return res.status(401).json({ error: 'Invalid username or password. Default organizer credentials: admin / admin123' });
};

app.post('/api/admin/login', handleAdminLogin);
app.post('/api/login', handleAdminLogin);

const handleAdminVerify = (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (verifyAdminToken(token)) {
      return res.json({ valid: true, username: 'admin' });
    }
  }
  return res.status(401).json({ valid: false, error: 'Token invalid or expired' });
};

app.get('/api/admin/verify', handleAdminVerify);
app.get('/api/verify', handleAdminVerify);

// Domain matching helper: checks specific domain, track, tags, or normalized keywords
function matchesDomain(p, domainName) {
  if (!p || !domainName) return false;
  const d = domainName.trim().toLowerCase();

  // 1. Direct equality checks on primary domain / track
  if (p.domain && p.domain.toLowerCase() === d) return true;
  if (p.track && p.track.toLowerCase() === d) return true;
  if (Array.isArray(p.domains) && p.domains.some(x => x && x.toLowerCase() === d)) return true;

  // 2. Normalized checks (handles &, and, app, mobile, spaces, punctuation)
  const norm = str => (str || '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bapp\b/g, 'mobile')
    .replace(/[^a-z0-9]/g, '');

  const normTarget = norm(domainName);
  if (!normTarget) return false;

  if (p.domain && norm(p.domain) === normTarget) return true;
  if (p.track && norm(p.track) === normTarget) return true;
  if (Array.isArray(p.domains) && p.domains.some(x => norm(x) === normTarget)) return true;

  // 3. Domain group aliases & taxonomy matching
  const groups = [
    { keys: ['ai', 'ml', 'aiml', 'artificialintelligence', 'machinelearning'] },
    { keys: ['web', 'mobile', 'app', 'android', 'ios'] },
    { keys: ['cyber', 'security', 'privacy'] },
    { keys: ['iot', 'internetofthings', 'embedded', 'hardware'] },
    { keys: ['cloud', 'devops', 'docker', 'kubernetes'] }
  ];

  for (const g of groups) {
    const targetInGroup = g.keys.some(k => normTarget.includes(k));
    if (targetInGroup) {
      const matchP = field => {
        if (!field) return false;
        const nf = norm(field);
        return g.keys.some(k => nf.includes(k));
      };
      if (matchP(p.domain) || matchP(p.track)) return true;
      if (Array.isArray(p.domains) && p.domains.some(matchP)) return true;
      // Only check tags if problem does NOT have an explicit domain set
      if (!p.domain && Array.isArray(p.tags) && p.tags.some(matchP)) return true;
    }
  }

  // If problem has no explicit domain, check exact tag match as final fallback
  if (!p.domain && Array.isArray(p.tags) && p.tags.some(t => t && t.toLowerCase() === d)) return true;

  return false;
}

// Domain Endpoints
app.get('/api/domains', (req, res) => {
  const domainsList = (db.domains || []).map(d => ({
    name: d,
    count: (db.problems || []).filter(p => matchesDomain(p, d)).length
  }));

  res.json({ domains: domainsList, totalProblems: db.problems.length });
});

app.post('/api/domains', adminAuthMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Domain name is required' });
  }
  const cleanName = name.trim();
  if (db.domains.includes(cleanName)) {
    return res.status(400).json({ error: 'Domain already exists' });
  }
  db.domains.push(cleanName);
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, domain: cleanName });
});

app.delete('/api/domains/:name', adminAuthMiddleware, async (req, res) => {
  const domainParam = decodeURIComponent(req.params.name).trim();
  const index = db.domains.findIndex(d => d.toLowerCase() === domainParam.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ error: `Domain "${domainParam}" not found` });
  }

  const actualDomainName = db.domains[index];
  // Remove domain
  db.domains.splice(index, 1);

  // Remove all problem statements in that domain
  const prevCount = db.problems.length;
  db.problems = db.problems.filter(p => p.domain.toLowerCase() !== actualDomainName.toLowerCase());
  const removedCount = prevCount - db.problems.length;

  saveDB(db);
  await syncToGitHub();
  res.json({
    success: true,
    message: `Domain "${actualDomainName}" and ${removedCount} associated problem statement(s) deleted.`,
    remainingDomains: db.domains
  });
});

// In-process spin lock: prevents two concurrent requests for the SAME team
// from both passing the 1-spin check within the same lambda instance.
const spinningTeams = new Set();

// Problem Statement Wheel Spin Endpoint
// ATOMIC: Checks 1-spin limit AND saves spin in a single request to prevent race
// conditions across multiple serverless Vercel lambda instances.
app.post('/api/spin', async (req, res) => {
  const { domain, seenIds = [], sessionToken, teamId: reqTeamId } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Please select a domain to spin' });
  }

  // ── Find team: by session token first, then by Reg ID ─────────────────────
  let team = null;
  if (db.teams) {
    if (sessionToken) {
      team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
    }
    if (!team && reqTeamId) {
      const rawId = reqTeamId.trim().toLowerCase();
      team = db.teams.find(t =>
        (t.teamId && t.teamId.toLowerCase() === rawId) ||
        (t.regId && t.regId.toLowerCase() === rawId)
      );
    }
  }

  // Fallback: If not yet in db.teams, resolve from authorized master list
  if (!team && reqTeamId) {
    const rawId = reqTeamId.trim();
    const matchedAuth = authorizedTeams.find(t => {
      if (t.regId.toLowerCase() === rawId.toLowerCase()) return true;
      if (/^\d+$/.test(rawId) && (t.id === parseInt(rawId, 10) || t.regId.endsWith('-' + rawId.padStart(4, '0')))) return true;
      if (t.isAdmin && (rawId.toUpperCase() === 'CODIENYCH-ADMIN' || rawId.toUpperCase() === 'ADMIN-TEAM' || rawId.toUpperCase() === 'ADMIN')) return true;
      return false;
    });
    if (matchedAuth) {
      team = {
        id: 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        teamId: matchedAuth.regId,
        teamName: matchedAuth.teamName || `Team ${matchedAuth.regId}`,
        domain: matchedAuth.domain,
        originalTrack: matchedAuth.originalTrack,
        leader: matchedAuth.leader,
        college: matchedAuth.college,
        members: matchedAuth.members,
        size: matchedAuth.size,
        email: matchedAuth.email,
        phone: matchedAuth.phone,
        githubLink: '',
        registeredAt: new Date().toISOString(),
        sessionTokens: sessionToken ? [sessionToken] : [],
        isAdmin: Boolean(matchedAuth.isAdmin),
        spins: []
      };
      if (!db.teams) db.teams = [];
      db.teams.unshift(team);
    }
  }

  // ── Strict 1-spin limit check (persistent) ────────────────────────────────
  if (team && !team.isAdmin && (!team.spins || team.spins.length === 0)) {
    // Fresh pull from GitHub to verify whether another lambda recorded a spin
    try {
      await pullLatestFromGitHub();
      team = db.teams.find(t =>
        (sessionToken && t.sessionTokens && t.sessionTokens.includes(sessionToken)) ||
        (reqTeamId && (
          (t.teamId && t.teamId.toLowerCase() === reqTeamId.trim().toLowerCase()) ||
          (t.regId && t.regId.toLowerCase() === reqTeamId.trim().toLowerCase())
        ))
      ) || team;
    } catch (e) {}
  }

  if (team && !team.isAdmin && team.spins && team.spins.length >= 1) {
    return res.status(403).json({
      error: 'Each team is allowed to spin only once! You have already been assigned a problem statement.',
      alreadySpun: true,
      problem: team.spins[0]
    });
  }

  // ── In-process spin lock (same lambda, concurrent requests) ───────────────
  // Prevents two simultaneous requests for the same team from both passing
  // the spins.length check before either has finished writing.
  const lockKey = (team && team.teamId) ? team.teamId.toLowerCase() : (reqTeamId || '').toLowerCase();
  if (lockKey && spinningTeams.has(lockKey)) {
    return res.status(429).json({
      error: 'Spin already in progress for this team. Please wait a moment.',
      alreadySpun: false
    });
  }
  if (lockKey) spinningTeams.add(lockKey);

  let domainProblems = db.problems.filter(p => matchesDomain(p, domain));

  if (domainProblems.length === 0) {
    if (db.problems && db.problems.length > 0) {
      console.warn(`No direct match for domain "${domain}", falling back to all available problems.`);
      domainProblems = [...db.problems];
    } else {
      if (lockKey) spinningTeams.delete(lockKey);
      return res.status(404).json({
        error: `No problem statements currently available in database. Admin can upload documents or add problems.`
      });
    }
  }

  // Find unseen problems in current cycle
  const seenSet = new Set(seenIds);
  let availableProblems = domainProblems.filter(p => !seenSet.has(p.id));
  let cycleCompleted = false;

  if (availableProblems.length === 0) {
    cycleCompleted = true;
    availableProblems = [...domainProblems];
  }

  const randomIndex = Math.floor(Math.random() * availableProblems.length);
  const selectedProblem = availableProblems[randomIndex];

  // ── ATOMIC SPIN SAVE ────────────────────────────────────────────────────────
  // Save the spin assignment immediately in this same request (not waiting for
  // the client to call /api/team/log-spin) so a teamId lookup on the NEXT
  // request will correctly return alreadySpun=true across all lambda instances.
  if (team && !team.isAdmin) {
    const spinRecord = {
      id: selectedProblem.id,
      problemId: selectedProblem.id,
      domain: selectedProblem.domain,
      title: selectedProblem.title,
      problemTitle: selectedProblem.title,
      problem: selectedProblem.problem || '',
      expectedSolution: selectedProblem.expectedSolution || '',
      description: selectedProblem.description,
      problemDescription: selectedProblem.description,
      difficulty: selectedProblem.difficulty || 'Intermediate',
      problemDifficulty: selectedProblem.difficulty || 'Intermediate',
      source: selectedProblem.source || 'Default',
      tags: selectedProblem.tags || [],
      spunAt: new Date().toISOString()
    };
    team.spins = [spinRecord];
    team.hasEntered = true;
    team.spinResetAt = null;
    if (sessionToken && team.sessionTokens && !team.sessionTokens.includes(sessionToken)) {
      team.sessionTokens.push(sessionToken);
    }
    saveDB(db);
    // Fire-and-forget: response does NOT wait for GitHub — spin is already saved in-memory.
    // debouncedSync batches rapid simultaneous spin saves into one GitHub PUT.
    debouncedSync(1500);
  }

  // Release in-process lock
  if (lockKey) spinningTeams.delete(lockKey);

  res.json({
    problem: selectedProblem,
    cycleCompleted,
    totalInDomain: domainProblems.length,
    remainingInCycle: availableProblems.length - 1,
    cycleSize: domainProblems.length
  });
});

// Problems Query Endpoint (for preview or admin view)
app.get('/api/problems', (req, res) => {
  const { domain, search } = req.query;
  let list = db.problems;

  if (domain && domain !== 'All') {
    list = list.filter(p => matchesDomain(p, domain));
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  res.json({ total: list.length, problems: list });
});

// Add Single Problem Manually (Admin Only)
app.post('/api/problems', adminAuthMiddleware, async (req, res) => {
  const { domain, title, description, difficulty = 'Intermediate', tags = [] } = req.body;
  if (!domain || !title || !description) {
    return res.status(400).json({ error: 'Domain, title, and description are required' });
  }

  if (!db.domains.includes(domain)) {
    db.domains.push(domain);
  }

  const newProblem = {
    id: 'ps_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    domain: domain.trim(),
    title: title.trim(),
    description: description.trim(),
    difficulty: difficulty || 'Intermediate',
    source: 'Manual Entry',
    tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    createdAt: new Date().toISOString()
  };

  db.problems.unshift(newProblem);
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, problem: newProblem });
});

// Delete Problem (Admin Only)
app.delete('/api/problems/:id', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const initialLen = db.problems.length;
  db.problems = db.problems.filter(p => p.id !== id);

  if (db.problems.length === initialLen) {
    return res.status(404).json({ error: 'Problem statement not found' });
  }

  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: 'Problem statement deleted' });
});

// Clear All Problems (Admin Only)
app.post('/api/admin/clear-all-problems', adminAuthMiddleware, async (req, res) => {
  db.problems = [];
  db.documents = [];
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: 'All problem statements and documents removed successfully', totalProblems: 0 });
});

app.delete('/api/problems', adminAuthMiddleware, async (req, res) => {
  db.problems = [];
  db.documents = [];
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: 'All problem statements and documents removed successfully', totalProblems: 0 });
});

// Document Upload & Intelligent Extraction Endpoint (Admin Only)
app.post('/api/upload', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetDomain = req.body.domain || 'General & Innovation';
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const buffer = req.file.buffer;

    let extractedText = '';

    // Handle various file formats
    if (ext === '.pdf') {
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (pdfErr) {
        console.error('PDF extraction failed:', pdfErr);
        return res.status(400).json({
          error: 'Could not extract text from this PDF: ' + pdfErr.message + '. Please ensure the PDF contains selectable text (not scanned images).'
        });
      }
    } else if (ext === '.docx') {
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = parsed.value || '';
    } else if (ext === '.json') {
      const jsonStr = buffer.toString('utf-8');
      try {
        const jsonContent = JSON.parse(jsonStr);
        const problems = [];
        const items = Array.isArray(jsonContent) ? jsonContent : (jsonContent.problems || [jsonContent]);

        items.forEach((item, idx) => {
          const title = item.title || item.name || `Problem Statement #${idx + 1}`;
          const desc = item.description || item.statement || item.problem || item.content || JSON.stringify(item);
          const domain = item.domain || targetDomain;
          const diff = item.difficulty || 'Intermediate';
          const tags = Array.isArray(item.tags) ? item.tags : [];

          if (desc && desc.trim()) {
            problems.push({
              id: 'ps_json_' + Date.now() + '_' + idx,
              domain: domain.trim(),
              title: title.trim(),
              description: desc.trim(),
              difficulty: diff,
              source: originalName,
              tags,
              createdAt: new Date().toISOString()
            });
          }
        });

        if (problems.length > 0) {
          if (!db.domains.includes(targetDomain)) {
            db.domains.push(targetDomain);
          }
          db.problems.unshift(...problems);
          
          const docRecord = {
            id: 'doc_' + Date.now(),
            filename: originalName,
            domain: targetDomain,
            extractedCount: problems.length,
            uploadedAt: new Date().toISOString(),
            size: req.file.size
          };
          db.documents.unshift(docRecord);
          saveDB(db);

          return res.json({
            success: true,
            extractedCount: problems.length,
            domain: targetDomain,
            problems,
            message: `Successfully extracted ${problems.length} problem statements from ${originalName}`
          });
        }
      } catch (err) {
        return res.status(400).json({ error: 'Failed to parse JSON file: ' + err.message });
      }
    } else if (ext === '.csv') {
      const csvStr = buffer.toString('utf-8');
      const lines = csvStr.split(/\r?\n/).filter(line => line.trim().length > 0);
      const problems = [];

      lines.forEach((line, idx) => {
        // Skip header if common header words
        if (idx === 0 && (line.toLowerCase().includes('title') || line.toLowerCase().includes('problem'))) {
          return;
        }
        // Basic CSV split
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
        if (parts.length >= 2) {
          problems.push({
            id: 'ps_csv_' + Date.now() + '_' + idx,
            domain: (parts[2] || targetDomain).trim(),
            title: parts[0],
            description: parts[1],
            difficulty: parts[3] || 'Intermediate',
            source: originalName,
            tags: [targetDomain],
            createdAt: new Date().toISOString()
          });
        } else if (parts.length === 1 && parts[0].length > 15) {
          problems.push({
            id: 'ps_csv_' + Date.now() + '_' + idx,
            domain: targetDomain,
            title: `Challenge ${idx + 1}`,
            description: parts[0],
            difficulty: 'Intermediate',
            source: originalName,
            tags: [targetDomain],
            createdAt: new Date().toISOString()
          });
        }
      });

      if (problems.length > 0) {
        if (!db.domains.includes(targetDomain)) {
          db.domains.push(targetDomain);
        }
        db.problems.unshift(...problems);
        const docRecord = {
          id: 'doc_' + Date.now(),
          filename: originalName,
          domain: targetDomain,
          extractedCount: problems.length,
          uploadedAt: new Date().toISOString(),
          size: req.file.size
        };
        db.documents.unshift(docRecord);
        saveDB(db);

        return res.json({
          success: true,
          extractedCount: problems.length,
          domain: targetDomain,
          problems,
          message: `Successfully extracted ${problems.length} problem statements from ${originalName}`
        });
      }
    } else {
      // Default plain text / markdown / doc text
      extractedText = buffer.toString('utf-8');
    }

    // Parse plain text / doc text into individual problem statements
    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({ error: 'Uploaded file appears to be empty or unreadable.' });
    }

    const parsedProblems = parseStatementsFromText(extractedText, targetDomain, originalName);

    if (parsedProblems.length === 0) {
      return res.status(400).json({ error: 'Could not detect any distinct problem statements in this document.' });
    }

    if (!db.domains.includes(targetDomain)) {
      db.domains.push(targetDomain);
    }

    db.problems.unshift(...parsedProblems);

    const docRecord = {
      id: 'doc_' + Date.now(),
      filename: originalName,
      domain: targetDomain,
      extractedCount: parsedProblems.length,
      uploadedAt: new Date().toISOString(),
      size: req.file.size
    };
    db.documents.unshift(docRecord);
    saveDB(db);
    await syncToGitHub();

    res.json({
      success: true,
      extractedCount: parsedProblems.length,
      domain: targetDomain,
      problems: parsedProblems,
      message: `Extracted ${parsedProblems.length} problem statement(s) for ${targetDomain}`
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Server error processing file: ' + err.message });
  }
});

// Document List & Delete Endpoints (Admin Only)
app.get('/api/documents', adminAuthMiddleware, (req, res) => {
  res.json({ documents: db.documents || [] });
});

app.delete('/api/documents/:id', adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const doc = (db.documents || []).find(d => d.id === id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Remove document
  db.documents = db.documents.filter(d => d.id !== id);
  // Optionally remove associated problems from that document
  db.problems = db.problems.filter(p => p.source !== doc.filename);

  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: `Removed document "${doc.filename}" and its problem statements.` });
});

// ─── TEAM REGISTRATION & TRACKING ────────────────────────────────────────────

// ─── TEAM REGISTRATION & TRACKING ────────────────────────────────────────────

// Register a new team (or re-session an existing one) — Restrict strictly to authorizedTeams & Admin
app.post('/api/team/register', async (req, res) => {
  const { teamId, teamName, githubLink } = req.body;
  if (!teamId || !teamId.trim()) return res.status(400).json({ error: 'Reg ID / Team ID is required' });

  const rawId = teamId.trim();
  const rawName = (teamName || '').trim();

  // String normalizer for flexible case/punctuation-insensitive matching
  const norm = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // 1. Verify Reg ID against authorized master list (100 teams from PDF + Admin bypass)
  let matchedAuth = authorizedTeams.find(t => {
    // Exact Reg ID match (e.g. CODIENYCH-2026-0001)
    if (t.regId.toLowerCase() === rawId.toLowerCase()) return true;
    // Numeric index match (e.g. "1" or "0001" -> CODIENYCH-2026-0001)
    if (/^\d+$/.test(rawId) && (t.id === parseInt(rawId, 10) || t.regId.endsWith('-' + rawId.padStart(4, '0')))) return true;
    // Admin bypass matches (CODIENYCH-ADMIN, ADMIN-TEAM, ADMIN)
    if (t.isAdmin && (rawId.toUpperCase() === 'CODIENYCH-ADMIN' || rawId.toUpperCase() === 'ADMIN-TEAM' || rawId.toUpperCase() === 'ADMIN')) return true;
    return false;
  });

  // 1b. If not in the static list, check admin-added custom teams in db.customTeams
  if (!matchedAuth && Array.isArray(db.customTeams)) {
    const customMatch = db.customTeams.find(t =>
      t.regId && t.regId.toLowerCase() === rawId.toLowerCase()
    );
    if (customMatch) {
      // Shape it to match authorizedTeams format
      matchedAuth = {
        regId: customMatch.regId,
        teamName: customMatch.teamName || rawName || customMatch.regId,
        domain: customMatch.domain || 'Artificial Intelligence & ML',
        leader: customMatch.leader || '',
        college: customMatch.college || '',
        members: customMatch.members || '',
        phone: customMatch.phone || '',
        email: customMatch.email || '',
        isAdmin: false,
        isCustom: true
      };
    }
  }

  if (!matchedAuth) {
    return res.status(403).json({
      error: `Access Denied: "${rawId}" is not a recognized Reg ID. Only authorized teams from CODIENYCH 1.0 (e.g. CODIENYCH-2026-0001 to CODIENYCH-2026-0100) are permitted to enter.`
    });
  }

  // 2. Team Name is optional. If left blank or provided, resolve canonical name from master list
  const canonicalTeamId = matchedAuth.regId;
  const canonicalTeamName = matchedAuth.teamName || rawName || `Team ${matchedAuth.regId}`;
  const teamDomain = matchedAuth.domain;

  if (!db.teams) db.teams = [];
  const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  let existing = db.teams.find(t => 
    (t.teamId && t.teamId.toLowerCase() === canonicalTeamId.toLowerCase()) ||
    (t.regId && t.regId.toLowerCase() === canonicalTeamId.toLowerCase())
  );

  // If local existing has no spins, pull latest from GitHub in case spin was saved in another instance
  if (!existing || !existing.spins || existing.spins.length === 0) {
    try {
      await pullLatestFromGitHub();
      existing = db.teams.find(t => 
        (t.teamId && t.teamId.toLowerCase() === canonicalTeamId.toLowerCase()) ||
        (t.regId && t.regId.toLowerCase() === canonicalTeamId.toLowerCase())
      ) || existing;
    } catch (e) {}
  }

  if (existing) {
    if (!existing.sessionTokens) existing.sessionTokens = [];
    if (!existing.sessionTokens.includes(sessionToken)) existing.sessionTokens.push(sessionToken);
    if (githubLink) existing.githubLink = githubLink.trim();
    if (!existing.college && matchedAuth.college) existing.college = matchedAuth.college;
    if (!existing.leader && matchedAuth.leader) existing.leader = matchedAuth.leader;
    if (!existing.members && matchedAuth.members) existing.members = matchedAuth.members;
    if (!existing.domain && matchedAuth.domain) existing.domain = matchedAuth.domain;
    if (matchedAuth.isAdmin) existing.isAdmin = true;

    saveDB(db);
    scheduleGitHubSync();
    const hasSpun = Boolean(existing.spins && existing.spins.length > 0);
    const assignedProb = hasSpun ? existing.spins[0] : null;
    return res.json({
      success: true,
      sessionToken,
      team: {
        teamId: existing.teamId,
        teamName: existing.teamName,
        githubLink: existing.githubLink || '',
        domain: existing.domain || teamDomain,
        leader: existing.leader || matchedAuth.leader,
        college: existing.college || matchedAuth.college,
        members: existing.members || matchedAuth.members,
        phone: existing.phone || matchedAuth.phone || '',
        email: existing.email || matchedAuth.email || '',
        utr: existing.utr || matchedAuth.utr || '',
        isAdmin: Boolean(matchedAuth.isAdmin),
        hasSpun,
        assignedProblem: assignedProb,
        spins: existing.spins || []
      },
      isReturning: true,
      hasSpun,
      assignedProblem: assignedProb
    });
  }

  const newTeam = {
    id: 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    teamId: canonicalTeamId,
    teamName: canonicalTeamName,
    domain: teamDomain,
    originalTrack: matchedAuth.originalTrack,
    leader: matchedAuth.leader,
    college: matchedAuth.college,
    members: matchedAuth.members,
    size: matchedAuth.size,
    email: matchedAuth.email,
    phone: matchedAuth.phone,
    githubLink: githubLink ? githubLink.trim() : '',
    registeredAt: new Date().toISOString(),
    sessionTokens: [sessionToken],
    isAdmin: Boolean(matchedAuth.isAdmin),
    spins: []
  };

  db.teams.unshift(newTeam);
  saveDB(db);
  scheduleGitHubSync(); // Fire-and-forget — login response not blocked by GitHub API

  res.json({
    success: true,
    sessionToken,
    team: {
      teamId: newTeam.teamId,
      teamName: newTeam.teamName,
      githubLink: newTeam.githubLink,
      domain: newTeam.domain,
      leader: newTeam.leader,
      college: newTeam.college,
      members: newTeam.members,
      phone: newTeam.phone || '',
      email: newTeam.email || '',
      utr: newTeam.utr || '',
      isAdmin: Boolean(newTeam.isAdmin)
    },
    isReturning: false,
    hasSpun: false,
    assignedProblem: null
  });
});

// Get current team session status
app.get('/api/team/status', async (req, res) => {
  const { sessionToken, teamId } = req.query;
  if (!sessionToken && !teamId) return res.status(401).json({ error: 'Session token or Team ID required' });
  if (!db.teams) db.teams = [];

  let team = null;
  if (sessionToken) {
    team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
  }
  if (!team && teamId) {
    const rawId = teamId.trim().toLowerCase();
    team = db.teams.find(t =>
      (t.teamId && t.teamId.toLowerCase() === rawId) ||
      (t.regId && t.regId.toLowerCase() === rawId)
    );
  }

  // If team not found or has no spins in memory, pull fresh from GitHub to verify
  if (!team || !team.spins || team.spins.length === 0) {
    try {
      await pullLatestFromGitHub();
      if (sessionToken) {
        team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken)) || team;
      }
      if (teamId) {
        const rawId = teamId.trim().toLowerCase();
        team = db.teams.find(t =>
          (t.teamId && t.teamId.toLowerCase() === rawId) ||
          (t.regId && t.regId.toLowerCase() === rawId)
        ) || team;
      }
    } catch (e) {}
  }

  if (!team) return res.status(404).json({ error: 'Team session not found' });

  const hasSpun = Boolean(team.spins && team.spins.length > 0);
  const assignedProb = hasSpun ? team.spins[0] : null;
  const team_resp = {
    teamId: team.teamId,
    teamName: team.teamName,
    githubLink: team.githubLink,
    domain: team.domain,
    leader: team.leader,
    college: team.college,
    members: team.members,
    phone: team.phone || '',
    email: team.email || '',
    utr: team.utr || '',
    isAdmin: Boolean(team.isAdmin),
    hasSpun,
    assignedProblem: assignedProb,
    spins: team.spins || []
  };
  res.json({
    team: team_resp,
    hasSpun,
    assignedProblem: assignedProb
  });
});

// Log a spin result for a team (Strictly allows only ONE spin per team, Admin can test spin)
app.post('/api/team/log-spin', async (req, res) => {
  const { sessionToken, teamId, domain, problem } = req.body;
  if (!sessionToken && !teamId) return res.status(401).json({ error: 'Session token or Team ID required' });
  if (!problem) return res.status(400).json({ error: 'Problem statement data required' });
  if (!db.teams) db.teams = [];

  let team = null;
  if (sessionToken) {
    team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
  }
  if (!team && teamId) {
    const rawId = teamId.trim().toLowerCase();
    team = db.teams.find(t => (t.teamId && t.teamId.toLowerCase() === rawId) || (t.regId && t.regId.toLowerCase() === rawId));
  }

  if (!team) return res.status(404).json({ error: 'Team session not found or expired' });

  // STRICT RULE: Only 1 spin per team! (Admin bypass allows test spins)
  if (!team.isAdmin && team.spins && team.spins.length >= 1) {
    return res.status(400).json({
      error: 'Each team is allowed to spin only once! You already have an assigned problem statement.',
      assignedProblem: team.spins[0],
      alreadySpun: true
    });
  }

  const assignedRecord = {
    id: problem.id || problem.problemId,
    problemId: problem.id || problem.problemId,
    domain: domain || team.domain,
    title: problem.title || problem.problemTitle,
    problemTitle: problem.title || problem.problemTitle,
    problem: problem.problem || '',
    expectedSolution: problem.expectedSolution || '',
    description: problem.description || problem.problemDescription,
    problemDescription: problem.description || problem.problemDescription,
    difficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
    problemDifficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
    source: problem.source || 'Default',
    tags: problem.tags || [],
    spunAt: new Date().toISOString()
  };

  team.spins = [assignedRecord]; // Exactly 1 problem statement stored
  team.hasEntered = true;
  saveDB(db);
  debouncedSync(1500); // Non-blocking — data already saved in memory
  res.json({ success: true, spinCount: 1, assignedProblem: assignedRecord });
});

// Sync client-side spin allocation with server database
app.post('/api/team/sync-spin', async (req, res) => {
  const { teamId, domain, problem, githubLink } = req.body;
  if (!teamId || !problem) return res.status(400).json({ error: 'Team ID and problem required' });
  if (!db.teams) db.teams = [];

  const rawId = teamId.trim().toLowerCase();
  const team = db.teams.find(t => (t.teamId && t.teamId.toLowerCase() === rawId) || (t.regId && t.regId.toLowerCase() === rawId));
  if (team) {
    team.hasEntered = true;
    if (githubLink) team.githubLink = githubLink;
    if (!team.spins || team.spins.length === 0) {
      team.spins = [{
        id: problem.id || problem.problemId,
        problemId: problem.id || problem.problemId,
        domain: domain || problem.domain || team.domain,
        title: problem.title || problem.problemTitle,
        problemTitle: problem.title || problem.problemTitle,
        problem: problem.problem || '',
        expectedSolution: problem.expectedSolution || '',
        description: problem.description || problem.problemDescription,
        problemDescription: problem.description || problem.problemDescription,
        difficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
        problemDifficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
        tags: problem.tags || [],
        spunAt: problem.spunAt || new Date().toISOString()
      }];
      saveDB(db);
      debouncedSync(2000); // Batched sync — safe for high concurrency
    }
    return res.json({ success: true, synced: true, teamId: team.teamId });
  } else {
    return res.status(404).json({ error: 'Team not found', synced: false });
  }
});

// Update Team GitHub repository link from main page
app.post('/api/team/github', async (req, res) => {
  const { sessionToken, teamId, githubLink } = req.body;
  if (!sessionToken && !teamId) {
    return res.status(401).json({ error: 'Session token or Team ID required' });
  }

  const cleanLink = (githubLink || '').trim();
  if (!db.teams) db.teams = [];

  let team = null;
  if (sessionToken) {
    team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
  }
  if (!team && teamId) {
    const rawId = teamId.trim().toLowerCase();
    team = db.teams.find(t =>
      (t.teamId && t.teamId.toLowerCase() === rawId) ||
      (t.regId && t.regId.toLowerCase() === rawId)
    );
  }

  if (!team) {
    return res.status(404).json({ error: 'Team session not found' });
  }

  team.githubLink = cleanLink;
  saveDB(db);
  debouncedSync(2000); // Non-blocking — GitHub link update batched

  res.json({
    success: true,
    githubLink: team.githubLink,
    message: cleanLink ? 'GitHub repository link saved successfully! 🚀' : 'GitHub link cleared.'
  });
});

// Helper: Extract structured problem details for PDF and UI consistency
function extractProblemParts(item) {
  if (!item) return { title: 'Assigned Problem Statement', problem: '', expectedSolution: '', tags: [] };
  const title = item.problemTitle || item.title || 'Assigned Problem Statement';
  let probText = item.problem || item.problemText || '';
  let solText = item.expectedSolution || item.solution || '';

  if (!probText || !solText) {
    const rawDesc = item.problemDescription || item.description || '';
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
    tags: item.tags || []
  };
}

// Visitor Endpoint: Download assigned problem statement as PDF (Supports GET and POST with payload fallback)
app.all('/api/team/problem-pdf', (req, res) => {
  try {
    const sessionToken = req.query.sessionToken || (req.body && req.body.sessionToken);
    const teamIdParam = req.query.teamId || (req.body && req.body.teamId);
    const teamNameParam = (req.body && req.body.teamName) || req.query.teamName;
    const githubLinkParam = (req.body && req.body.githubLink) || req.query.githubLink;
    const problemPayload = (req.body && req.body.problem) || null;

    if (!db.teams) db.teams = [];

    let team = null;
    if (sessionToken) {
      team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
    }
    if (!team && teamIdParam) {
      const rawParam = teamIdParam.trim().toLowerCase();
      team = db.teams.find(t => 
        (t.teamId && t.teamId.toLowerCase() === rawParam) ||
        (t.regId && t.regId.toLowerCase() === rawParam)
      );
    }

    // Serverless fallback: if lambda instance does not have team in memory, reconstruct from payload
    if (!team && (teamIdParam || (problemPayload && (problemPayload.title || problemPayload.problemTitle)))) {
      team = {
        teamId: teamIdParam || 'TEAM',
        teamName: teamNameParam || teamIdParam || 'Participating Team',
        githubLink: githubLinkParam || '',
        sessionTokens: sessionToken ? [sessionToken] : [],
        spins: []
      };
      db.teams.push(team);
      saveDB(db);
    }

    if (!team) {
      return res.status(404).send('Team details not found. Please ensure you are registered.');
    }

    // If team has no spin in memory on this instance, restore spin from payload
    if ((!team.spins || team.spins.length === 0) && problemPayload) {
      const restoredSpin = {
        id: problemPayload.id || problemPayload.problemId || 'ps_assigned',
        problemId: problemPayload.id || problemPayload.problemId || 'ps_assigned',
        domain: problemPayload.domain || 'Hackathon Challenge',
        title: problemPayload.title || problemPayload.problemTitle || 'Assigned Problem Statement',
        problemTitle: problemPayload.title || problemPayload.problemTitle || 'Assigned Problem Statement',
        problem: problemPayload.problem || '',
        expectedSolution: problemPayload.expectedSolution || '',
        description: problemPayload.description || problemPayload.problemDescription || '',
        problemDescription: problemPayload.description || problemPayload.problemDescription || '',
        difficulty: problemPayload.difficulty || problemPayload.problemDifficulty || 'Intermediate',
        problemDifficulty: problemPayload.difficulty || problemPayload.problemDifficulty || 'Intermediate',
        tags: problemPayload.tags || [],
        spunAt: problemPayload.spunAt || new Date().toISOString()
      };
      team.spins = [restoredSpin];
      saveDB(db);
    }

    if (!team.spins || team.spins.length === 0) {
      return res.status(400).send('Your team has not spun for a problem statement yet.');
    }

    const spin = team.spins[0];
    const parts = extractProblemParts(spin);
    const PDFLib = PDFDocument || require('pdfkit');
    const doc = new PDFLib({ margin: 36, size: 'A4' });

    const safeTeamId = (team.teamId || 'TEAM').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Problem-Statement-${safeTeamId}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 72;

    // Header Background Banner
    doc.rect(0, 0, pageWidth, 85).fill('#0a0d14');
    doc.fill('#06b6d4').fontSize(20).font('Helvetica-Bold')
       .text('🎯 CODIENYCH 1.0', 36, 16, { align: 'center', width: contentWidth });
    doc.fill('#f1f5f9').fontSize(10).font('Helvetica')
       .text('Official Problem Statement Allocation Sheet', 36, 42, { align: 'center', width: contentWidth });
    doc.fill('#38bdf8').fontSize(8.5).font('Helvetica-Bold')
       .text('VERIFIED HACKATHON ALLOCATION • EXCLUSIVE 1-SPIN ASSIGNMENT', 36, 58, { align: 'center', width: contentWidth });

    doc.y = 98;

    // ── Team Information Box ──
    doc.roundedRect(36, doc.y, contentWidth, 68, 6).fill('#f8fafc').stroke('#cbd5e1');
    const tBoxY = doc.y + 8;
    doc.fill('#0f172a').fontSize(12).font('Helvetica-Bold').text(team.teamName || 'Team', 50, tBoxY);
    doc.fill('#0284c7').fontSize(9.5).font('Helvetica-Bold').text(`Team ID: ${team.teamId || 'N/A'}`, 50, tBoxY + 16);
    if (team.githubLink) {
      doc.fill('#475569').fontSize(8.5).font('Helvetica').text(`GitHub: ${team.githubLink}`, 50, tBoxY + 31);
    } else {
      doc.fill('#94a3b8').fontSize(8.5).font('Helvetica').text('GitHub: Not provided at registration', 50, tBoxY + 31);
    }
    doc.fill('#64748b').fontSize(8).font('Helvetica').text(`Allocated on: ${new Date(spin.spunAt || Date.now()).toLocaleString()}`, 50, tBoxY + 45);

    doc.y += 80;

    // ── Domain & Difficulty Banner ──
    doc.roundedRect(36, doc.y, contentWidth, 26, 4).fill('#1e293b');
    const bY = doc.y + 6;
    doc.fill('#38bdf8').fontSize(9.5).font('Helvetica-Bold').text(`Domain: ${spin.domain || 'General Track'}`, 50, bY);
    doc.fill('#f1f5f9').fontSize(9).font('Helvetica').text(`Difficulty: ${spin.problemDifficulty || spin.difficulty || 'Intermediate'}`, 340, bY, { align: 'right', width: contentWidth - 300 });

    doc.y += 34;

    // ── Assigned Problem Title Card ──
    doc.roundedRect(36, doc.y, contentWidth, 42, 6).fill('#f1f5f9').stroke('#94a3b8');
    doc.fill('#0284c7').fontSize(8).font('Helvetica-Bold').text('ASSIGNED PROBLEM TITLE', 48, doc.y + 6);
    doc.fill('#0f172a').fontSize(11.5).font('Helvetica-Bold').text(parts.title, 48, doc.y + 18, { width: contentWidth - 24, ellipsis: true });

    doc.y += 50;

    // ── 1. PROBLEM STATEMENT Box ──
    const probFont = 'Helvetica';
    const probFontSize = 9;
    doc.font(probFont).fontSize(probFontSize);
    const probTextHeight = doc.heightOfString(parts.problem, { width: contentWidth - 28, lineGap: 2.5 });
    const probBoxHeight = Math.max(55, probTextHeight + 28);

    doc.roundedRect(36, doc.y, contentWidth, probBoxHeight, 6).fill('#f0f9ff').stroke('#38bdf8');
    const pBoxY = doc.y;
    doc.fill('#0369a1').fontSize(8.5).font('Helvetica-Bold').text('📌 1. PROBLEM STATEMENT', 48, pBoxY + 7);
    doc.fill('#1e293b').fontSize(probFontSize).font(probFont).text(parts.problem, 48, pBoxY + 22, {
      width: contentWidth - 24,
      lineGap: 2.5
    });

    doc.y = pBoxY + probBoxHeight + 10;

    // ── 2. EXPECTED SOLUTION Box ──
    const solFont = 'Helvetica';
    const solFontSize = 9;
    doc.font(solFont).fontSize(solFontSize);
    const solTextHeight = doc.heightOfString(parts.expectedSolution, { width: contentWidth - 28, lineGap: 2.5 });
    const solBoxHeight = Math.max(55, solTextHeight + 28);

    if (doc.y + solBoxHeight > doc.page.height - 110) {
      doc.addPage();
      doc.y = 36;
    }

    doc.roundedRect(36, doc.y, contentWidth, solBoxHeight, 6).fill('#ecfdf5').stroke('#10b981');
    const sBoxY = doc.y;
    doc.fill('#047857').fontSize(8.5).font('Helvetica-Bold').text('💡 2. EXPECTED SOLUTION & DELIVERABLES', 48, sBoxY + 7);
    doc.fill('#064e3b').fontSize(solFontSize).font(solFont).text(parts.expectedSolution, 48, sBoxY + 22, {
      width: contentWidth - 24,
      lineGap: 2.5
    });

    doc.y = sBoxY + solBoxHeight + 10;

    // ── Tags / Tech Stack ──
    if (parts.tags && parts.tags.length > 0) {
      doc.fill('#64748b').fontSize(8).font('Helvetica-Bold')
         .text('Recommended Tech / Tags:  #' + parts.tags.join('   #'), 48, doc.y);
      doc.y += 14;
    }

    // ── Guidelines & Submission Rules ──
    if (doc.y + 70 > doc.page.height - 40) {
      doc.addPage();
      doc.y = 36;
    }
    doc.roundedRect(36, doc.y, contentWidth, 75, 6).fill('#fffbeb').stroke('#f59e0b');
    const gY = doc.y + 7;
    doc.fill('#92400e').fontSize(8.5).font('Helvetica-Bold').text('📋 Competition Guidelines & Submission Criteria', 48, gY);
    doc.fill('#78350f').fontSize(7.8).font('Helvetica');
    const rules = [
      '• Single Problem Allocation: Each team is granted strictly 1 spin and 1 problem statement.',
      '• Version Control: Commit all project code, documentation, and architecture diagrams to your Git repository.',
      '• Authenticity: Solution must be conceptualized and coded exclusively during this hackathon event.',
      '• Evaluation Metrics: Innovation, problem coverage, engineering quality, usability, and presentation.'
    ];
    let rY = gY + 14;
    rules.forEach(rule => {
      doc.text(rule, 48, rY, { width: contentWidth - 24 });
      rY += 12;
    });

    // ── Footer / Signature Line ──
    doc.moveTo(36, doc.page.height - 30).lineTo(pageWidth - 36, doc.page.height - 30).strokeColor('#cbd5e1').stroke();
    doc.fill('#94a3b8').fontSize(7.5).font('Helvetica')
       .text(`Official Document • Team: ${team.teamName} (${team.teamId}) • Problem Statement Verification`,
             36, doc.page.height - 22, { align: 'center', width: contentWidth });

    doc.end();
  } catch (err) {
    console.error('Visitor PDF generation error:', err);
    if (!res.headersSent) res.status(500).send('Error generating PDF: ' + err.message);
  }
});

// ─── ADMIN: TEAMS DASHBOARD ───────────────────────────────────────────────────

// Get all teams with activity data & complete master sheet metadata
app.get('/api/admin/teams', adminAuthMiddleware, (req, res) => {
  const teams = (db.teams || []).map(t => ({
    id: t.id,
    teamId: t.teamId,
    regId: t.regId || t.teamId,
    teamName: t.teamName,
    originalTrack: t.originalTrack || '',
    domain: t.domain || '',
    leader: t.leader || '',
    phone: t.phone || '',
    email: t.email || '',
    college: t.college || '',
    members: t.members || '',
    size: t.size || 4,
    utr: t.utr || '',
    githubLink: t.githubLink || '',
    hasEntered: Boolean(t.hasEntered || (t.sessionTokens && t.sessionTokens.length) || (t.spins && t.spins.length)),
    registeredAt: t.registeredAt,
    isAdmin: Boolean(t.isAdmin),
    spinCount: (t.spins || []).length,
    spins: t.spins || []
  }));

  const allocatedCount = teams.filter(t => t.spinCount > 0).length;
  const pendingCount = teams.length - allocatedCount;

  res.json({
    teams,
    total: teams.length,
    allocatedCount,
    pendingCount,
    totalSpins: allocatedCount
  });
});

// Admin: Reset Spin for a Team
app.post('/api/admin/teams/reset-spin', adminAuthMiddleware, async (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: 'Team ID required' });
  const rawId = teamId.trim().toLowerCase();
  const team = (db.teams || []).find(t => (t.teamId && t.teamId.toLowerCase() === rawId) || (t.regId && t.regId.toLowerCase() === rawId));
  if (!team) return res.status(404).json({ error: 'Team not found' });

  team.spins = [];
  team.spinResetAt = new Date().toISOString();
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: `Spin reset for team "${team.teamName}". They can spin again.` });
});

// ─── ADMIN: CUSTOM TEAMS (ADD BEYOND ORIGINAL 101) ───────────────────────────

// List all custom (admin-added) teams
app.get('/api/admin/teams/custom', adminAuthMiddleware, (req, res) => {
  if (!db.customTeams) db.customTeams = [];
  res.json({ customTeams: db.customTeams, total: db.customTeams.length });
});

// Add a new custom team
app.post('/api/admin/teams/add-custom', adminAuthMiddleware, async (req, res) => {
  const { regId, teamName, domain, leader, college, members, phone, email } = req.body;
  if (!regId || !regId.trim()) return res.status(400).json({ error: 'Reg ID is required' });
  if (!teamName || !teamName.trim()) return res.status(400).json({ error: 'Team Name is required' });

  const cleanRegId = regId.trim();
  if (!db.customTeams) db.customTeams = [];

  // Check uniqueness across both static and custom lists
  const alreadyInStatic = authorizedTeams.some(t => t.regId.toLowerCase() === cleanRegId.toLowerCase());
  const alreadyInCustom = db.customTeams.some(t => t.regId.toLowerCase() === cleanRegId.toLowerCase());
  if (alreadyInStatic || alreadyInCustom) {
    return res.status(409).json({ error: `Reg ID "${cleanRegId}" already exists. Please choose a unique ID.` });
  }

  const newCustomTeam = {
    id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    regId: cleanRegId,
    teamName: teamName.trim(),
    domain: domain || 'Artificial Intelligence & ML',
    leader: (leader || '').trim(),
    college: (college || '').trim(),
    members: (members || '').trim(),
    phone: (phone || '').trim(),
    email: (email || '').trim(),
    addedAt: new Date().toISOString()
  };

  db.customTeams.push(newCustomTeam);
  saveDB(db);
  await syncToGitHub();

  res.json({
    success: true,
    team: newCustomTeam,
    message: `Team "${newCustomTeam.teamName}" (${cleanRegId}) added successfully! They can now log in and spin.`
  });
});

// Delete a custom team (removes login access; does NOT delete their spin record)
app.delete('/api/admin/teams/delete-custom/:teamId', adminAuthMiddleware, async (req, res) => {
  const cleanId = decodeURIComponent(req.params.teamId).trim().toLowerCase();
  if (!db.customTeams) db.customTeams = [];

  const idx = db.customTeams.findIndex(t => t.regId.toLowerCase() === cleanId);
  if (idx === -1) {
    return res.status(404).json({ error: `Custom team "${cleanId}" not found` });
  }

  const removed = db.customTeams.splice(idx, 1)[0];
  saveDB(db);
  await syncToGitHub();

  res.json({
    success: true,
    message: `Custom team "${removed.teamName}" (${removed.regId}) removed. Their spin history is preserved in Teams Activity.`
  });
});

// Admin: Manually Assign Problem to a Team
app.post('/api/admin/teams/assign-problem', adminAuthMiddleware, async (req, res) => {
  const { teamId, problemId } = req.body;
  if (!teamId || !problemId) return res.status(400).json({ error: 'Team ID and Problem ID required' });
  const rawId = teamId.trim().toLowerCase();
  const team = (db.teams || []).find(t => (t.teamId && t.teamId.toLowerCase() === rawId) || (t.regId && t.regId.toLowerCase() === rawId));
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const problem = (db.problems || []).find(p => p.id === problemId);
  if (!problem) return res.status(404).json({ error: 'Problem statement not found' });

  team.spins = [{
    id: problem.id,
    problemId: problem.id,
    domain: problem.domain,
    title: problem.title,
    problemTitle: problem.title,
    problem: problem.problem || '',
    expectedSolution: problem.expectedSolution || '',
    description: problem.description || problem.problem || '',
    problemDescription: problem.description || problem.problem || '',
    difficulty: problem.difficulty || 'Intermediate',
    problemDifficulty: problem.difficulty || 'Intermediate',
    source: problem.source || 'Admin Assigned',
    tags: problem.tags || [],
    spunAt: new Date().toISOString()
  }];
  team.hasEntered = true;
  saveDB(db);
  await syncToGitHub();
  res.json({ success: true, message: `Problem "${problem.title}" assigned to team "${team.teamName}".` });
});

// Admin: Restore Database Backup
app.post('/api/admin/backup/restore', adminAuthMiddleware, (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.teams) {
    return res.status(400).json({ error: 'Invalid backup format' });
  }
  if (Array.isArray(backupData.teams)) db.teams = backupData.teams;
  if (Array.isArray(backupData.problems) && backupData.problems.length > 0) db.problems = backupData.problems;
  if (Array.isArray(backupData.domains) && backupData.domains.length > 0) db.domains = backupData.domains;
  saveDB(db);
  scheduleGitHubSync();
  res.json({ success: true, message: `Database successfully restored! Loaded ${db.teams.length} teams.` });
});

// Generate & download Master PDF report of all team activity
app.get('/api/admin/teams/pdf', adminAuthMiddleware, (req, res) => {
  try {
    const PDFLib = PDFDocument || require('pdfkit');
    const doc = new PDFLib({ margin: 40, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="CODIENYCH-1.0-Teams-Report.pdf"');
    doc.pipe(res);

    const teams = db.teams || [];
    const totalSpins = teams.filter(t => t.spins && t.spins.length > 0).length;
    const now = new Date().toLocaleString();

    // Header Banner
    doc.rect(0, 0, doc.page.width, 90).fill('#0a0d14');
    doc.fill('#06b6d4').fontSize(22).font('Helvetica-Bold').text('CODIENYCH 1.0', 40, 20, { align: 'center', width: doc.page.width - 80 });
    doc.fill('#f1f5f9').fontSize(11).font('Helvetica').text('Master Team Registration & Problem Statement Allocation Report', 40, 48, { align: 'center', width: doc.page.width - 80 });
    doc.fill('#94a3b8').fontSize(9).text('Generated: ' + now, 40, 68, { align: 'center', width: doc.page.width - 80 });

    doc.y = 104; doc.fill('#1e293b');

    // Summary Box
    doc.roundedRect(40, doc.y, doc.page.width - 80, 54, 6).fill('#f0f9ff').stroke('#bae6fd');
    const sumY = doc.y + 10;
    doc.fill('#0c4a6e').fontSize(11).font('Helvetica-Bold').text('Summary Statistics', 55, sumY);
    doc.fill('#1e40af').fontSize(9.5).font('Helvetica')
       .text(`Total Registered Teams: ${teams.length}`, 55, sumY + 16)
       .text(`Allocated Problem Statements: ${totalSpins}`, 55, sumY + 30);
    doc.fill('#1e40af').fontSize(9.5)
       .text(`Pending Teams: ${teams.length - totalSpins}`, 320, sumY + 16)
       .text(`Allocated Percentage: ${teams.length ? ((totalSpins / teams.length) * 100).toFixed(0) : 0}%`, 320, sumY + 30);
    doc.y += 66; doc.fill('#000000');

    if (teams.length === 0) {
      doc.fontSize(12).font('Helvetica').fill('#64748b').text('No teams found in database.', { align: 'center' });
    } else {
      teams.forEach((team, idx) => {
        if (doc.y > doc.page.height - 140) doc.addPage();
        const hY = doc.y;
        const hasSpun = team.spins && team.spins.length > 0;
        doc.rect(40, hY, doc.page.width - 80, 24).fill(hasSpun ? '#1e3a5f' : '#334155');
        doc.fill('#ffffff').fontSize(10).font('Helvetica-Bold')
           .text(`${idx + 1}.  ${team.teamName}  (Reg ID: ${team.teamId || team.regId})`, 50, hY + 6);
        
        const statusLabel = hasSpun ? 'ALLOCATED' : 'PENDING';
        doc.fill(hasSpun ? '#38bdf8' : '#fbbf24').fontSize(8.5).font('Helvetica-Bold')
           .text(statusLabel, doc.page.width - 130, hY + 6, { align: 'right', width: 80 });

        doc.y = hY + 28;
        doc.fill('#334155').fontSize(9).font('Helvetica');

        const leaderInfo = team.leader ? `Leader: ${team.leader}${team.phone ? ` (${team.phone})` : ''}` : '';
        const collegeInfo = team.college ? `College: ${team.college}` : '';
        const trackInfo = (team.domain || team.originalTrack) ? `Track: ${team.domain || team.originalTrack}` : '';
        
        const line1 = [leaderInfo, collegeInfo].filter(Boolean).join('  |  ');
        if (line1) {
          doc.text(line1, 50, doc.y, { width: doc.page.width - 100 });
          doc.y += doc.currentLineHeight() + 3;
        }

        const line2 = [trackInfo, team.githubLink ? `GitHub: ${team.githubLink}` : ''].filter(Boolean).join('  |  ');
        if (line2) {
          doc.text(line2, 50, doc.y, { width: doc.page.width - 100 });
          doc.y += doc.currentLineHeight() + 3;
        }

        if (hasSpun) {
          const spin = team.spins[0];
          doc.fill('#0369a1').fontSize(9).font('Helvetica-Bold')
             .text(`Assigned Challenge: [${spin.domain}] ${spin.title || spin.problemTitle}`, 50, doc.y);
          doc.y += doc.currentLineHeight() + 2;
          doc.fill('#64748b').fontSize(8).font('Helvetica')
             .text(`Difficulty: ${spin.difficulty || 'Intermediate'}  •  Allocated: ${new Date(spin.spunAt).toLocaleString()}`, 50, doc.y);
          doc.y += doc.currentLineHeight() + 6;
        } else {
          doc.fill('#94a3b8').fontSize(8.5).font('Helvetica-Oblique').text('Status: Awaiting participant spin draw.', 50, doc.y);
          doc.y += doc.currentLineHeight() + 6;
        }

        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#e2e8f0').stroke();
        doc.y += 8;
      });
    }

    // Page footers
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fill('#94a3b8').fontSize(8).font('Helvetica')
         .text(`CODIENYCH 1.0 – Official Event Master Sheet  •  Page ${i + 1} of ${range.count}`,
               40, doc.page.height - 24, { align: 'center', width: doc.page.width - 80 });
    }
    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
  }
});

// Restore Sample Data Endpoint (Admin Only) — Preserves Registered Teams!
app.post('/api/reset-data', adminAuthMiddleware, (req, res) => {
  const preservedTeams = db.teams || [];
  db = {
    problems: [...sampleProblems],
    documents: [],
    domains: [
      "Artificial Intelligence & ML",
      "Cybersecurity & Privacy",
      "Web & Mobile Development",
      "Internet of Things (IoT)",
      "Cloud & DevOps"
    ],
    teams: preservedTeams,
    adminTokens: db.adminTokens || []
  };
  saveDB(db);
  scheduleGitHubSync();
  res.json({ success: true, message: 'Sample dataset successfully restored', totalProblems: db.problems.length });
});

// Pure JS ASCII85 decoder (zero external dependencies)
function ascii85Decode(s) {
  let clean = s.replace(/\s+/g, '').replace(/^<~|~>$/g, '');
  const out = [];
  let tuple = 0, count = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    if (clean[i] === 'z' && count === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    if (c >= 33 && c <= 117) {
      tuple = tuple * 85 + (c - 33);
      count++;
      if (count === 5) {
        out.push(
          (tuple >>> 24) & 0xff,
          (tuple >>> 16) & 0xff,
          (tuple >>> 8) & 0xff,
          tuple & 0xff
        );
        tuple = 0;
        count = 0;
      }
    }
  }
  if (count > 1) {
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84;
    for (let i = 0; i < count - 1; i++) out.push((tuple >>> (24 - i * 8)) & 0xff);
  }
  return Buffer.from(out);
}

// Unescape PDF literal string
function unescapePdfString(s) {
  return s
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// Zero-dependency pure JavaScript PDF Text Extractor
// Unpacks ReportLab, Adobe, PDFKit and standard PDF streams (FlateDecode + ASCII85)
function extractPdfTextPure(buf) {
  const str = buf.toString('latin1');
  let fullText = '';

  const objRegex = /(\d+)\s+0\s+obj\s*<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)endstream/g;
  let match;

  while ((match = objRegex.exec(str)) !== null) {
    const dict = match[2];
    let rawData = match[3];
    let bytes = Buffer.from(rawData, 'latin1');

    if (dict.includes('ASCII85Decode') || rawData.includes('~>')) {
      bytes = ascii85Decode(bytes.toString('latin1'));
    }

    if (dict.includes('FlateDecode')) {
      try {
        bytes = zlib.inflateSync(bytes);
      } catch (e1) {
        try {
          bytes = zlib.inflateRawSync(bytes);
        } catch (e2) {}
      }
    }

    const decompressedStr = bytes.toString('latin1');
    const btRegex = /BT([\s\S]*?)ET/g;
    let btMatch;

    while ((btMatch = btRegex.exec(decompressedStr)) !== null) {
      const block = btMatch[1];
      const tjRegex = /(?:\((?:\\.|[^\)\\])*\)\s*(?:Tj|'|")|\[(?:[^\]]*)\]\s*TJ)/g;
      let tMatch;
      let lineText = '';

      while ((tMatch = tjRegex.exec(block)) !== null) {
        const item = tMatch[0];
        if (item.endsWith('TJ')) {
          const sub = item.match(/\((?:\\.|[^\)\\])*\)/g);
          if (sub) {
            lineText += sub.map(s => unescapePdfString(s.slice(1, -1))).join('');
          }
        } else {
          const paren = item.match(/\((?:\\.|[^\)\\])*\)/);
          if (paren) {
            lineText += unescapePdfString(paren[0].slice(1, -1));
          }
        }
        lineText += ' ';
      }

      if (lineText.trim()) {
        fullText += lineText.trim() + '\n';
      }
    }
  }

  return fullText.trim();
}

// PDF Text Extraction Engine with multi-method fallbacks
async function extractTextFromPDF(buffer) {
  let text = '';

  // Method 1: Pure JavaScript zero-dependency extractor (works 100% on serverless lambda without native bindings)
  try {
    text = extractPdfTextPure(buffer);
  } catch (pureErr) {
    console.warn('Pure JS PDF extraction attempt failed:', pureErr.message);
  }

  // Method 2: Modern pdf-parse v2+ PDFParse class (if available)
  if (!text || text.length < 20) {
    if (pdfParseModule && pdfParseModule.PDFParse) {
      try {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        if (res && typeof res.text === 'string' && res.text.trim()) {
          text = res.text;
        }
      } catch (err1) {
        console.warn('PDFParse class extraction attempt:', err1.message);
      }
    }
  }

  // Method 3: Legacy pdf-parse v1 function (if available)
  if (!text || text.length < 20) {
    if (pdfParseModule && typeof pdfParseModule === 'function') {
      try {
        const res = await pdfParseModule(buffer);
        if (res && typeof res.text === 'string' && res.text.trim()) {
          text = res.text;
        }
      } catch (err2) {
        console.warn('Legacy pdfParse function extraction attempt:', err2.message);
      }
    }
  }

  // Method 4: Regex stream extraction fallback for uncompressed/direct text streams
  if (!text || text.length < 20) {
    try {
      const raw = buffer.toString('latin1');
      const matches = raw.match(/\((?:\\.|[^\)\\])*\)\s*(?:Tj|'|TJ)/g);
      if (matches && matches.length > 0) {
        text = matches.map(m => {
          return m.replace(/^[\(\[]|[\)\]]\s*(?:Tj|'|TJ)$/g, '')
            .replace(/\\([()\\])/g, '$1')
            .replace(/\\r/g, '\r')
            .replace(/\\n/g, '\n');
        }).join(' ');
      }
    } catch (err3) {
      console.warn('Raw PDF stream extraction attempt:', err3.message);
    }
  }

  const clean = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\f/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!clean) {
    throw new Error('The PDF appears to have no selectable text layers. If it is a scanned document or photograph, please provide a text-searchable PDF, DOCX, TXT, CSV, or JSON file.');
  }

  return clean;
}

// Intelligent Text Statement Splitter with dedicated support for user's PDF format
// (Title | Problem | Expected Solution)
function parseStatementsFromText(text, targetDomain, sourceName) {
  const problems = [];
  const clean = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\f/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  // Check if text matches the "Title -> Problem -> Expected Solution" PDF format
  const hasProblemKeywords = /(?:^|\n)\s*(?:(?:#|\d+[\.:\-\)])\s*)?Problem\s*(?:\n|:)/i.test(clean);
  const hasExpectedSolutionKeywords = /(?:^|\n)\s*Expected\s+Solution\s*(?:\n|:)/i.test(clean);

  if (hasProblemKeywords && hasExpectedSolutionKeywords) {
    // ── SPECIFIC "Title | Problem | Expected Solution" PDF PARSER ──
    const rawSections = clean.split(/(?=\n\s*(?:(?:#|\d+[\.:\-\)])\s*)?Problem\s*(?:\n|:))/i);
    let currentCategory = '';

    for (let i = 0; i < rawSections.length; i++) {
      const sec = rawSections[i];
      const probMatch = sec.match(/^\s*(?:(?:#|\d+[\.:\-\)])\s*)?Problem\s*(?:\n|:)/i);
      if (!probMatch) continue; // Skip initial preamble/header

      let title = '';
      let candidateTitleLines = [];

      if (i > 0) {
        const prevSec = rawSections[i - 1];
        const expIdx = prevSec.search(/Expected\s+Solution/i);

        if (expIdx !== -1) {
          const afterExp = prevSec.substring(expIdx);
          const expLines = afterExp.split('\n').map(l => l.trim()).filter(Boolean);
          if (expLines.length > 2) {
            const bottomLines = [];
            for (let b = expLines.length - 1; b >= 1; b--) {
              const line = expLines[b];
              if (line.toLowerCase().startsWith('suggested tech:') || line.endsWith('.') || line.length > 120) {
                break;
              }
              bottomLines.unshift(line);
            }
            candidateTitleLines = bottomLines;
          }
        } else {
          // Document header preamble
          const prevLines = prevSec.split('\n').map(l => l.trim()).filter(Boolean);
          candidateTitleLines = prevLines.filter(l => 
            !l.toLowerCase().includes('problem statements') &&
            !l.toLowerCase().includes('challenges') &&
            !l.toLowerCase().includes('top 20') &&
            !l.includes('Title | Problem') &&
            !l.toLowerCase().startsWith('sih 202')
          );
        }

        if (candidateTitleLines.length === 1) {
          title = candidateTitleLines[0];
        } else if (candidateTitleLines.length >= 2) {
          const firstLine = candidateTitleLines[0];
          // Check if first line is a section banner (e.g. "Smart Automation", "HealthTech", "SpaceTech")
          if (firstLine.length < 35 && !firstLine.includes('System') && !firstLine.includes('App') && !firstLine.includes('Platform')) {
            currentCategory = firstLine;
            title = candidateTitleLines.slice(1).join(' ');
          } else {
            title = candidateTitleLines.join(' ');
          }
        }
      }

      // Strip any leading numbers e.g. "12. "
      title = title.replace(/^\d+[\.:\-\)]\s*/, '').trim();

      // Extract Problem text and Expected Solution text
      const afterProbHeader = sec.replace(/^\s*(?:(?:#|\d+[\.:\-\)])\s*)?Problem\s*(?:\n|:)\s*/i, '');
      const expSolMatch = afterProbHeader.search(/(?:^|\n)\s*Expected\s+Solution\s*(?:\n|:)\s*/i);

      let problemText = '';
      let solutionRaw = '';

      if (expSolMatch !== -1) {
        problemText = afterProbHeader.substring(0, expSolMatch).trim();
        solutionRaw = afterProbHeader.substring(expSolMatch).replace(/^\s*Expected\s+Solution\s*(?:\n|:)\s*/i, '').trim();
      } else {
        problemText = afterProbHeader.trim();
      }

      // Cut off trailing lines from solutionRaw that belong to the NEXT problem's title or category
      let solutionLines = solutionRaw.split('\n').map(l => l.trim()).filter(Boolean);
      if (i < rawSections.length - 1) {
        let cutIndex = solutionLines.length;
        for (let b = solutionLines.length - 1; b >= 1; b--) {
          const line = solutionLines[b];
          if (line.toLowerCase().startsWith('suggested tech:') || line.endsWith('.') || line.length > 120) {
            break;
          }
          cutIndex = b;
        }
        solutionLines = solutionLines.slice(0, cutIndex);
      }
      const finalSolutionText = solutionLines.join('\n').trim();

      // Extract suggested tech tags
      const techMatch = finalSolutionText.match(/Suggested\s+tech\s*:\s*([^.\n]+)/i);
      const tags = [targetDomain];
      if (currentCategory && currentCategory !== targetDomain) tags.push(currentCategory);
      if (techMatch && techMatch[1]) {
        const techList = techMatch[1]
          .split(/[,/]/)
          .map(t => t.trim().replace(/^\(|\)$/g, ''))
          .filter(t => t.length > 1 && t.length < 30);
        tags.push(...techList);
      }

      // Determine difficulty heuristic
      let diff = 'Intermediate';
      const fullText = (title + ' ' + problemText + ' ' + finalSolutionText).toLowerCase();
      if (fullText.includes('reinforcement learning') || fullText.includes('deep-learning') || fullText.includes('advanced') || fullText.includes('complex') || fullText.includes('segmentation') || fullText.includes('explainable ai')) {
        diff = 'Advanced';
      } else if (fullText.includes('gamified') || fullText.includes('gamification') || fullText.includes('awareness') || fullText.includes('beginner') || fullText.includes('simple')) {
        diff = 'Beginner';
      }

      const fullDescription = `Problem:\n${problemText}\n\nExpected Solution:\n${finalSolutionText}`;

      problems.push({
        id: 'ps_doc_' + Date.now() + '_' + problems.length + '_' + Math.random().toString(36).substring(2, 5),
        domain: targetDomain, // Fully assigned to the single target domain selected by user
        title: title || `Problem Statement #${problems.length + 1}`,
        problem: problemText,
        expectedSolution: finalSolutionText,
        description: fullDescription,
        difficulty: diff,
        source: sourceName,
        tags: [...new Set(tags)],
        createdAt: new Date().toISOString()
      });
    }

    if (problems.length > 0) {
      return problems;
    }
  }

  // ── FALLBACK FOR GENERIC DOCUMENTS / NUMBERED LISTS ──
  const splitPattern = /(?:^|\n)(?=(?:(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Task\s*|Topic\s*|Q\s*)(?:#?\d+[\.:\-\)]|:|\s*\n)|\d+[\.:\-\)]\s+[A-Z]|#{1,3}\s+(?:Problem|Challenge|Task|\d+)))/i;
  let chunks = clean.split(splitPattern).map(c => c.trim()).filter(Boolean);

  if (chunks.length <= 1) {
    chunks = clean.split(/\n\s*\n+/).map(c => c.trim()).filter(c => c.length >= 25);
  }
  if (chunks.length === 0 && clean.length > 20) {
    chunks = [clean];
  }
  if (chunks.length > 1) {
    const first = chunks[0];
    const firstLines = first.split('\n').map(l => l.trim()).filter(Boolean);
    const hasStatementMarker = /^(?:Problem|PS|Challenge|Task|Q|1[\.:\-\)])/i.test(firstLines[0]);
    if (!hasStatementMarker && (first.length < 90 || firstLines.length <= 2)) {
      chunks.shift();
    }
  }

  chunks.forEach((chunk, i) => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let titleCandidate = lines[0];
    let descCandidate = lines.slice(1).join('\n').trim();

    titleCandidate = titleCandidate.replace(/^(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Topic\s*|Q\s*|Task\s*)?(?:#?\d+[\.:\-\)]|:|\s*-)\s*/i, '');
    titleCandidate = titleCandidate.replace(/^[\*#\-_]+\s*/, '').replace(/\s*[\*#\-_]+$/, '');

    if (!descCandidate || descCandidate.length < 15) {
      if (titleCandidate.length > 60) {
        descCandidate = titleCandidate;
        titleCandidate = titleCandidate.substring(0, 50) + '...';
      } else {
        descCandidate = titleCandidate;
        titleCandidate = `Problem Statement #${i + 1}`;
      }
    }

    let diff = 'Intermediate';
    const lower = chunk.toLowerCase();
    if (lower.includes('advanced') || lower.includes('high') || lower.includes('complex') || lower.includes('expert')) {
      diff = 'Advanced';
    } else if (lower.includes('beginner') || lower.includes('easy') || lower.includes('simple') || lower.includes('starter')) {
      diff = 'Beginner';
    }

    const defaultSol = 'Design and implement a complete, production-grade software solution addressing the core challenges, with clean architecture and deployment artifacts.';

    problems.push({
      id: 'ps_doc_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
      domain: targetDomain,
      title: titleCandidate || `Problem Statement #${i + 1}`,
      problem: descCandidate || titleCandidate,
      expectedSolution: defaultSol,
      description: descCandidate || titleCandidate,
      difficulty: diff,
      source: sourceName,
      tags: [targetDomain],
      createdAt: new Date().toISOString()
    });
  });

  return problems;
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// Catches any unhandled errors from route handlers. Without this, Express
// may return a blank 500 response on Vercel serverless with no message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err && err.message ? err.message : err);
  if (res.headersSent) return;
  res.status(500).json({
    error: 'Internal server error. Please try again.',
    details: process.env.NODE_ENV !== 'production' ? (err && err.message) : undefined
  });
});

module.exports = app;
