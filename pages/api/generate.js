import { accountSummaryText, accounts } from '../../lib/accounts';

async function callClaude(prompt, maxTokens = 900) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, accountId } = req.body;

  try {
    if (type === 'brief') {
      const prompt = `You are a revenue intelligence AI generating a weekly executive brief for the CEO of Nsight Health, an RPM/CCM remote patient monitoring company. Based on the account data below, write a CEO brief with exactly these five sections, using plain text headers in this exact format: "TOP RISKS", "TOP EXPANSION OPPORTUNITIES", "ACCOUNTS NEEDING EXECUTIVE ACTION", "RECOMMENDED WEEKLY PRIORITIES", "SUGGESTED CSM ACTIONS". Under each header, write 2-3 short bullet points starting with a dash. Be specific, cite real numbers from the data, and write in a direct executive register with no filler or hedging. Do not use markdown bold or asterisks.

Account data:
${accountSummaryText()}`;

      const result = await callClaude(prompt, 900);
      return res.status(200).json({ text: result });
    }

    if (type === 'why-flagged') {
      const acc = accounts.find(a => a.id === accountId);
      if (!acc) return res.status(404).json({ error: 'Account not found' });

      const prompt = `You are a revenue intelligence AI embedded in a Customer Success platform for a remote patient monitoring (RPM/CCM) healthcare company called Nsight Health. Analyze this account and explain in 2-3 tight sentences, written for a CEO audience, why it was flagged. Be specific and cite the actual numbers. Do not use markdown formatting, just plain prose. If the account is healthy/expansion-ready instead of at-risk, explain why it was flagged as an expansion opportunity instead.

Account: ${acc.name}
ARR: $${acc.arr}
Status: ${acc.statusLabel}
Retention Risk Score: ${acc.riskScore}/100
Expansion Score: ${acc.expansionScore}/100
Enrollment trend (60 days): ${acc.enrollmentTrend}%
Provider engagement trend (60 days): ${acc.providerEngagement}%
Open escalations: ${acc.escalations}
Escalation trend (60 days): ${acc.escalationTrend}%
Executive sponsor engaged: ${acc.execSponsorEngaged}
Expansion readiness: ${acc.expansionReadiness}
Products: ${acc.products.join(', ')}
CSM owner: ${acc.csmOwner}`;

      const result = await callClaude(prompt, 300);
      return res.status(200).json({ text: result });
    }

    return res.status(400).json({ error: 'Unknown request type' });
  } catch (err) {
    console.error('Claude generation error:', err);
    return res.status(500).json({ error: 'Generation failed', detail: err.message });
  }
}
