'use client'

import { motion } from 'framer-motion'
import { staggerContainer, fadeUp } from '../../components/ui/motion'
import ActiveProgram from '../../components/ActiveProgram';
import RecordsBoard from '../../components/RecordsBoard';
import TrainingData from '../../components/TrainingData';
import StrengthCalc from '../../components/StrengthCalc';
import BottomNav from '../../components/BottomNav';
import AppHeader from '../../components/AppHeader';

export default function TrainPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <AppHeader active="train" />
      <div className="max-w-md mx-auto px-6 pt-6">

        <div className="mb-8">
          <p className="eyebrow-mono mb-1">train · recover · measure</p>
          <h1 className="font-display text-4xl lowercase">body</h1>
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
            <TrainingData />
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
