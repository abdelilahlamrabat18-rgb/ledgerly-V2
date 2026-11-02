import React from 'react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ledgerly Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Effective date: November 1, 2026 | Last updated: November 1, 2026
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly provides a business management platform that helps individuals and businesses organize and understand business information, including data maintained in Google Sheets. This Privacy Policy explains what information Ledgerly collects, how Ledgerly protects it, and the choices available to users of the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. Information Collected</h2>
          <p className="text-slate-300 leading-relaxed">
            Account information includes user names, email addresses, authentication identifiers, and account maintenance data. When a user connects Google Sheets, Ledgerly accesses the Google account email address, selected spreadsheet identifiers, sheet data required to display business metrics, and authorization credentials.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. Use of Information</h2>
          <p className="text-slate-300 leading-relaxed">
            Information is used exclusively to create and maintain accounts, authenticate users, connect to requested Google Sheets, display business analytics, maintain service operations, and prevent unauthorized access. Ledgerly does not use Google user data for advertising, nor does Ledgerly sell Google user data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Google API Services and Google User Data</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly&apos;s use and transfer of information received from Google APIs complies with the Google API Services User Data Policy, including Limited Use requirements. Google user data is not sold, used for advertising, or utilized to train generalized artificial intelligence or machine learning models.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">5. Storage and Security</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly employs technical and organizational safeguards designed to protect platform information. Authorization credentials required for Google Sheets connections are stored in encrypted form.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">6. Data Sharing and Third-Party Services</h2>
          <p className="text-slate-300 leading-relaxed">
            Personal information and Google user data are never sold. Infrastructure providers are utilized strictly to operate the platform subject to appropriate confidentiality and security obligations.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">7. Data Retention and Deletion</h2>
          <p className="text-slate-300 leading-relaxed">
            Information is retained only as long as reasonably necessary to deliver platform services. Users may request account and data deletion by contacting the Ledgerly Team at abdelilahlamrabat18@gmail.com.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">8. Disconnecting Google Sheets</h2>
          <p className="text-slate-300 leading-relaxed">
            Users may revoke Ledgerly&apos;s access to Google Account data at any time via Google Account security settings.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">9. User Choices and Rights</h2>
          <p className="text-slate-300 leading-relaxed">
            Subject to local laws, users hold the right to request access, correction, or deletion of personal information associated with their Ledgerly account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">10. Children&apos;s Privacy</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly is a business productivity service and is not intended for individuals under the age of 13.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">11. International Data Processing</h2>
          <p className="text-slate-300 leading-relaxed">
            Platform information may be processed or stored across international infrastructure locations depending on hosting providers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">12. Changes to This Privacy Policy</h2>
          <p className="text-slate-300 leading-relaxed">
            Material updates to this policy will adjust the &quot;Last updated&quot; date and provide additional notice where required.
          </p>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-xl font-semibold text-white">13. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Service: Ledgerly<br />
            Website: https://www.ledgerlyhq.app<br />
            Privacy Contact: The Ledgerly Team (abdelilahlamrabat18@gmail.com)
          </p>
        </section>
      </div>
    </div>
  );
}
export default PrivacyPage;
