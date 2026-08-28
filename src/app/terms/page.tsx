export const metadata = {
  title: 'Terms of Service — Dad Strength',
  description: 'Terms of Service for the Dad Strength app.',
}

export default function TermsOfService() {
  const lastUpdated = 'August 23, 2026'
  const contactEmail = 'dad.strength@the-forge-agency.com'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <div className="mb-10">
          <p className="text-xs lowercase text-muted-foreground mb-2">Legal</p>
          <h1 className="text-3xl font-display font-semibold lowercase">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Agreement</h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your use of the Dad Strength app and website
              (the &quot;Service&quot;), operated by Dad Strength (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an
              account or using the Service, you agree to these Terms and to our{' '}
              <a href="/privacy" className="text-brand hover:underline">Privacy Policy</a> and{' '}
              <a href="/disclaimer" className="text-brand hover:underline">Fitness &amp; Medical Disclaimer</a>,
              which are part of these Terms. If you don&apos;t agree, don&apos;t use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Who Can Use It</h2>
            <p>
              You must be at least 18 years old to use the Service, or at least 13 with the consent and
              supervision of a parent or legal guardian who agrees to these Terms on your behalf. By using
              the Service you represent that you meet this requirement and that any information you provide
              is accurate.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Assumption of Risk</h2>
            <p className="mb-3">
              Dad Strength is a strength and conditioning app. It prescribes physically demanding exercise,
              including heavy barbell training. Exercise carries inherent risk — including muscle and joint
              injury, cardiovascular events, and in rare cases serious injury or death.
            </p>
            <p className="mb-3">
              <span className="text-foreground font-bold">By using the Service, you voluntarily accept and
              assume all risk of injury arising from your training.</span> You agree that you are solely
              responsible for your decision to perform any workout, exercise, load, or protocol suggested by
              the Service, and for performing it with appropriate equipment, supervision, and technique.
            </p>
            <p>
              The full{' '}
              <a href="/disclaimer" className="text-brand hover:underline">Fitness &amp; Medical Disclaimer</a>{' '}
              applies to everything the Service shows you. Read it. Talk to your physician before starting.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Not Medical Advice</h2>
            <p>
              The Service — including its workouts, programs, AI coaching output, recovery suggestions, and
              any nutrition or body-composition content — is provided for general informational and
              educational purposes only. It is not medical advice, is not a substitute for professional
              medical care, and does not create a provider–patient relationship. Never disregard professional
              medical advice or delay seeking it because of something the Service told you.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Your Account</h2>
            <p>
              You&apos;re responsible for your account credentials and everything that happens under your
              account. Keep your password secure and tell us immediately if you suspect unauthorized access.
              You may delete your account at any time from Settings; deletion permanently removes your data
              as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Subscriptions &amp; Billing</h2>
            <div className="space-y-3">
              <p>
                Parts of the Service are free. Premium features require a paid plan (&quot;Dad Strong+&quot;),
                offered as a recurring subscription (monthly or yearly) or, when available, a one-time
                Founder&apos;s Pass. Payments are processed by Stripe.
              </p>
              <p>
                <span className="text-foreground font-bold">Renewal.</span> Subscriptions renew automatically
                at the end of each billing period until cancelled. Your payment method is charged at the start
                of each period at the then-current price. We&apos;ll notify you in advance of any price change.
              </p>
              <p>
                <span className="text-foreground font-bold">Cancelling.</span> You can cancel any time from
                Settings → Manage Billing. Cancellation takes effect at the end of the current billing period;
                you keep premium access until then. Except where required by law, payments already made are
                non-refundable.
              </p>
              <p>
                <span className="text-foreground font-bold">Founder&apos;s Pass.</span> The Founder&apos;s Pass is a
                one-time purchase granting ongoing premium access for as long as the Service operates. It is
                not a subscription and does not renew.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Acceptable Use</h2>
            <p className="mb-3">Don&apos;t misuse the Service. In particular, you agree not to:</p>
            <ul className="space-y-2 list-none">
              {[
                'Reverse engineer, scrape, or access the Service by any means other than the interfaces we provide',
                'Resell, sublicense, or share your account or premium access',
                'Interfere with or disrupt the Service, its servers, or its security measures',
                'Use the Service to violate any law or the rights of others',
                'Upload content that is unlawful, infringing, or harmful',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Your Content &amp; Our IP</h2>
            <p className="mb-3">
              You own the data you enter into the Service — your logs, notes, goals, and personal records. You
              grant us a limited license to store and process that data solely to operate and improve the
              Service, as described in the Privacy Policy.
            </p>
            <p>
              The Service itself — its software, design, programs, branding, and content — belongs to us or
              our licensors. We grant you a personal, non-exclusive, non-transferable license to use it for
              your own training while these Terms are in effect. No other rights are granted.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">AI Features</h2>
            <p>
              Some features use artificial intelligence to generate coaching text, workout adjustments, and
              summaries. AI output can be wrong, incomplete, or unsuitable for your situation. It is provided
              as-is, is not reviewed by a medical or coaching professional, and is subject to the Assumption
              of Risk and Not Medical Advice sections above. Use your judgment.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Termination</h2>
            <p>
              You can stop using the Service or delete your account at any time. We may suspend or terminate
              your access if you violate these Terms, if required by law, or if we discontinue the Service.
              If we terminate a paid plan without cause, we&apos;ll refund the unused portion of your current
              billing period. Sections that by their nature should survive termination (assumption of risk,
              disclaimers, limitation of liability, indemnification) survive.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any
              kind, express or implied — including fitness for a particular purpose, merchantability, accuracy,
              and non-infringement. We don&apos;t warrant that the Service will be uninterrupted, error-free, or
              that it will produce any particular training result.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we will not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or for personal injury, loss of profits, or loss of
              data, arising from or related to your use of the Service. To the maximum extent permitted by
              law, our total liability for any claim arising out of the Service is limited to the greater of
              (a) the amount you paid us in the 12 months before the claim, or (b) fifty US dollars ($50).
              Some jurisdictions don&apos;t allow certain limitations, so parts of this section may not apply
              to you.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Indemnification</h2>
            <p>
              You agree to indemnify and hold us harmless from claims, damages, and expenses (including
              reasonable attorneys&apos; fees) arising from your use of the Service, your violation of these
              Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Governing Law &amp; Disputes</h2>
            <p>
              These Terms are governed by the laws of the State of Colorado, USA, without regard to conflict
              of law rules. Disputes will be resolved in the state or federal courts located in Colorado, and
              you consent to their jurisdiction. Before filing a claim, contact us — most issues can be
              resolved directly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we do, we&apos;ll update the &quot;last
              updated&quot; date above, and for significant changes we&apos;ll notify you via email or an
              in-app notice. Continued use of the Service after changes take effect constitutes acceptance of
              the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Contact</h2>
            <p>
              Questions about these Terms? Reach out:{' '}
              <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">{contactEmail}</a>
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-border/30">
          <div className="flex items-center justify-center gap-4 mb-4">
            <a href="/privacy" className="text-xs text-muted-foreground hover:text-foreground lowercase transition-colors">Privacy</a>
            <a href="/disclaimer" className="text-xs text-muted-foreground hover:text-foreground lowercase transition-colors">Disclaimer</a>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Dad Strength. Strong dads raise strong kids.
          </p>
        </div>

      </div>
    </div>
  )
}
