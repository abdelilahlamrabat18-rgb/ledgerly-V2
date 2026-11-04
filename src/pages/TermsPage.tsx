import React from 'react';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ledgerly Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Effective date: November 4, 2026 | Last updated: November 4, 2026
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p className="text-slate-300 leading-relaxed">
            These Terms of Service govern your access to and use of the Ledgerly platform, including its websites, applications, and APIs. By creating an account, signing in, or using any Ledgerly feature, you agree to be bound by these Terms. If you do not agree, do not use the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">2. Description of the Service</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly is a business management platform that helps individuals and businesses organize and understand business information, including data maintained in Google Sheets. Ledgerly displays, imports, and summarizes data you provide or authorize it to access. It does not verify the accuracy of your source data, and it is not a financial, accounting, tax, or legal advisory service. You are responsible for the decisions you make based on information the platform displays.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">3. Eligibility</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly is a business productivity service and is not intended for individuals under the age of 13. By using the platform, you represent that you are at least 13 years old and are legally capable of entering into these Terms. If you use the platform on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">4. Accounts and Sign-In</h2>
          <p className="text-slate-300 leading-relaxed">
            To use Ledgerly you must create an account through the supported sign-in flow. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify Ledgerly immediately if you suspect your account has been compromised. Ledgerly uses third-party authentication infrastructure to manage sign-in and session security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">5. Google Integration and Permissions</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly can connect to your Google Account to access Google Sheets. When you authorize this integration, you grant Ledgerly read-only access to the Google account email address, selected spreadsheets, and the sheet data required to display business metrics. The requested permissions include profile and email information, plus read-only access to Google Drive and Google Sheets. Ledgerly requests offline access so it can refresh authorization as needed, and it prompts for consent each time you authorize the integration.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">6. Data Ownership and Processing</h2>
          <p className="text-slate-300 leading-relaxed">
            You retain ownership of the data you import into Ledgerly and of the data you authorize it to access from Google. Ledgerly processes your data only to the extent necessary to provide, operate, and improve the platform. Ledgerly does not sell your data or your Google user data, does not use it for advertising, and does not use it to train generalized artificial intelligence or machine learning models. Ledgerly does not claim ownership of your spreadsheets or business records.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">7. Billing, Trials, and Subscriptions</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly offers a time-limited trial of core features. The trial length is set by the platform and starts when you initiate it through the Billing page. Access to core features is governed by a server-authoritative entitlement state that reflects your trial status and any subscription record associated with your account. Paid subscription features depend on a payment provider integration. Payment processing, automatic billing, refunds, and cancellation handling are managed by that provider, and their availability may vary. Ledgerly does not guarantee that any paid plan, checkout flow, or billing webhook is operational at any given time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">8. Acceptable Use</h2>
          <p className="text-slate-300 leading-relaxed">
            You agree to use the platform lawfully and in a way that does not harm it or other users. You must not attempt to circumvent access controls, interfere with the service, upload malicious content, or use the platform to infringe third-party rights. Ledgerly reserves the right to investigate and address misuse, consistent with applicable law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">9. Availability and Synchronization</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly is provided on an as-is basis. The platform and its integrations, including Google Sheets synchronization, may experience interruptions, delays, or failures due to network conditions, third-party service outages, maintenance, or other causes. Ledgerly does not promise uninterrupted access, error-free operation, or that all data will always synchronize correctly. Data displayed by the platform reflects the state of your connected sources at the time of the last successful sync and may not be current.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">10. Third-Party Services and Integrations</h2>
          <p className="text-slate-300 leading-relaxed">
            The platform relies on third-party infrastructure and services, including authentication and cloud hosting providers. Ledgerly also integrates with Google APIs. Your use of third-party services is subject to their own terms and privacy policies. Ledgerly is not responsible for the availability, accuracy, or conduct of third-party services, and any disputes with third parties are between you and them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">11. Intellectual Property</h2>
          <p className="text-slate-300 leading-relaxed">
            The Ledgerly platform, including its design, branding, software, and documentation, is owned by Ledgerly and protected by intellectual property laws. Nothing in these Terms grants you any license to use Ledgerly branding, software, or documentation except as needed to operate the platform for your own business purposes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">12. Disclaimers</h2>
          <p className="text-slate-300 leading-relaxed">
            The platform is provided without warranties of any kind, whether express or implied, including merchantability, fitness for a particular purpose, and non-infringement. Ledgerly does not warrant that the platform will meet your needs, be uninterrupted, be secure, or be free of errors. Your use of the platform is at your own risk.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">13. Limitation of Liability</h2>
          <p className="text-slate-300 leading-relaxed">
            To the fullest extent permitted by law, Ledgerly and its contributors are not liable for any indirect, incidental, consequential, or punitive damages arising out of or in connection with these Terms or your use of the platform. In no event shall Ledgerly's total liability exceed the amounts you paid to Ledgerly in the twelve months preceding the claim, if any.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">14. Termination</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly may suspend or terminate your account and access to the platform for conduct that violates these Terms, for misuse, or as required by law. Upon termination, your right to use the platform ceases immediately. Provisions that by their nature survive termination, including data ownership, disclaimers, liability limits, and governing law, will remain in effect.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">15. Account Deletion and Data Removal</h2>
          <p className="text-slate-300 leading-relaxed">
            You may revoke Ledgerly's access to your Google Account at any time through your Google security settings. You may request deletion of your account and associated data by contacting the Ledgerly Team. Account and data deletion is handled manually upon request, and the timing and scope of deletion may depend on operational and legal requirements. Ledgerly does not provide an automated, self-serve account deletion flow within the platform.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">16. Changes to These Terms</h2>
          <p className="text-slate-300 leading-relaxed">
            Ledgerly may update these Terms from time to time. Material changes will be reflected in the "Last updated" date and will be communicated through the platform or by other reasonable means. Continued use of the platform after changes take effect constitutes acceptance of the updated Terms. You should review these Terms periodically.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">17. Governing Law</h2>
          <p className="text-slate-300 leading-relaxed">
            These Terms are governed by the laws applicable to the service provider, without regard to conflict-of-law rules. To the extent a court has jurisdiction, you and Ledgerly agree to submit to the exclusive jurisdiction of the courts located in the provider's principal place of business. No registered business address, legal entity name, or governing jurisdiction has been finalized for Ledgerly and should be reviewed and confirmed by the owner or legal counsel before publication.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">18. Severability</h2>
          <p className="text-slate-300 leading-relaxed">
            If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue in full force and effect. The invalid provision will be replaced with the closest enforceable provision that reflects the parties' intent.
          </p>
        </section>

        <section className="space-y-4 border-t border-slate-800 pt-6">
          <h2 className="text-xl font-semibold text-white">19. Contact</h2>
          <p className="text-slate-300 leading-relaxed">
            Service: Ledgerly<br />
            Website: https://www.ledgerlyhq.app<br />
            Terms Contact: The Ledgerly Team (abdelilahlamrabat18@gmail.com)
          </p>
        </section>
      </div>
    </div>
  );
}

export default TermsPage;