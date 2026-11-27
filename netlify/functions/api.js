const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');

const app = express();

const ADMIN_USER = "gisan";
const ADMIN_PASS = "bios";
const SESSION_SECRET = "github_netlify_secret_888";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = "gisan001";
const REPO_NAME = "bios_panel";
const FILE_PATH = "users.json";
const EXE_DOWNLOAD_URL = "https://raw.githubusercontent.com/gisan001/bios_panel/main/Aim.exe";

// I considered maintaining a separate remote database service, but committing directly 
// to the repository keeps the state tied to the code without external dependencies.
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
        message: "Update users.json via dashboard",
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

app.get('/', (req, res) => {
    if (req.cookies.auth === SESSION_SECRET) return res.redirect('/dashboard');
    res.send(`
        <h2>Admin Login</h2>
        <form method="POST" action="/login">
            <input name="user" placeholder="Username" required /><br><br>
            <input name="pass" type="password" placeholder="Password" required /><br><br>
            <button type="submit">Login</button>
        </form>
    `);
});

app.post('/login', (req, res) => {
    if (req.body.user === ADMIN_USER && req.body.pass === ADMIN_PASS) {
        res.cookie('auth', SESSION_SECRET, { httpOnly: true, secure: true });
        return res.redirect('/dashboard');
    }
    res.send('Invalid Login! <a href="/">Back</a>');
});

app.get('/dashboard', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const { content: users } = await getGitHubFile();
    const rows = users.map(u => {
        const mins = Math.max(0, Math.round((u.expiresAt - Date.now()) / 60000));
        return `<tr>
            <td>${u.name}</td>
            <td>${u.hwid}</td>
            <td>${mins > 0 ? mins + ' mins left' : 'EXPIRED'}</td>
            <td><a href="/delete?hwid=${encodeURIComponent(u.hwid)}">Delete</a></td>
        </tr>`;
    }).join('');

    res.send(`
        <h2>HWID Control Panel</h2>
        <form method="POST" action="/add">
            <input name="name" placeholder="User Name" required />
            <input name="hwid" placeholder="PC SID / HWID" required />
            <input name="hours" type="number" step="0.1" placeholder="Hours" required />
            <button type="submit">Add / Update</button>
        </form><br>
        <table border="1" cellpadding="8">
            <tr><th>Name</th><th>HWID / SID</th><th>Status</th><th>Action</th></tr>
            ${rows}
        </table>
    `);
});

app.post('/add', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const { name, hwid, hours } = req.body;
    const { content: currentUsers, sha } = await getGitHubFile();
    let users = currentUsers.filter(u => u.hwid !== hwid.trim());
    users.push({
        name: name.trim(),
        hwid: hwid.trim(),
        expiresAt: Date.now() + (parseFloat(hours) * 3600000)
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
