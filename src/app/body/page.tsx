'use client'

import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import BodyVitals from '../../components/BodyVitals';
import NapSqueeze from '../../components/NapSqueeze';
import ActiveProgram from '../../components/ActiveProgram';
import RecoveryProtocol from '../../components/RecoveryProtocol';
import RecordsBoard from '../../components/RecordsBoard';
import StrengthCalc from '../../components/StrengthCalc';
import BottomNav from '../../components/BottomNav';
import AppHeader from '../../components/AppHeader';

export default function BodyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader active="train" />
      <div className="max-w-md mx-auto px-6 pt-6">

        <div className="mb-8">
          <p className="telemetry mb-1">SYS // CHASSIS.OPS</p>
          <h1 className="font-display text-4xl tracking-[0.1em] uppercase">Chassis</h1>
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
            <RecordsBoard />
          </motion.div>

          <motion.div variants={fadeUp}>
            <RecoveryProtocol />
          </motion.div>

          <motion.div variants={fadeUp}>
            <BodyVitals />
          </motion.div>

          <motion.div variants={fadeUp}>
            <NapSqueeze />
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
