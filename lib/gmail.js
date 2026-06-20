import { google } from 'googleapis';

// Builds an authenticated Gmail client using the refresh token minted
// once during local setup. No user-facing login ever happens again,
// this runs entirely server-side using credentials stored as env vars.
function getGmailClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
  return google.gmail({ version: 'v1', auth: oAuth2Client });
}

// Encodes a plain-text email into the base64url format Gmail's API requires.
// Subject is MIME-encoded as UTF-8 explicitly, since unencoded subject lines
// containing special characters (em dashes, smart quotes) get corrupted
// by mail clients that assume a different default character set.
function encodeSubject(subject) {
  const utf8Bytes = Buffer.from(subject, 'utf-8').toString('base64');
  return `=?UTF-8?B?${utf8Bytes}?=`;
}

function buildRawMessage({ to, from, subject, htmlBody }) {
  const messageParts = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64')
  ];
  const message = messageParts.join('\n');
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendBriefEmail({ subject, htmlBody, recipientEmail }) {
  const gmail = getGmailClient();
  const fromAddress = process.env.SENDER_EMAIL;
  const toAddress = recipientEmail || process.env.RECIPIENT_EMAIL;

  const raw = buildRawMessage({
    to: toAddress,
    from: fromAddress,
    subject,
    htmlBody
  });

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw }
  });

  return { messageId: result.data.id, from: fromAddress, to: toAddress };
}