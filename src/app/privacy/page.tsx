export const metadata = {
  title: 'Privacy Policy — Dad Strength',
  description: 'Privacy Policy for the Dad Strength app.',
}

export default function PrivacyPolicy() {
  const lastUpdated = 'March 29, 2025'
  const contactEmail = 'support@dadstrength.app'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Legal</p>
          <h1 className="text-3xl font-black italic uppercase tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Overview</h2>
            <p>
              Dad Strength ("we," "us," or "our") is committed to protecting your privacy. This policy explains what
              information we collect when you use the Dad Strength app, how we use it, and your rights regarding
              your data. We don't sell your data. Ever.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-foreground mb-1">Account Information</h3>
                <p>
                  When you create an account, we collect your email address and a password (stored securely and never
                  readable by us). You may optionally provide a display name.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Fitness & Health Data</h3>
                <p>
                  We collect workout logs, exercise history, training programs, and progress data that you enter into
                  the app. This includes sets, reps, weights, and workout completion records.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Personal Goals & Preferences</h3>
                <p>
                  We store your training preferences, goals, daily objectives, morning protocol entries, and any
                  personal mission or life context you choose to enter. This information is used solely to
                  personalize your experience.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Payment Information</h3>
                <p>
                  If you subscribe to Dad Strength+, your payment is processed securely by Stripe. We never
                  see or store your full credit card number. We only receive a confirmation token and your
                  subscription status from Stripe.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Usage Data</h3>
                <p>
                  We may collect basic usage information such as which features you use and app performance
                  data. This helps us improve the app. We do not track your location.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">How We Use Your Information</h2>
            <ul className="space-y-2 list-none">
              {[
                'To provide and personalize your Dad Strength experience',
                'To generate AI-powered coaching recommendations (via Google Gemini AI)',
                'To process your subscription and send receipts',
                'To save your workout history and track your progress over time',
                'To improve the app based on how features are used',
                'To communicate important updates about the service',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Third-Party Services</h2>
            <p className="mb-3">We use the following trusted third-party services to operate the app:</p>
            <div className="space-y-3">
              {[
                {
                  name: 'Supabase',
                  desc: 'Secure database and authentication. Your account and workout data is stored on Supabase servers.',
                  link: 'https://supabase.com/privacy',
                },
                {
                  name: 'Stripe',
                  desc: 'Payment processing for Dad Strength+ subscriptions. Stripe is PCI-DSS compliant.',
                  link: 'https://stripe.com/privacy',
                },
                {
                  name: 'Google Gemini AI',
                  desc: 'Powers AI coaching features like the Morning Protocol. Prompts may include your fitness context but never your full name or payment details.',
                  link: 'https://policies.google.com/privacy',
                },
                {
                  name: 'Vercel',
                  desc: 'Hosts and serves the app. Standard web server logs may be retained for security purposes.',
                  link: 'https://vercel.com/legal/privacy-policy',
                },
              ].map(({ name, desc, link }) => (
                <div key={name} className="p-4 rounded-xl border border-border/50 bg-card/30">
                  <p className="font-bold text-foreground mb-1">{name}</p>
                  <p className="text-xs mb-1">{desc}</p>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">
                    Privacy Policy →
                  </a>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account, your personal
              data is permanently removed from our database within 30 days. Anonymized, aggregated usage data
              may be retained indefinitely for product improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="space-y-2 list-none">
              {[
                'Access the personal data we hold about you',
                'Request correction of inaccurate data',
                'Request deletion of your account and all associated data',
                'Export your workout and health data',
                'Opt out of non-essential communications at any time',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{' '}
              <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">{contactEmail}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Children's Privacy</h2>
            <p>
              Dad Strength is intended for users 13 years of age and older. We do not knowingly collect
              personal information from children under 13. If you believe a child under 13 has provided us
              with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. When we do, we'll update the "last updated" date
              at the top of this page. For significant changes, we'll notify you via email or an in-app notice.
              Continued use of the app after changes take effect constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-black uppercase tracking-wide text-foreground mb-3">Contact</h2>
            <p>
              Questions about this policy or your data? Reach out:{' '}
              <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">{contactEmail}</a>
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Dad Strength. Strong dads raise strong kids.
          </p>
        </div>

      </div>
    </div>
  )
}
