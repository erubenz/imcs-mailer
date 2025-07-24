const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', 'https://imcs-20e60.web.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // --- Handle OPTIONS (preflight) ---
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Handle body parsing (Vercel/Node compatibility)
  let body = req.body;
  if (!body) {
    let data = '';
    await new Promise(resolve => {
      req.on('data', chunk => { data += chunk; });
      req.on('end', resolve);
    });
    body = JSON.parse(data);
  }

  const { to, subject, text } = body;
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    secure: process.env.SMTP_SECURE === 'true'
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
