import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { accounts } from '../lib/accounts';

function fmtMoney(n) { return '$' + (n / 1000).toFixed(0) + 'K'; }
function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const scanSteps = [
  "Scanning HubSpot account records",
  "Reading customer health signals",
  "Detecting retention risk",
  "Detecting expansion opportunity",
  "Prioritizing executive actions",
  "Generating weekly CEO brief"
];

const tourSteps = [
  { target: '#kpi-section', text: "This dashboard shows revenue risk and expansion opportunity across the Nsight Health portfolio, refreshed continuously, not just at renewal time." },
  { target: '#accounts-section', text: "These accounts are pulled from the CRM and scored automatically. No one has to remember to check on them." },
  { target: '#accounts-grid', text: "Accounts requiring executive attention surface to the top. Click any card to see exactly why the AI flagged it." },
  { target: '#btn-scan', text: "This button runs the weekly intelligence brief. It scans every account, scores risk and expansion, and writes the executive summary." },
  { target: '#btn-scan', text: "Once generated, the brief can be read aloud, useful between meetings, and sent straight to your inbox in one click, no compose window, no manual send." }
];

function StatusChip({ acc }) {
  const cls = acc.status === 'risk' ? 'status-risk' : acc.status === 'healthy' ? 'status-healthy' : 'status-watch';
  return <div className={`status-chip ${cls}`}><span className="dot"></span>{acc.statusLabel}</div>;
}

function sectionClassFor(header) {
  const h = header.toUpperCase();
  if (h.includes('TOP RISK')) return 'sec-risk';
  if (h.includes('EXECUTIVE ACTION') || h.includes('NEEDING ACTION')) return 'sec-gold';
  if (h.includes('PRIORIT') || h.includes('CSM ACTION')) return 'sec-blue';
  return '';
}

function formatBrief(text) {
  const sections = text.split(/\n(?=[A-Z][A-Z\s]{4,})/);
  return (
    <div className="brief-body">
      {sections.map((sec, i) => {
        const lines = sec.trim().split('\n').filter(l => l.trim());
        if (!lines.length) return null;
        const header = lines[0].replace(/:$/, '').trim();
        const bullets = lines.slice(1).map(l => l.replace(/^[-•]\s*/, '').trim()).filter(l => l);
        const secClass = sectionClassFor(header);
        return (
          <div key={i} className={secClass}>
            <h4 className={secClass}>{header}</h4>
            <ol>{bullets.map((b, j) => <li key={j}>{b}</li>)}</ol>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  // Scan + brief modal
  const [scanning, setScanning] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(-1);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);

  // Account modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [accAnalysis, setAccAnalysis] = useState('');
  const [accLoading, setAccLoading] = useState(false);

  // Email send modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // null | 'collecting' | 'pending' | 'success' | 'error'
  const [sendResult, setSendResult] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Tour
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);

  const sorted = [...accounts].sort((a, b) => {
    const order = { risk: 0, watch: 1, healthy: 2 };
    return order[a.status] - order[b.status] || b.riskScore - a.riskScore;
  });

  const [speaking, setSpeaking] = useState(false);

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Voice playback not supported in this browser');
      return;
    }
    if (!text || !text.trim()) {
      showToast('Nothing to read yet');
      return;
    }
    // Always fully cancel any prior queue before starting a new one,
    // this is what prevents overlapping/stuck speech.
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /en-US/i.test(v.lang) && /Google|Samantha|Daniel/i.test(v.name)) || voices.find(v => /en/i.test(v.lang));
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    // Small delay after cancel() avoids a known Chrome bug where speak()
    // called immediately after cancel() can silently no-op.
    setTimeout(() => window.speechSynthesis.speak(utter), 50);
    showToast('Playing audio briefing');
  }

  // Safety net: stop any speech if the user navigates away or closes modals
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  function runScan() {
    setScanning(true);
    setScanStepIndex(0);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < scanSteps.length) {
        setScanStepIndex(i);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setScanning(false);
          setBriefModalOpen(true);
        }, 400);
      }
    }, 650);
  }

  async function generateBrief() {
    setBriefLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'brief' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setBriefText(data.text);
    } catch (e) {
      showToast('Brief generation failed, retry in a moment');
    } finally {
      setBriefLoading(false);
    }
  }

  function openAccountModal(acc) {
    setCurrentAccount(acc);
    setAccAnalysis('');
    setAccountModalOpen(true);
  }

  async function whyFlagged() {
    if (!currentAccount) return;
    setAccLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'why-flagged', accountId: currentAccount.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setAccAnalysis(data.text);
    } catch (e) {
      setAccAnalysis('Analysis temporarily unavailable. Retry in a moment.');
    } finally {
      setAccLoading(false);
    }
  }

  function openSendModal() {
    if (!briefText) {
      showToast('Generate the CEO brief first');
      return;
    }
    setRecipientEmail('');
    setEmailError('');
    setSendModalOpen(true);
    setSendStatus('collecting');
    setSendResult(null);
  }

  function isValidEmail(addr) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim());
  }

  async function confirmSendToInbox() {
    if (!isValidEmail(recipientEmail)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError('');
    setSendStatus('pending');
    try {
      const res = await fetch('/api/send-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefText, recipientEmail: recipientEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setSendStatus('success');
      setSendResult(data);
    } catch (e) {
      setSendStatus('error');
      setSendResult({ error: e.message });
    }
  }

  // Tour positioning
  useEffect(() => {
    if (!tourActive) return;
    const step = tourSteps[tourIndex];
    const target = document.querySelector(step.target);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setSpotlightRect(rect);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [tourActive, tourIndex]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  function startTour() {
    setTourIndex(0);
    setTourActive(true);
  }
  function nextTourStep() {
    if (tourIndex >= tourSteps.length - 1) {
      setTourActive(false);
    } else {
      setTourIndex(tourIndex + 1);
    }
  }

  let tooltipStyle = {};
  if (spotlightRect) {
    let top = spotlightRect.bottom + window.scrollY + 16;
    let left = spotlightRect.left;
    if (left + 320 > window.innerWidth) left = window.innerWidth - 340;
    if (top + 160 > window.innerHeight + window.scrollY) top = spotlightRect.top + window.scrollY - 170;
    tooltipStyle = { top, left: Math.max(16, left) };
  }

  return (
    <>
      <Head>
        <title>NSIGHT Revenue Intelligence Center</title>
      </Head>

      <div className="app">
        <header className="top">
          <div>
            <div className="brand-eyebrow"><span className="pulse-dot"></span>NSIGHT HEALTH · LIVE SIGNAL FEED</div>
            <h1 className="title">NSIGHT Revenue Intelligence Center</h1>
            <p className="subtitle">AI-assisted revenue visibility for retention risk, expansion opportunity, and executive action.</p>
          </div>
          <div className="top-actions-wrap">
            <img src="/nsight-logo.svg" alt="NSIGHT Health" className="header-logo" />
            <div className="top-actions">
              <button className="btn btn-ghost" id="btn-tour" onClick={startTour}>Start Guided Walkthrough</button>
              <button className="btn btn-primary" id="btn-scan" onClick={runScan}>Run Weekly Revenue Intelligence Brief</button>
            </div>
          </div>
        </header>

        <div className="section-label" id="kpi-section">REVENUE SIGNAL DASHBOARD</div>
        <div className="kpi-grid">
          <div className="kpi"><div className="label">Revenue at Risk</div><div className="value risk">$418K</div><div className="delta">across 2 accounts</div></div>
          <div className="kpi"><div className="label">Expansion Opportunity</div><div className="value healthy">$265K</div><div className="delta">across 2 accounts</div></div>
          <div className="kpi"><div className="label">Accounts Requiring Action</div><div className="value amber">3</div><div className="delta">this week</div></div>
          <div className="kpi"><div className="label">Executive Escalations</div><div className="value risk">2</div><div className="delta">open, unresolved</div></div>
          <div className="kpi"><div className="label">Projected NRR Impact</div><div className="value amber">−3.1%</div><div className="delta">if no action taken</div></div>
        </div>

        <div className="section-label" id="accounts-section">ACCOUNTS REQUIRING EXECUTIVE ATTENTION</div>
        <div className="accounts-grid" id="accounts-grid">
          {sorted.map(acc => (
            <div className="account-card" key={acc.id} onClick={() => openAccountModal(acc)}>
              <div className="account-top">
                <div>
                  <div className="account-name">{acc.name}</div>
                  <div className="account-meta">{fmtMoney(acc.arr)} ARR · {acc.products.join(' / ')} · Renews {fmtDate(acc.renewalDate)}</div>
                </div>
                <StatusChip acc={acc} />
              </div>
              <div className="score-row">
                <div className="score">
                  <div className="score-label mono">RETENTION RISK · {acc.riskScore}</div>
                  <div className="score-bar"><div className="score-bar-fill" style={{ width: `${acc.riskScore}%`, background: 'var(--risk)' }}></div></div>
                </div>
                <div className="score">
                  <div className="score-label mono">EXPANSION SCORE · {acc.expansionScore}</div>
                  <div className="score-bar"><div className="score-bar-fill" style={{ width: `${acc.expansionScore}%`, background: 'var(--healthy)' }}></div></div>
                </div>
              </div>
              <div className="account-foot">
                <strong>CSM:</strong> {acc.csmOwner} &nbsp;·&nbsp; <strong>Exec Sponsor:</strong> {acc.execSponsorEngaged ? 'Engaged' : 'Disengaged'}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-note">NSIGHT REVENUE INTELLIGENCE CENTER · PROTOTYPE ENVIRONMENT · ALL ACCOUNT DATA IS ILLUSTRATIVE, NO PHI</div>
        <div className="footer-credit">Built by: Richard Marra</div>
      </div>

      {/* Scan overlay */}
      <div className={`scan-overlay ${scanning ? 'active' : ''}`}>
        <div className="scan-box">
          <div className="scan-title">Generating Weekly Revenue Intelligence Brief</div>
          {scanSteps.map((s, i) => (
            <div key={i} className={`scan-step ${i === scanStepIndex ? 'active' : i < scanStepIndex ? 'done' : ''}`}>
              <span className="icon">{i < scanStepIndex ? <span className="check">✓</span> : i === scanStepIndex ? <span className="spinner"></span> : null}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Account modal */}
      <div className={`modal-overlay ${accountModalOpen ? 'active' : ''}`}>
        <div className="modal">
          <button className="modal-close" onClick={() => { setAccountModalOpen(false); stopSpeaking(); }}>&times;</button>
          {currentAccount && (
            <>
              <h2>{currentAccount.name}</h2>
              <div className="modal-sub">{currentAccount.csmOwner} · {currentAccount.products.join(', ')} · Renewal {fmtDate(currentAccount.renewalDate)}</div>
              <div className="detail-grid">
                <div className="detail-cell"><div className="dl">ARR</div><div className="dv">{fmtMoney(currentAccount.arr)}</div></div>
                <div className="detail-cell"><div className="dl">Enrollment Trend</div><div className="dv" style={{ color: currentAccount.enrollmentTrend < 0 ? 'var(--risk)' : 'var(--healthy)' }}>{currentAccount.enrollmentTrend > 0 ? '+' : ''}{currentAccount.enrollmentTrend}%</div></div>
                <div className="detail-cell"><div className="dl">Provider Engagement</div><div className="dv" style={{ color: currentAccount.providerEngagement < 0 ? 'var(--risk)' : 'var(--healthy)' }}>{currentAccount.providerEngagement > 0 ? '+' : ''}{currentAccount.providerEngagement}%</div></div>
                <div className="detail-cell"><div className="dl">Open Escalations</div><div className="dv">{currentAccount.escalations}</div></div>
                <div className="detail-cell"><div className="dl">Escalation Trend (60d)</div><div className="dv" style={{ color: currentAccount.escalationTrend > 0 ? 'var(--risk)' : 'var(--healthy)' }}>{currentAccount.escalationTrend > 0 ? '+' : ''}{currentAccount.escalationTrend}%</div></div>
                <div className="detail-cell"><div className="dl">Exec Sponsor</div><div className="dv">{currentAccount.execSponsorEngaged ? 'Engaged' : 'Disengaged'}</div></div>
              </div>
              <div className="ai-block">
                <div className="ai-label">⚡ AI Risk &amp; Opportunity Explanation</div>
                {accLoading ? (
                  <div className="loading-text"><span className="spinner"></span> Analyzing account signals...</div>
                ) : accAnalysis ? (
                  <p>{accAnalysis}</p>
                ) : (
                  <div className="loading-text">Click below to generate analysis</div>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={whyFlagged}>Why did AI flag this account?</button>
                <button className="btn btn-warm" onClick={() => speak(`${currentAccount.name}. ${currentAccount.statusLabel}. Annual recurring revenue, ${Math.round(currentAccount.arr / 1000)} thousand dollars. Retention risk score, ${currentAccount.riskScore} out of 100. ${accAnalysis}`)}>🔊 Listen</button>
                {speaking && <button className="btn btn-ghost" onClick={stopSpeaking}>⏹ Stop</button>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Brief modal */}
      <div className={`modal-overlay ${briefModalOpen ? 'active' : ''}`}>
        <div className="modal">
          <button className="modal-close" onClick={() => { setBriefModalOpen(false); stopSpeaking(); }}>&times;</button>
          <h2>Weekly CEO Brief</h2>
          <div className="modal-sub">Week of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div className="ai-block">
            <div className="ai-label">⚡ Generated by Claude</div>
            {briefLoading ? (
              <div className="loading-text"><span className="spinner"></span> Synthesizing portfolio signals into executive brief...</div>
            ) : briefText ? (
              formatBrief(briefText)
            ) : (
              <div className="loading-text">Click &quot;Generate CEO Brief&quot; to begin</div>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={generateBrief}>Generate CEO Brief</button>
            <button className="btn btn-warm" onClick={() => briefText ? speak(briefText.replace(/[-•]/g, '')) : showToast('Generate the CEO brief first')}>🔊 Listen to Executive Brief</button>
            {speaking && <button className="btn btn-ghost" onClick={stopSpeaking}>⏹ Stop</button>}
            <button className="btn btn-teal" onClick={openSendModal}>Send Brief to Inbox</button>
          </div>
        </div>
      </div>

      {/* Send status modal */}
      <div className={`modal-overlay ${sendModalOpen ? 'active' : ''}`}>
        <div className="modal">
          <button className="modal-close" onClick={() => setSendModalOpen(false)}>&times;</button>
          <h2>Sending Executive Brief</h2>
          <div className="modal-sub">Real Gmail send, no compose window, no manual approval step</div>

          {sendStatus === 'collecting' && (
            <div className="email-collect">
              <label htmlFor="recipient-email-input" className="email-collect-label">Send this brief to</label>
              <input
                id="recipient-email-input"
                type="email"
                className="email-collect-input"
                placeholder="you@company.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmSendToInbox(); }}
                autoFocus
              />
              {emailError && <div className="email-collect-error">{emailError}</div>}
              <div className="modal-actions">
                <button className="btn btn-teal" onClick={confirmSendToInbox}>Send Brief</button>
              </div>
            </div>
          )}
          {sendStatus === 'pending' && (
            <div className="send-status pending"><span className="spinner"></span> Sending email via Gmail API...</div>
          )}
          {sendStatus === 'success' && sendResult && (
            <>
              <div className="send-status success">✓ Email sent successfully</div>
              <div className="email-preview">
                <div className="email-field"><span className="ef-label">TO</span><span>{sendResult.sentTo}</span></div>
                <div className="email-field"><span className="ef-label">FROM</span><span>{sendResult.sentFrom}</span></div>
                <div className="email-field"><span className="ef-label">SUBJ</span><span>{sendResult.subject}</span></div>
                <div className="email-body-text">{sendResult.body}</div>
              </div>
            </>
          )}
          {sendStatus === 'error' && sendResult && (
            <div className="send-status error">Send failed: {sendResult.error}</div>
          )}
        </div>
      </div>

      {/* Tour */}
      <div className={`tour-overlay ${tourActive ? 'active' : ''}`}>
        {spotlightRect && (
          <>
            <div className="tour-spotlight" style={{
              top: spotlightRect.top - 8 + window.scrollY,
              left: spotlightRect.left - 8,
              width: spotlightRect.width + 16,
              height: spotlightRect.height + 16
            }}></div>
            <div className="tour-tooltip" style={tooltipStyle}>
              <div className="tour-step-label">STEP {tourIndex + 1} OF {tourSteps.length}</div>
              <p>{tourSteps[tourIndex].text}</p>
              <div className="tour-controls">
                <button className="tour-skip" onClick={() => setTourActive(false)}>Skip tour</button>
                <button className="btn btn-primary" onClick={nextTourStep}>{tourIndex === tourSteps.length - 1 ? 'Finish' : 'Next'}</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  );
}
