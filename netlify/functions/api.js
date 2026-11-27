const express = require('express');
const serverless = require('serverless-http');
const cookieParser = require('cookie-parser');

const app = express();

// Configuration (Nijer info bosao)
const ADMIN_USER = "admin";
const ADMIN_PASS = "123456";
const SESSION_SECRET = "netlify_secret_777";
const JSONBIN_ID = "YOUR_JSONBIN_BIN_ID";
const JSONBIN_KEY = "YOUR_JSONBIN_MASTER_KEY";
const EXE_DOWNLOAD_URL = "YOUR_GITHUB_RAW_URL_FOR_AIM_EXE";

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

async function getUsers() {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    const data = await res.json();
    return Array.isArray(data.record) ? data.record : [];
}

async function saveUsers(users) {
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': JSONBIN_KEY
        },
        body: JSON.stringify(users)
    });
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
    const users = await getUsers();
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
    let users = (await getUsers()).filter(u => u.hwid !== hwid.trim());
    users.push({
        name: name.trim(),
        hwid: hwid.trim(),
        expiresAt: Date.now() + (parseFloat(hours) * 3600000)
    });
    await saveUsers(users);
    res.redirect('/dashboard');
});

app.get('/delete', async (req, res) => {
    if (req.cookies.auth !== SESSION_SECRET) return res.redirect('/');
    const users = (await getUsers()).filter(u => u.hwid !== req.query.hwid);
    await saveUsers(users);
    res.redirect('/dashboard');
});

// HWID Verify kore valid hole EXE URL-e redirect korbe
app.get('/exe', async (req, res) => {
    const hwid = (req.query.hwid || '').trim();
    const users = await getUsers();
    const found = users.find(u => u.hwid === hwid);

    if (!found || Date.now() > found.expiresAt) {
        return res.status(403).send('Unauthorized or Expired');
    }
    return res.redirect(302, EXE_DOWNLOAD_URL);
});

module.exports.handler = serverless(app);
