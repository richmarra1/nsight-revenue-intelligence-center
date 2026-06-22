import { sendBriefEmail } from '../../lib/gmail';

async function callClaude(prompt, maxTokens = 700) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const textBlock = data.content.find(b => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function numberedListToHtml(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^\d+\.\s*/, ''));
  const items = lines.map(l => `<li style="margin-bottom:8px;">${escapeHtml(l)}</li>`).join('');
  return `<ol style="margin:0;padding-left:20px;">${items}</ol>`;
}

function buildHtmlEmail({ headline, atRisk, expansion, nextSteps }) {
  const phoneDisplay = '(972) 214-8671';
  const phoneHref = 'tel:+19722148671';

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;">
  <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:16px;">
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td style="background-color:#1a1a2e;border-radius:6px;width:28px;height:28px;text-align:center;vertical-align:middle;color:#4FD1C5;font-size:14px;font-weight:700;">N</td>
        <td style="padding-left:8px;font-size:16px;font-weight:700;letter-spacing:0.5px;color:#1a1a2e;">REVENUE <span style="color:#4FD1C5;">INTEL</span></td>
      </tr>
    </table>
  </div>

  <p style="font-size:15px;line-height:1.5;margin:0 0 20px 0;">${escapeHtml(headline)}</p>

  <h3 style="color:#c0392b;font-size:15px;margin:0 0 8px 0;">At-Risk Accounts</h3>
  <div style="font-size:14px;line-height:1.5;color:#1a1a2e;margin-bottom:20px;">${numberedListToHtml(atRisk)}</div>

  <h3 style="color:#27ae60;font-size:15px;margin:0 0 8px 0;">Expansion Opportunities</h3>
  <div style="font-size:14px;line-height:1.5;color:#1a1a2e;margin-bottom:20px;">${numberedListToHtml(expansion)}</div>
<h3 style="color:#1F5FA8;font-size:15px;margin:0 0 8px 0;">Recommended Next Steps</h3>
  <div style="font-size:14px;line-height:1.5;color:#1a1a2e;margin-bottom:20px;">${numberedListToHtml(nextSteps)}</div>

  <p style="font-size:19px;font-weight:700;color:#1a1a2e;margin-top:24px;margin-bottom:4px;">Revenue Intelligence Center – AI Executive Briefing Prototype</p>
  <p style="font-size:13px;color:#888;margin:0 0 4px 0;">For questions, contact Richard Marra at <a href="${phoneHref}" style="color:#1F5FA8;text-decoration:none;">${phoneDisplay}</a></p>
  <p style="font-size:12px;color:#aaa;margin:0;">Built by: Richard Marra</p>
</div>`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { briefText, recipientEmail } = req.body;
  if (!briefText) {
    return res.status(400).json({ error: 'Missing briefText in request body' });
  }

  try {
    const emailPrompt = `Convert the following executive brief into email content. Write a short, punchy subject line (under 9 words, no quotes around it) and a one-sentence headline stating the single most important number. Then produce three separate numbered lists (plain numbers like "1. " at the start of each line, no markdown, no asterisks, no em dashes): at-risk accounts, expansion opportunities, and recommended next steps. Each line should be one tight sentence with the dollar figure and core driver where relevant.

Format your response EXACTLY like this, with these literal labels on their own lines:
SUBJECT: <subject line>
HEADLINE: <one sentence>
AT_RISK:
<numbered list>
EXPANSION:
<numbered list>
NEXT_STEPS:
<numbered list>

Brief content:
${briefText}`;

    const generated = await callClaude(emailPrompt, 700);

    const subject = (generated.match(/SUBJECT:\s*(.+)/) || [])[1]?.trim() || 'Weekly Revenue Intelligence Brief';
    const headline = (generated.match(/HEADLINE:\s*(.+)/) || [])[1]?.trim() || '';
    const atRisk = (generated.match(/AT_RISK:\s*([\s\S]*?)EXPANSION:/) || [])[1]?.trim() || '';
    const expansion = (generated.match(/EXPANSION:\s*([\s\S]*?)NEXT_STEPS:/) || [])[1]?.trim() || '';
    const nextSteps = (generated.match(/NEXT_STEPS:\s*([\s\S]*)/) || [])[1]?.trim() || '';

    const htmlBody = buildHtmlEmail({ headline, atRisk, expansion, nextSteps });

    const sendResult = await sendBriefEmail({
      subject,
      htmlBody,
      recipientEmail: recipientEmail || undefined
    });

    return res.status(200).json({
      success: true,
      subject,
      sentTo: sendResult.to,
      sentFrom: sendResult.from,
      messageId: sendResult.messageId
    });
  } catch (err) {
    console.error('Send brief error:', err);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
}