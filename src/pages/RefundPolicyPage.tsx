import React from 'react';

export function RefundPolicyPage() {
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Legal</p>
          <h1 className="page-title">Refund Policy</h1>
          <p className="page-subtitle">Last updated: November 24, 2026</p>
        </div>
      </div>
      <section className="card" style={{ padding: 24, lineHeight: 1.7 }}>
        <h2 style={{ marginTop: 0 }}>Eligibility</h2>
        <p>Ledgerly offers a 14-day refund window for initial new subscription payments. If you are not satisfied, request a refund within 14 days of your first paid charge and we will refund the amount to your original payment method.</p>
        <h2>Exclusions</h2>
        <ul>
          <li>Renewal charges after the initial 14-day window are not refundable.</li>
          <li>Partial months, unused time, and already-consumed billing cycles are not prorated or refunded.</li>
          <li>One-time, founding, promotional, or discounted offers may have separate terms stated at purchase.</li>
          <li>Chargebacks or payment disputes are handled under the payment provider's process.</li>
        </ul>
        <h2>How to request a refund</h2>
        <p>Email support@ledgerly.app with your account email, workspace name, and the charge date. We typically respond within 2 business days and process approved refunds within 5-10 business days back to the original payment method.</p>
        <h2>Contact</h2>
        <p>For billing questions, contact support@ledgerly.app.</p>
      </section>
    </main>
  );
}

export default RefundPolicyPage;