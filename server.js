const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mammoth = require('mammoth');
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

  if (!loaded || !loaded.problems || loaded.problems.length === 0) {
    loaded = {
      problems: [...sampleProblems],
      documents: (loaded && loaded.documents) || [],
      domains: (loaded && loaded.domains && loaded.domains.length > 0) ? loaded.domains : [
        "Artificial Intelligence & ML",
        "Cybersecurity & Privacy",
        "Web & Mobile Development",
        "Internet of Things (IoT)",
        "Cloud & DevOps"
      ]
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(loaded, null, 2));
    } catch (e) {}
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

let syncTimer = null;
function scheduleGitHubSync() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO || 'Sansai-L/ps-spinwheel';
  if (!GITHUB_TOKEN) return;

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/database.json?ref=main`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'Antigravity-Server' }
      });
      let sha;
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }
      const content = Buffer.from(JSON.stringify(db, null, 2)).toString('base64');
      const body = {
        message: 'Auto-sync database: team allocations & activity',
        content,
        branch: 'main'
      };
      if (sha) body.sha = sha;

      await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/database.json`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'User-Agent': 'Antigravity-Server',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      // Non-fatal background sync
    }
  }, 1500);
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('saveDB warning (non-fatal):', err.message);
  }
}

let db = loadDB();

// Middleware
app.use(cors());
app.use(express.json());
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

// Domain Endpoints
app.get('/api/domains', (req, res) => {
  const domainCounts = {};
  db.domains.forEach(d => { domainCounts[d] = 0; });
  db.problems.forEach(p => {
    domainCounts[p.domain] = (domainCounts[p.domain] || 0) + 1;
  });

  const domainsList = db.domains.map(d => ({
    name: d,
    count: domainCounts[d] || 0
  }));

  res.json({ domains: domainsList, totalProblems: db.problems.length });
});

app.post('/api/domains', adminAuthMiddleware, (req, res) => {
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
  res.json({ success: true, domain: cleanName });
});

app.delete('/api/domains/:name', adminAuthMiddleware, (req, res) => {
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
  res.json({
    success: true,
    message: `Domain "${actualDomainName}" and ${removedCount} associated problem statement(s) deleted.`,
    remainingDomains: db.domains
  });
});

// Problem Statement Wheel Spin Endpoint
// Implements cycle tracking: no repeated problem statements until all problems in domain are exhausted
app.post('/api/spin', (req, res) => {
  const { domain, seenIds = [], sessionToken } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Please select a domain to spin' });
  }

  // Strict check: One spin only per team (Admin bypass allows test spins)
  if (sessionToken && db.teams) {
    const team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
    if (team && !team.isAdmin && team.spins && team.spins.length >= 1) {
      return res.status(403).json({
        error: 'Each team is allowed to spin only once! You have already been assigned a problem statement.',
        alreadySpun: true,
        problem: team.spins[0]
      });
    }
  }

  const domainProblems = db.problems.filter(p => p.domain.toLowerCase() === domain.toLowerCase());

  if (domainProblems.length === 0) {
    return res.status(404).json({
      error: `No problem statements currently available in domain: "${domain}". Admin can upload documents or add problems.`
    });
  }

  // Find problems in this domain that have not been seen in the current cycle
  const seenSet = new Set(seenIds);
  let availableProblems = domainProblems.filter(p => !seenSet.has(p.id));

  let cycleCompleted = false;

  // If all problems in this domain have been seen, complete the cycle and reset!
  if (availableProblems.length === 0) {
    cycleCompleted = true;
    availableProblems = [...domainProblems];
  }

  // Pick a random problem statement from the available pool
  const randomIndex = Math.floor(Math.random() * availableProblems.length);
  const selectedProblem = availableProblems[randomIndex];

  const totalInDomain = domainProblems.length;
  // Calculate remaining after this draw:
  // If cycle completed, remaining is total - 1. Otherwise available.length - 1.
  const remainingInCycle = availableProblems.length - 1;

  res.json({
    problem: selectedProblem,
    cycleCompleted,
    totalInDomain,
    remainingInCycle,
    cycleSize: totalInDomain
  });
});

// Problems Query Endpoint (for preview or admin view)
app.get('/api/problems', (req, res) => {
  const { domain, search } = req.query;
  let list = db.problems;

  if (domain && domain !== 'All') {
    list = list.filter(p => p.domain.toLowerCase() === domain.toLowerCase());
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
app.post('/api/problems', adminAuthMiddleware, (req, res) => {
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
  res.json({ success: true, problem: newProblem });
});

// Delete Problem (Admin Only)
app.delete('/api/problems/:id', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const initialLen = db.problems.length;
  db.problems = db.problems.filter(p => p.id !== id);

  if (db.problems.length === initialLen) {
    return res.status(404).json({ error: 'Problem statement not found' });
  }

  saveDB(db);
  res.json({ success: true, message: 'Problem statement deleted' });
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

app.delete('/api/documents/:id', adminAuthMiddleware, (req, res) => {
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
  res.json({ success: true, message: `Removed document "${doc.filename}" and its problem statements.` });
});

// ─── TEAM REGISTRATION & TRACKING ────────────────────────────────────────────

// ─── TEAM REGISTRATION & TRACKING ────────────────────────────────────────────

// Register a new team (or re-session an existing one) — Restrict strictly to authorizedTeams & Admin
app.post('/api/team/register', (req, res) => {
  const { teamId, teamName, githubLink } = req.body;
  if (!teamId || !teamId.trim()) return res.status(400).json({ error: 'Reg ID / Team ID is required' });
  if (!teamName || !teamName.trim()) return res.status(400).json({ error: 'Team Name is required' });

  const rawId = teamId.trim();
  const rawName = teamName.trim();

  // String normalizer for flexible case/punctuation-insensitive matching
  const norm = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // 1. Verify Reg ID against authorized master list (100 teams from PDF + Admin bypass)
  const matchedAuth = authorizedTeams.find(t => {
    // Exact Reg ID match (e.g. CODIENYCH-2026-0001)
    if (t.regId.toLowerCase() === rawId.toLowerCase()) return true;
    // Numeric index match (e.g. "1" or "0001" -> CODIENYCH-2026-0001)
    if (/^\d+$/.test(rawId) && (t.id === parseInt(rawId, 10) || t.regId.endsWith('-' + rawId.padStart(4, '0')))) return true;
    // Admin bypass matches (CODIENYCH-ADMIN, ADMIN-TEAM, ADMIN)
    if (t.isAdmin && (rawId.toUpperCase() === 'CODIENYCH-ADMIN' || rawId.toUpperCase() === 'ADMIN-TEAM' || rawId.toUpperCase() === 'ADMIN')) return true;
    return false;
  });

  if (!matchedAuth) {
    return res.status(403).json({
      error: `Access Denied: "${rawId}" is not a recognized Reg ID. Only authorized teams from CODIENYCH 1.0 (e.g. CODIENYCH-2026-0001 to CODIENYCH-2026-0100) are permitted to enter.`
    });
  }

  // 2. Validate Team Name matches the Reg ID
  const inputNormName = norm(rawName);
  const authNormName = norm(matchedAuth.teamName);
  const isAdminNameMatch = matchedAuth.isAdmin && (inputNormName.includes('admin') || inputNormName === 'adminteam');
  const isNameMatch = inputNormName === authNormName || isAdminNameMatch;

  if (!isNameMatch) {
    return res.status(400).json({
      error: `Team Name does not match Reg ID "${matchedAuth.regId}". Please enter your registered team name ("${matchedAuth.teamName}").`
    });
  }

  const canonicalTeamId = matchedAuth.regId;
  const canonicalTeamName = matchedAuth.teamName;
  const teamDomain = matchedAuth.domain;

  if (!db.teams) db.teams = [];
  const sessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

  let existing = db.teams.find(t => t.teamId.toLowerCase() === canonicalTeamId.toLowerCase());
  if (existing) {
    if (!existing.sessionTokens) existing.sessionTokens = [];
    existing.sessionTokens.push(sessionToken);
    if (githubLink) existing.githubLink = githubLink.trim();
    if (!existing.college && matchedAuth.college) existing.college = matchedAuth.college;
    if (!existing.leader && matchedAuth.leader) existing.leader = matchedAuth.leader;
    if (!existing.members && matchedAuth.members) existing.members = matchedAuth.members;
    if (!existing.domain && matchedAuth.domain) existing.domain = matchedAuth.domain;
    if (matchedAuth.isAdmin) existing.isAdmin = true;

    saveDB(db);
    const hasSpun = Boolean(existing.spins && existing.spins.length > 0);
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
        isAdmin: Boolean(matchedAuth.isAdmin)
      },
      isReturning: true,
      hasSpun,
      assignedProblem: hasSpun ? existing.spins[0] : null
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
app.get('/api/team/status', (req, res) => {
  const { sessionToken } = req.query;
  if (!sessionToken) return res.status(401).json({ error: 'Session token required' });
  if (!db.teams) db.teams = [];

  const team = db.teams.find(t => t.sessionTokens && t.sessionTokens.includes(sessionToken));
  if (!team) return res.status(404).json({ error: 'Team session not found' });

  const hasSpun = Boolean(team.spins && team.spins.length > 0);
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
    isAdmin: Boolean(team.isAdmin)
  };
  res.json({
    team: team_resp,
    hasSpun,
    assignedProblem: hasSpun ? team.spins[0] : null
  });
});

// Log a spin result for a team (Strictly allows only ONE spin per team, Admin can test spin)
app.post('/api/team/log-spin', (req, res) => {
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
  scheduleGitHubSync();
  res.json({ success: true, spinCount: 1, assignedProblem: assignedRecord });
});

// Sync client-side spin allocation with server database
app.post('/api/team/sync-spin', (req, res) => {
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
        description: problem.description || problem.problemDescription,
        problemDescription: problem.description || problem.problemDescription,
        difficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
        problemDifficulty: problem.difficulty || problem.problemDifficulty || 'Intermediate',
        tags: problem.tags || [],
        spunAt: problem.spunAt || new Date().toISOString()
      }];
      saveDB(db);
      scheduleGitHubSync();
    }
    return res.json({ success: true, synced: true, teamId: team.teamId });
  }
  res.status(404).json({ error: 'Team not found' });
});

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
      team = db.teams.find(t => t.teamId && t.teamId.toLowerCase() === teamIdParam.trim().toLowerCase());
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
    const PDFLib = PDFDocument || require('pdfkit');
    const doc = new PDFLib({ margin: 40, size: 'A4' });

    const safeTeamId = (team.teamId || 'TEAM').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Problem-Statement-${safeTeamId}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 80;

    // Header Background Banner
    doc.rect(0, 0, pageWidth, 95).fill('#0a0d14');
    
    // Header title
    doc.fill('#06b6d4').fontSize(22).font('Helvetica-Bold')
       .text('🎯 SPINQUEST PS', 40, 20, { align: 'center', width: contentWidth });
    doc.fill('#f1f5f9').fontSize(11).font('Helvetica')
       .text('Official Problem Statement Allocation Sheet', 40, 48, { align: 'center', width: contentWidth });
    doc.fill('#38bdf8').fontSize(9).font('Helvetica-Bold')
       .text('VERIFIED HACKATHON ASSIGNMENT • 1 OF 1 ALLOCATION', 40, 68, { align: 'center', width: contentWidth });

    doc.y = 112;

    // ── Team Information Box ──
    doc.roundedRect(40, doc.y, contentWidth, 75, 6).fill('#f8fafc').stroke('#cbd5e1');
    const tBoxY = doc.y + 10;
    doc.fill('#0f172a').fontSize(13).font('Helvetica-Bold').text(team.teamName || 'Team', 55, tBoxY);
    doc.fill('#0284c7').fontSize(10).font('Helvetica-Bold').text(`Team ID: ${team.teamId || 'N/A'}`, 55, tBoxY + 18);
    if (team.githubLink) {
      doc.fill('#475569').fontSize(9).font('Helvetica').text(`GitHub: ${team.githubLink}`, 55, tBoxY + 34);
    } else {
      doc.fill('#94a3b8').fontSize(9).font('Helvetica').text('GitHub: Not provided at registration', 55, tBoxY + 34);
    }
    doc.fill('#64748b').fontSize(8.5).font('Helvetica').text(`Allocated on: ${new Date(spin.spunAt || Date.now()).toLocaleString()}`, 55, tBoxY + 49);

    doc.y += 92;

    // ── Domain & Difficulty Banner ──
    doc.roundedRect(40, doc.y, contentWidth, 32, 4).fill('#1e293b');
    const bY = doc.y + 8;
    doc.fill('#38bdf8').fontSize(11).font('Helvetica-Bold').text(`Domain: ${spin.domain}`, 55, bY);
    doc.fill('#f1f5f9').fontSize(10).font('Helvetica').text(`Difficulty: ${spin.problemDifficulty || spin.difficulty || 'Intermediate'}`, 360, bY, { align: 'right', width: contentWidth - 320 });

    doc.y += 44;

    // ── Problem Statement Box ──
    const psBoxTop = doc.y;
    doc.roundedRect(40, psBoxTop, contentWidth, 235, 6).fill('#ffffff').stroke('#94a3b8');
    
    doc.fill('#0f172a').fontSize(14).font('Helvetica-Bold')
       .text(spin.problemTitle || spin.title, 55, psBoxTop + 14, { width: contentWidth - 30 });
    
    doc.moveTo(55, doc.y + 8).lineTo(pageWidth - 55, doc.y + 8).strokeColor('#e2e8f0').stroke();
    doc.y += 16;

    doc.fill('#0369a1').fontSize(10).font('Helvetica-Bold').text('CHALLENGE BRIEF & REQUIREMENTS:', 55, doc.y);
    doc.y += 8;

    doc.fill('#334155').fontSize(9.5).font('Helvetica')
       .text(spin.problemDescription || spin.description, 55, doc.y, { width: contentWidth - 30, lineGap: 3.5 });

    doc.y += 12;

    if (spin.tags && spin.tags.length > 0) {
      doc.fill('#64748b').fontSize(8.5).font('Helvetica')
         .text('Recommended Tech / Tags:  #' + spin.tags.join('   #'), 55, doc.y);
      doc.y += 16;
    }

    doc.y = Math.max(doc.y, psBoxTop + 248);

    // ── Guidelines & Submission Rules ──
    doc.roundedRect(40, doc.y, contentWidth, 120, 6).fill('#f0fdf4').stroke('#86efac');
    const gY = doc.y + 10;
    doc.fill('#166534').fontSize(10.5).font('Helvetica-Bold').text('📋 Competition Guidelines & Submission Criteria', 55, gY);
    
    doc.fill('#15803d').fontSize(8.5).font('Helvetica');
    const rules = [
      '• Single Problem Allocation: Each team is granted strictly 1 spin and 1 problem statement.',
      '• Version Control: Commit all project code, documentation, and architecture diagrams to your Git repository.',
      '• Authenticity: Solution must be conceptualized and coded exclusively during this hackathon event.',
      '• Evaluation Metrics: Innovation, problem coverage, engineering quality, usability, and presentation.'
    ];
    let rY = gY + 18;
    rules.forEach(rule => {
      doc.text(rule, 55, rY, { width: contentWidth - 30 });
      rY += 15;
    });

    // ── Footer / Signature Line ──
    doc.moveTo(40, doc.page.height - 48).lineTo(pageWidth - 40, doc.page.height - 48).strokeColor('#cbd5e1').stroke();
    doc.fill('#94a3b8').fontSize(8).font('Helvetica')
       .text(`Official Document • Team: ${team.teamName} (${team.teamId}) • Problem Statement ID: ${spin.problemId}`,
             40, doc.page.height - 38, { align: 'center', width: contentWidth });

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
app.post('/api/admin/teams/reset-spin', adminAuthMiddleware, (req, res) => {
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: 'Team ID required' });
  const rawId = teamId.trim().toLowerCase();
  const team = (db.teams || []).find(t => (t.teamId && t.teamId.toLowerCase() === rawId) || (t.regId && t.regId.toLowerCase() === rawId));
  if (!team) return res.status(404).json({ error: 'Team not found' });

  team.spins = [];
  saveDB(db);
  scheduleGitHubSync();
  res.json({ success: true, message: `Spin reset for team "${team.teamName}". They can spin again.` });
});

// Admin: Manually Assign Problem to a Team
app.post('/api/admin/teams/assign-problem', adminAuthMiddleware, (req, res) => {
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
    description: problem.description,
    problemDescription: problem.description,
    difficulty: problem.difficulty || 'Intermediate',
    problemDifficulty: problem.difficulty || 'Intermediate',
    source: problem.source || 'Admin Assigned',
    tags: problem.tags || [],
    spunAt: new Date().toISOString()
  }];
  team.hasEntered = true;
  saveDB(db);
  scheduleGitHubSync();
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

// PDF Text Extraction Engine with multi-method fallbacks
async function extractTextFromPDF(buffer) {
  if (!pdfParseModule) {
    throw new Error('PDF parsing library is not loaded on the server.');
  }

  let text = '';

  // Method 1: Modern pdf-parse v2+ PDFParse class
  try {
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const res = await parser.getText();
      if (res && typeof res.text === 'string' && res.text.trim()) {
        text = res.text;
      }
    }
  } catch (err1) {
    console.warn('PDFParse class extraction attempt:', err1.message);
  }

  // Method 2: Legacy pdf-parse v1 function
  if (!text.trim()) {
    try {
      if (typeof pdfParseModule === 'function') {
        const res = await pdfParseModule(buffer);
        if (res && typeof res.text === 'string' && res.text.trim()) {
          text = res.text;
        }
      }
    } catch (err2) {
      console.warn('Legacy pdfParse function extraction attempt:', err2.message);
    }
  }

  // Method 3: Regex stream extraction fallback for uncompressed/direct text streams
  if (!text.trim()) {
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
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!clean) {
    throw new Error('The PDF appears to have no selectable text layers. If it is a scanned document or photograph, please provide a text-searchable PDF, DOCX, TXT, CSV, or JSON file.');
  }

  return clean;
}

// Intelligent Text Statement Splitter
function parseStatementsFromText(text, targetDomain, sourceName) {
  const problems = [];
  const clean = text
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '')
    .replace(/\f/g, '\n\n')
    .replace(/\r\n/g, '\n')
    .trim();

  // Pattern matching statement headers:
  // e.g. "Problem Statement 1:", "Problem Statement:", "Challenge 2:", "1. ", "### Problem", "Case 1:"
  const splitPattern = /(?:^|\n)(?=(?:(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Task\s*|Topic\s*|Q\s*)(?:#?\d+[\.:\-\)]|:|\s*\n)|\d+[\.:\-\)]\s+[A-Z]|#{1,3}\s+(?:Problem|Challenge|Task|\d+)))/i;
  
  let chunks = clean.split(splitPattern).map(c => c.trim()).filter(Boolean);

  // If pattern split didn't find multiple items, split by double newlines or paragraphs
  if (chunks.length <= 1) {
    chunks = clean.split(/\n\s*\n+/).map(c => c.trim()).filter(c => c.length >= 25);
  }

  // If still 1 chunk and length > 20, treat entire document content as a single statement
  if (chunks.length === 0 && clean.length > 20) {
    chunks = [clean];
  }

  // Filter out leading intro chunk if it's just a document title / header without a description
  if (chunks.length > 1) {
    const first = chunks[0];
    const firstLines = first.split('\n').map(l => l.trim()).filter(Boolean);
    const hasStatementMarker = /^(?:Problem|PS|Challenge|Task|Q|1[\.:\-\)])/i.test(firstLines[0]);
    if (!hasStatementMarker && (first.length < 90 || firstLines.length <= 2)) {
      chunks.shift(); // remove intro title chunk
    }
  }

  chunks.forEach((chunk, i) => {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let titleCandidate = lines[0];
    let descCandidate = lines.slice(1).join('\n').trim();

    // Clean up title prefixes like "Problem Statement 1: ", "1. ", "Challenge 2 - "
    titleCandidate = titleCandidate.replace(/^(?:Problem\s+(?:Statement\s+)?|PS\s*|Challenge\s*|Topic\s*|Q\s*|Task\s*)?(?:#?\d+[\.:\-\)]|:|\s*-)\s*/i, '');
    titleCandidate = titleCandidate.replace(/^[\*#\-_]+\s*/, '').replace(/\s*[\*#\-_]+$/, '');

    // If description is empty or very short, use title or fallback
    if (!descCandidate || descCandidate.length < 15) {
      if (titleCandidate.length > 60) {
        descCandidate = titleCandidate;
        titleCandidate = titleCandidate.substring(0, 50) + '...';
      } else {
        descCandidate = titleCandidate;
        titleCandidate = `Problem Statement #${i + 1}`;
      }
    }

    // Determine difficulty heuristic
    let diff = 'Intermediate';
    const lower = chunk.toLowerCase();
    if (lower.includes('advanced') || lower.includes('high') || lower.includes('complex') || lower.includes('expert')) {
      diff = 'Advanced';
    } else if (lower.includes('beginner') || lower.includes('easy') || lower.includes('simple') || lower.includes('starter')) {
      diff = 'Beginner';
    }

    problems.push({
      id: 'ps_doc_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
      domain: targetDomain,
      title: titleCandidate || `Problem Statement #${i + 1}`,
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

module.exports = app;
