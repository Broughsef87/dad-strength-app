'use client'

import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import BodyVitals from '../../components/BodyVitals';
import NapSqueeze from '../../components/NapSqueeze';
import ProteinTracker from '../../components/ProteinTracker';
import ActiveProgram from '../../components/ActiveProgram';
import NutritionPeriodization from '../../components/NutritionPeriodization';
import BodyComposition from '../../components/BodyComposition';
import StrengthCalc from '../../components/StrengthCalc';
import BottomNav from '../../components/BottomNav';

export default function BodyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute -top-[20%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[100px]" />
      </div>
      <div className="max-w-md mx-auto px-6 pt-10">

        <div className="relative z-10 mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-brand font-medium mb-2 font-display">Physical</p>
          <h1 className="text-3xl font-light tracking-[0.08em]">Body</h1>
        </div>

        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={fadeUp}>
            <ActiveProgram />
          </motion.div>

          <motion.div variants={fadeUp}>
            <BodyVitals />
          </motion.div>

          <motion.div variants={fadeUp}>
            <NapSqueeze />
          </motion.div>

          <motion.div variants={fadeUp}>
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4 font-display">Metabolic Tracking</h3>
              <ProteinTracker />
            </section>
          </motion.div>

          <motion.div variants={fadeUp}>
            <NutritionPeriodization />
          </motion.div>

          <motion.div variants={fadeUp}>
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4 font-display">Body Composition</h3>
              <BodyComposition />
            </section>
          </motion.div>

          <motion.div variants={fadeUp}>
            <StrengthCalc />
          </motion.div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
