// File: api/mailer/send.js

import nodemailer from 'nodemailer';

/**
 * Vercel Serverless Function
 * POST /api/mailer/send
 * Body: { to, subject, text?, html?, from?, replyTo?, cc?, bcc?, headers? }
 */

export default async function handler(req, res) {
  // --- CORS (allow prod app, localhost, and vercel previews) ---
  const allowedExact = new Set([
    'https://imcs-20e60.web.app',     // your prod web app
    'http://localhost:3000',          // local dev
    'https://imcs-mailer.vercel.app', // your primary vercel domain (optional)
  ]);
  const allowedRegex = [
    /^https:\/\/imcs-mailer-.*\.vercel\.app$/, // preview deployments
  ];

  const origin = req.headers.origin;
  const isAllowed =
    origin && (allowedExact.has(origin) || allowedRegex.some((re) => re.test(origin)));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // If unknown origin, omit the header (blocked by browser), or lock to prod:
    // res.setHeader('Access-Control-Allow-Origin', 'https://imcs-20e60.web.app');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600'); // cache preflights

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  // --- Parse & validate payload ---
  // Vercel/Next automatically parses JSON when content-type is application/json.
  // If you ever switch runtimes, you may need to parse manually.
  const {
    to,
    subject,
    text,
    html,
    from,
    replyTo,
    cc,
    bcc,
    headers,
  } = req.body || {};

  if (!to || !subject || (!text && !html)) {
    res.status(400).json({
      ok: false,
      error: 'Missing required fields: "to", "subject", and at least one of "text" or "html".',
    });
    return;
  }

  // --- Build transporter from environment ---
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE = 'true',
    MAIL_FROM,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    res.status(500).json({
      ok: false,
      error:
        'SMTP is not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your environment.',
    });
    return;
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE).toLowerCase() === 'true', // true for 465, false for 587
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to init mail transport', detail: e?.message });
    return;
  }

  // Normalize arrays/strings for address fields
  const toList = Array.isArray(to) ? to : String(to).split(',').map((v) => v.trim()).filter(Boolean);
  const ccList = cc
    ? (Array.isArray(cc) ? cc : String(cc).split(',').map((v) => v.trim()).filter(Boolean))
    : undefined;
  const bccList = bcc
    ? (Array.isArray(bcc) ? bcc : String(bcc).split(',').map((v) => v.trim()).filter(Boolean))
    : undefined;

  const mailFrom = from || MAIL_FROM;
  if (!mailFrom) {
    res.status(400).json({
      ok: false,
      error:
        'Missing "from". Provide "from" in request or set MAIL_FROM in environment (e.g., "IMCS Mailer <no-reply@domain>").',
    });
    return;
  }

  const message = {
    from: mailFrom,
    to: toList,
    subject,
    text,
    html,
    replyTo,
    cc: ccList,
    bcc: bccList,
    headers: headers && typeof headers === 'object' ? headers : undefined,
  };

  try {
    const info = await transporter.sendMail(message);
    res.status(200).json({
      ok: true,
      id: info?.messageId,
      envelope: info?.envelope,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
    });
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: 'Failed to send email',
      detail: e?.message,
    });
  }
}
