// Mock account data structured to mirror HubSpot's CRM object model
// (companies + deals + custom properties). No real PHI, no real patient data.

export const accounts = [
  {
    id: "dallas-cardiology",
    name: "Dallas Cardiology Group",
    arr: 142000,
    renewalDate: "2026-08-14",
    products: ["RPM", "CCM"],
    csmOwner: "J. Alvarez",
    enrollmentTrend: -22,
    providerEngagement: -18,
    escalations: 4,
    escalationTrend: 31,
    execSponsorEngaged: false,
    expansionReadiness: "low",
    riskScore: 87,
    expansionScore: 12,
    status: "risk",
    statusLabel: "Critical Risk"
  },
  {
    id: "houston-heart",
    name: "Houston Heart Institute",
    arr: 198000,
    renewalDate: "2026-07-30",
    products: ["RPM", "CCM", "PCM"],
    csmOwner: "T. Nguyen",
    enrollmentTrend: -14,
    providerEngagement: -9,
    escalations: 3,
    escalationTrend: 20,
    execSponsorEngaged: false,
    expansionReadiness: "low",
    riskScore: 74,
    expansionScore: 18,
    status: "risk",
    statusLabel: "At Risk"
  },
  {
    id: "austin-primary",
    name: "Austin Primary Care",
    arr: 96000,
    renewalDate: "2026-11-02",
    products: ["CCM", "BHI"],
    csmOwner: "J. Alvarez",
    enrollmentTrend: 4,
    providerEngagement: 6,
    escalations: 1,
    escalationTrend: -10,
    execSponsorEngaged: true,
    expansionReadiness: "moderate",
    riskScore: 28,
    expansionScore: 54,
    status: "watch",
    statusLabel: "Stable / Watch"
  },
  {
    id: "sa-family",
    name: "San Antonio Family Medicine",
    arr: 121000,
    renewalDate: "2027-01-19",
    products: ["RPM", "CCM", "BHI"],
    csmOwner: "M. Okafor",
    enrollmentTrend: 19,
    providerEngagement: 24,
    escalations: 0,
    escalationTrend: -100,
    execSponsorEngaged: true,
    expansionReadiness: "high",
    riskScore: 9,
    expansionScore: 81,
    status: "healthy",
    statusLabel: "Expansion Ready"
  },
  {
    id: "ft-worth-vascular",
    name: "Fort Worth Heart & Vascular",
    arr: 167000,
    renewalDate: "2026-09-22",
    products: ["RPM", "PCM"],
    csmOwner: "T. Nguyen",
    enrollmentTrend: 11,
    providerEngagement: 15,
    escalations: 1,
    escalationTrend: 0,
    execSponsorEngaged: true,
    expansionReadiness: "high",
    riskScore: 17,
    expansionScore: 76,
    status: "healthy",
    statusLabel: "Expansion Ready"
  },
  {
    id: "denton-internal",
    name: "Denton Internal Medicine",
    arr: 78000,
    renewalDate: "2026-08-05",
    products: ["CCM"],
    csmOwner: "M. Okafor",
    enrollmentTrend: -6,
    providerEngagement: -3,
    escalations: 2,
    escalationTrend: 15,
    execSponsorEngaged: true,
    expansionReadiness: "low",
    riskScore: 51,
    expansionScore: 22,
    status: "watch",
    statusLabel: "Stable / Watch"
  }
];

export function accountSummaryText() {
  return accounts.map(a =>
    `${a.name}: ${a.statusLabel}, ARR $${a.arr}, risk ${a.riskScore}/100, expansion ${a.expansionScore}/100, enrollment trend ${a.enrollmentTrend}%, escalations ${a.escalations} (trend ${a.escalationTrend}%), exec sponsor ${a.execSponsorEngaged ? 'engaged' : 'disengaged'}, CSM ${a.csmOwner}`
  ).join('\n');
}
