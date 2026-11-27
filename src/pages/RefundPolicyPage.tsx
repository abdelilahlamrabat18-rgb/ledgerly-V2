import React from 'react';
import { Link } from 'react-router-dom';
import { usePreferences } from '../context/PreferencesContext';
import { BrandLogo } from '../components/BrandLogo';

export function RefundPolicyPage() {
  const { language } = usePreferences();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-2.5 mb-4">
          <BrandLogo size={24} />
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ledgerly Refund Policy
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Effective date: November 24, 2026 | Last updated: November 24, 2026
        </p>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Overview</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly offers transparent, simple pricing with a 14-day refund window for initial subscription payments.
            We want you to be confident in your purchase. If you are not satisfied, you can request a refund within
            14 days of your first paid charge.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. Pricing Plans</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly offers the following subscription plans. All prices are in USD and exclude applicable taxes.
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 leading-relaxed pl-4">
            <li><strong>Monthly:</strong> $24 per month — billed monthly, cancel anytime.</li>
            <li><strong>Yearly:</strong> $240 per year ($20/month equivalent) — billed annually, 17% savings vs. monthly.</li>
            <li><strong>Founding:</strong> $149 one-time — lifetime access, no recurring charges. Limited availability.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. 14-Day Refund Window</h2>
          <p className="text-slate-300 leading-relaxed">
            The 14-day refund window applies to the <strong>first paid charge</strong> on a new subscription (Monthly or Yearly).
            If you request a refund within 14 calendar days of that charge, we will refund the full amount to your original
            payment method.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Founding Plan Refunds</h2>
          <p className="text-slate-300 leading-relaxed">
            The Founding plan is a one-time purchase with lifetime access. Because it grants permanent access without
            recurring billing, the standard 14-day refund window applies from the date of purchase. Requests made within
            14 days will be honored; after 14 days, Founding plan purchases are non-refundable.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">5. Exclusions</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-300 leading-relaxed pl-4">
            <li>Renewal charges (Monthly or Yearly) after the initial 14-day window are not refundable.</li>
            <li>Partial months, unused time, and already-consumed billing cycles are not prorated or refunded.</li>
            <li>Chargebacks or payment disputes initiated with your bank/card issuer are handled under the payment provider's
              process and may delay resolution.</li>
            <li>Promotional or discounted offers may have separate terms stated at purchase.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">6. Data Export Rights</h2>
          <p className="text-slate-300 leading-relaxed">
            You own your data. At any time — during an active subscription, after cancellation, or after a refund — you can
            export all your Ledgerly data (Clients, Invoices, Expenses, Orders) as CSV from the app. No subscription is
            required to access the export feature. Your data remains accessible in the platform for 30 days after
            cancellation or refund, after which it may be purged in accordance with our data retention policy.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">7. How to Request a Refund</h2>
          <p className="text-slate-300 leading-relaxed">
            To request a refund, email <strong>support@ledgerly.app</strong> with the following information:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-300 leading-relaxed pl-4">
            <li>Your account email address</li>
            <li>Your workspace name</li>
            <li>The date of the charge you want refunded</li>
            <li>(Optional) Brief reason for the refund request</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            We typically respond within 2 business days. Approved refunds are processed within 5–10 business days back to
            the original payment method. Refund timing may vary by payment provider.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">8. Cancellation vs. Refund</h2>
          <p className="text-slate-300 leading-relaxed">
            Cancelling a subscription stops future charges but does not automatically trigger a refund for the current
            billing period. If you are within the 14-day window for your first charge, you must explicitly request a refund
            as described above. You can cancel at any time from the Billing page in the app.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">9. Payment Provider</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly uses Stripe for payment processing. All refunds are issued through Stripe to the original payment
            method. Ledgerly does not store full card details. For questions about a specific refund status, you can also
            contact Stripe support with the charge ID provided in your receipt.
          </p>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-xl font-semibold text-white">10. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Service: Ledgerly<br />
            Website: https://www.ledgerlyhq.app<br />
            Refunds & Billing Support: The Ledgerly Team (support@ledgerly.app)
          </p>
        </section>
        
        <div className="border-t border-slate-800 pt-6">
          <Link to="/" className="text-slate-400 hover:text-white text-sm flex items-center gap-1">
            <BrandLogo size={14} />
            <span>Back to Ledgerly</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RefundPolicyPage;