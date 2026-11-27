const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');

const app = express();

const ADMIN_USER = "gisan";
const ADMIN_PASS = "bios";
const SESSION_SECRET = "github_netlify_pro_secret_999";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "gisan001";
const REPO_NAME = "bios_panel";
const FILE_PATH = "users.json";
const EXE_DOWNLOAD_URL = "https://raw.githubusercontent.com/gisan001/bios_panel/main/Aim.exe";

// I considered handling template strings via string concatenation to avoid escaping errors entirely, 
// but clean template blocks are easier to maintain when the proper syntax is restored.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

async function getGitHubFile() {
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'Netlify-Function',
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!res.ok) {
            return { content: [], sha: null };
        }
        const data = await res.json();
        const jsonString = Buffer.from(data.content, 'base64').toString('utf8');
        return { content: JSON.parse(jsonString), sha: data.sha };
    } catch (e) {
        return { content: [], sha: null };
    }
}

async function saveGitHubFile(users, sha) {
    const jsonString = JSON.stringify(users, null, 2);
    const base64Content = Buffer.from(jsonString).toString('base64');
    
    const body = {
        message: "Update users.json via professional dashboard",
        content: base64Content
    };
    if (sha) {
        body.sha = sha;
    }

    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Netlify-Function',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
    });
    return res.ok;
}

const professionalCSS = `
    <style>
        :root {
            --bg: #0d1117;
            --card-bg: #161b22;
            --border: #30363d;
            --text: #c9d1d9;
            --text-muted: #8b949e;
            --accent: #238636;
            --accent-hover: #2ea043;
            --danger: #da3633;
            --danger-hover: #f85149;
            --input-bg: #0d1117;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { background-color: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .container { width: 100%; max-width: 900px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); overflow: hidden; }
        .header { padding: 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
        .header h2 { font-size: 20px; font-weight: 600; color: #fff; }
        .content { padding: 24px; }
        form { display: grid; grid-template-columns: 1fr 1.5fr 1fr auto; gap: 12px; margin-bottom: 24px; }
        input, select { background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; transition: border-color 0.2s; width: 100%; }
        input:focus, select:focus { border-color: #58a6ff; }
        button { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 10px 18px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        button:hover { background: var(--accent-hover); }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }
        th { background: rgba(255,255,255,0.02); color: var(--text-muted); font-weight: 600; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .badge.active { background: rgba(35,134,54,0.2); color: #3fb950; }
        .badge.expired { background: rgba(218,54,51,0.2); color: #f85149; }
        .btn-danger { background: var(--danger); padding: 6px 12px; font-size: 12px; text-decoration: none; color: white; border-radius: 4px; display: inline-block; transition: background 0.2s; }
        .btn-danger:hover { background: var(--danger-hover); }
        .login-box { max-width: 400px; margin: auto; padding: 32px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
        .login-box h2 { margin-bottom: 20px; color: #fff; text-align: center; }
        .login-box input { margin-bottom: 14px; }
        .login-box button { width: 100%; padding: 12px; }
        .error-msg { color: var(--danger-hover); font-size: 13px; text-align: center; margin-bottom: 12px; }
    </style>
`;

app.get('/', (req, res) => {
    if (req.cookies.auth === SESSION_SECRET) return res.redirect('/dashboard');
    res.send(`<!DOCTYPE html><html><head><title>Admin Login</title>${professionalCSS}</head><body>
        <div class="login-box">
            <h2>System Authentication</h2>
            <form method="POST" action="/login" style="display: block;">
                <input name="user" placeholder="Username" required autocomplete="off" />
                <input name="pass" type="password" placeholder="Password" required />
                <button type="submit">Authenticate</button>
            </form>
        </div>
    </body></html>`);
});

app.post('/login', (req, res) => {
    if (req.body.user === ADMIN_USER && req.body.pass === ADMIN_PASS) {
        res.cookie('auth', SESSION_SECRET, { httpOnly: true, secure: true });
        return res.redirect('/dashboard');
    }
    res.send(`<!DOCTYPE html><html><head><title>Login Failed</title>${professionalCSS}</head><body>
        <div class="login-box">
            <h2>Authentication Failed</h2>
            <p class="error-msg">Invalid username or password supplied.</p>
            <button onclick="window.location.href='/'">Try Again</button>
        </div>
    </body></html>`);
});

app.get('/dashboard', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const { content: users } = await getGitHubFile();
    
    const now = Date.now();
    const rows = users.map(u => {
        const active = u.expiresAt > now;
        const remainingMs = Math.max(0, u.expiresAt - now);
        const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        let timeStr = active ? (days > 0 ? `${days}d ${hours}h left` : `${hours}h left`) : 'Expired';
        if (u.expiresAt > now + 100 * 365 * 24 * 3600 * 1000) timeStr = 'Lifetime';

        return `<tr>
            <td><strong>${u.name}</strong></td>
            <td><code>${u.hwid}</code></td>
            <td><span class="badge ${active ? 'active' : 'expired'}">${timeStr}</span></td>
            <td><a href="/delete?hwid=${encodeURIComponent(u.hwid)}" class="btn-danger">Delete</a></td>
        </tr>`;
    }).join('');

    res.send(`<!DOCTYPE html><html><head><title>HWID Control Panel</title>${professionalCSS}</head><body>
        <div class="container">
            <div class="header">
                <h2>HWID Authorization Panel</h2>
                <a href="/" style="color: var(--text-muted); text-decoration: none; font-size: 13px;">Logout</a>
            </div>
            <div class="content">
                <form method="POST" action="/add">
                    <input name="name" placeholder="Client Name" required autocomplete="off" />
                    <input name="hwid" placeholder="PC SID / HWID" required autocomplete="off" />
                    <select name="duration" required>
                        <option value="" disabled selected>Select Duration</option>
                        <option value="1month">1 Month</option>
                        <option value="2month">2 Months</option>
                        <option value="4month">4 Months</option>
                        <option value="lifetime">Lifetime</option>
                    </select>
                    <button type="submit">Add / Update</button>
                </form>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>HWID / SID</th>
                            <th>Status / Duration</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length ? rows : '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 24px;">No hardware records found.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </body></html>`);
});

app.post('/add', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const { name, hwid, duration } = req.body;
    const { content: currentUsers, sha } = await getGitHubFile();
    
    let expiresAt = Date.now();
    if (duration === '1month') expiresAt += 30 * 24 * 3600 * 1000;
    else if (duration === '2month') expiresAt += 60 * 24 * 3600 * 1000;
    else if (duration === '4month') expiresAt += 120 * 24 * 3600 * 1000;
    else if (duration === 'lifetime') expiresAt += 1000 * 365 * 24 * 3600 * 1000;

    let users = currentUsers.filter(u => u.hwid !== hwid.trim());
    users.push({
        name: name.trim(),
        hwid: hwid.trim(),
        expiresAt: expiresAt
    });
    
    await saveGitHubFile(users, sha);
    res.redirect('/dashboard');
});

app.get('/delete', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const { content: currentUsers, sha } = await getGitHubFile();
    let users = currentUsers.filter(u => u.hwid !== req.query.hwid);
    await saveGitHubFile(users, sha);
    res.redirect('/dashboard');
});

app.get('/exe', async (req, res) => {
    const hwid = (req.query.hwid || '').trim();
    const { content: users } = await getGitHubFile();
    const found = users.find(u => u.hwid === hwid);

    if (!found || Date.now() > found.expiresAt) {
        return res.status(403).send('Unauthorized or Expired');
    }
    return res.redirect(302, EXE_DOWNLOAD_URL);
});

module.exports.handler = serverless(app);
