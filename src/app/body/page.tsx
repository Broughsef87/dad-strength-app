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
import AppHeader from '../../components/AppHeader';

export default function BodyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader active="train" />
      <div className="max-w-md mx-auto px-6 pt-6">

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 font-display">Physical</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Body</h1>
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
