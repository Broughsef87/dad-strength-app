export const metadata = {
  title: 'Fitness & Medical Disclaimer — Dad Strength',
  description: 'Fitness and medical disclaimer for the Dad Strength app.',
}

export default function FitnessDisclaimer() {
  const lastUpdated = 'August 23, 2026'
  const contactEmail = 'dad.strength@the-forge-agency.com'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <div className="mb-10">
          <p className="text-xs lowercase text-muted-foreground mb-2">Legal</p>
          <h1 className="text-3xl font-display font-semibold lowercase">Fitness &amp; Medical Disclaimer</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose-paper space-y-8 text-sm text-muted-foreground leading-relaxed">

          <section className="p-4 rounded-xl border border-brand/30 bg-brand/5">
            <p className="text-foreground font-bold mb-2">The short version</p>
            <p>
              Dad Strength prescribes hard training with heavy loads. Exercise carries real risk. You train
              at your own risk, you are responsible for your own body, and nothing in this app is medical
              advice. Talk to your physician before you start — especially if you have any health condition,
              injury, or haven&apos;t trained in a while.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Not Medical Advice</h2>
            <p>
              All content in the Dad Strength app — workouts, training programs, load and rep prescriptions,
              AI-generated coaching, recovery guidance, sleep and body-composition tracking, and any nutrition
              content — is for general informational and educational purposes only. It is not medical advice,
              diagnosis, or treatment, and it is not a substitute for consultation with a qualified physician,
              physical therapist, or other healthcare provider. Using the app does not create a
              provider–patient relationship of any kind.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Consult Your Physician First</h2>
            <p className="mb-3">
              Before beginning this or any exercise program, consult your physician — particularly if any of
              the following apply:
            </p>
            <ul className="space-y-2 list-none">
              {[
                'Heart disease, high blood pressure, or any cardiovascular condition',
                'Chest pain, dizziness, or shortness of breath during exertion',
                'Bone, joint, tendon, or back problems — past or present',
                'Diabetes, asthma, or any chronic medical condition',
                'You are taking medication that affects heart rate, blood pressure, or balance',
                'You have been sedentary or have not trained under load recently',
                'You are recovering from surgery, illness, or injury',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Assumption of Risk</h2>
            <p className="mb-3">
              Strength training — especially barbell training at or near maximal loads — carries inherent
              risks that cannot be eliminated, including muscle strains and tears, joint and connective-tissue
              injury, dropped-load injuries, cardiovascular events, and in rare cases catastrophic injury or
              death.
            </p>
            <p>
              <span className="text-foreground font-bold">By using Dad Strength, you knowingly and voluntarily
              assume all risk of injury, illness, or death arising from your training.</span> You alone decide
              whether any exercise, weight, or protocol is appropriate for you, and you are responsible for
              training with proper technique, appropriate equipment (including safety bars, collars, and
              spotters where relevant), and within your own limits.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">The App Doesn&apos;t Know Your Body</h2>
            <p>
              Programs and AI-generated recommendations are produced from the limited information you provide.
              They cannot account for your full medical history, technique, fatigue, equipment, or environment.
              A prescribed load or progression may be inappropriate for you on any given day. If something
              feels wrong — sharp pain, chest discomfort, unusual shortness of breath, dizziness, numbness —
              <span className="text-foreground font-bold"> stop immediately</span> and seek medical attention.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">No Guaranteed Results</h2>
            <p>
              Results from any training program vary by individual. We make no promises about strength gains,
              body-composition changes, or any other outcome.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Emergencies</h2>
            <p>
              The app is not an emergency service. If you believe you are experiencing a medical emergency,
              stop training and call your local emergency number (911 in the US) immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-display font-semibold lowercase text-foreground mb-3">Contact</h2>
            <p>
              Questions about this disclaimer? Reach out:{' '}
              <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">{contactEmail}</a>
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-border/30">
          <div className="flex items-center justify-center gap-4 mb-4">
            <a href="/privacy" className="text-xs text-muted-foreground hover:text-foreground lowercase transition-colors">Privacy</a>
            <a href="/terms" className="text-xs text-muted-foreground hover:text-foreground lowercase transition-colors">Terms</a>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Dad Strength. Strong dads raise strong kids.
          </p>
        </div>

      </div>
    </div>
  )
}
