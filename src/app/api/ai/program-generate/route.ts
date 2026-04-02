import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

const DAD_STRONG_3 = {
  name: "Dad Strong 3",
  daysPerWeek: 3,
  days: [
    {
      dayNumber: 1,
      dayName: "Push",
      exercises: [
        { name: "Barbell Bench Press", sets: 4, repMin: 5, repMax: 8, perSetRir: [3, 3, 3, 2], movementPattern: "push_horizontal", setOrder: 1 },
        { name: "Incline DB Press", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "push_horizontal", setOrder: 2 },
        { name: "Cable Flyes", sets: 2, repMin: 6, repMax: 10, perSetRir: [4, 3], movementPattern: "push_fly", setOrder: 3 },
        { name: "Barbell OHP", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "push_vertical", setOrder: 4 },
        { name: "EZ Bar Skull Crushers", sets: 3, repMin: 6, repMax: 10, perSetRir: [3, 3, 3], movementPattern: "push_tricep", setOrder: 5 },
        { name: "Cable Triceps Pushdown", sets: 2, repMin: 6, repMax: 10, perSetRir: [4, 4], movementPattern: "push_tricep", setOrder: 6 },
        { name: "DB Lateral Raise", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 3, 3], movementPattern: "isolation_shoulder", setOrder: 7 },
        { name: "Farmer's Carry", sets: 3, repMin: 50, repMax: 50, perSetRir: [3, 3, 3], movementPattern: "gpp_carry", setOrder: 8, notes: "50 yds per set" },
        { name: "Sled Push / Prowler", sets: 3, repMin: 30, repMax: 30, perSetRir: [3, 3, 2], movementPattern: "gpp_push", setOrder: 9, notes: "30 yds per set" },
      ]
    },
    {
      dayNumber: 2,
      dayName: "Legs",
      exercises: [
        { name: "Barbell Back Squat", sets: 4, repMin: 4, repMax: 6, perSetRir: [3, 3, 3, 2], movementPattern: "squat", setOrder: 1 },
        { name: "Leg Press", sets: 2, repMin: 6, repMax: 10, perSetRir: [4, 4], movementPattern: "squat", setOrder: 2 },
        { name: "Leg Extension", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "isolation_quad", setOrder: 3 },
        { name: "Barbell Bulgarian Split Squat", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "squat_unilateral", setOrder: 4 },
        { name: "Lying Leg Curls", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "isolation_hamstring", setOrder: 5 },
        { name: "Standing Calf Raise", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 4, 4], movementPattern: "isolation_calf", setOrder: 6 },
        { name: "Hip Abduction Machine", sets: 2, repMin: 15, repMax: 20, perSetRir: [4, 3], movementPattern: "gpp_hip", setOrder: 7 },
      ]
    },
    {
      dayNumber: 3,
      dayName: "Pull",
      exercises: [
        { name: "Deadlift", sets: 5, repMin: 5, repMax: 5, perSetRir: [4, 4, 3, 3, 3], movementPattern: "hinge", setOrder: 1 },
        { name: "Barbell Good Morning", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "hinge", setOrder: 2 },
        { name: "Barbell Rows", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "pull_horizontal", setOrder: 3 },
        { name: "Lat Pulldown", sets: 2, repMin: 12, repMax: 15, perSetRir: [4, 3], movementPattern: "pull_vertical", setOrder: 4 },
        { name: "Seated Cable Rows", sets: 2, repMin: 15, repMax: 20, perSetRir: [4, 3], movementPattern: "pull_horizontal", setOrder: 5 },
        { name: "EZ Bar Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 4, 3], movementPattern: "isolation_bicep", setOrder: 6 },
        { name: "Alternating DB Curls", sets: 2, repMin: 12, repMax: 15, perSetRir: [4, 3], movementPattern: "isolation_bicep", setOrder: 7 },
        { name: "Face Pulls", sets: 3, repMin: 15, repMax: 20, perSetRir: [4, 4, 3], movementPattern: "pull_rear_delt", setOrder: 8 },
        { name: "Battle Ropes", sets: 3, repMin: 45, repMax: 45, perSetRir: [4, 4, 3], movementPattern: "gpp_conditioning", setOrder: 9, notes: "45 sec per set" },
      ]
    },
  ]
}

const DAD_STRONG_5 = {
  name: "Dad Strong",
  daysPerWeek: 5,
  days: [
    {
      dayNumber: 1,
      dayName: "Pressing",
      exercises: [
        { name: "Barbell Bench Press", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "push_horizontal", setOrder: 1 },
        { name: "Incline DB Press", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_horizontal", setOrder: 2 },
        { name: "Cable Flyes", sets: 2, repMin: 12, repMax: 15, perSetRir: [4, 3], movementPattern: "push_fly", setOrder: 3 },
        { name: "Close-Grip Bench Press", sets: 2, repMin: 6, repMax: 10, perSetRir: [4, 4], movementPattern: "push_tricep", setOrder: 4 },
        { name: "EZ Bar Skull Crushers", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_tricep", setOrder: 5 },
        { name: "Cable Triceps Pushdown (Bar)", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 4, 4], movementPattern: "push_tricep", setOrder: 6 },
        { name: "Farmer's Carry", sets: 3, repMin: 50, repMax: 50, perSetRir: [3, 3, 3], movementPattern: "gpp", setOrder: 7, notes: "50 yds per set" },
      ]
    },
    {
      dayNumber: 2,
      dayName: "Legs - Quad Focused",
      exercises: [
        { name: "Barbell Back Squat (High Bar)", sets: 4, repMin: 5, repMax: 5, perSetRir: [3, 3, 3, 2], movementPattern: "squat", setOrder: 1 },
        { name: "Bulgarian Split Squat", sets: 2, repMin: 8, repMax: 12, perSetRir: [2, 2], movementPattern: "squat_unilateral", setOrder: 2 },
        { name: "Leg Press", sets: 2, repMin: 5, repMax: 8, perSetRir: [4, 4], movementPattern: "squat", setOrder: 3 },
        { name: "Leg Extension", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 2], movementPattern: "isolation_quad", setOrder: 4 },
        { name: "Hamstring Curl", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "isolation_hamstring", setOrder: 5 },
        { name: "Standing Calf Raise", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 4, 4], movementPattern: "isolation_calf", setOrder: 6 },
        { name: "Sled Push / Prowler", sets: 3, repMin: 30, repMax: 30, perSetRir: [3, 3, 2], movementPattern: "gpp", setOrder: 7, notes: "30 yds per set" },
      ]
    },
    {
      dayNumber: 3,
      dayName: "Shoulders and Arms",
      exercises: [
        { name: "Barbell Overhead Press", sets: 3, repMin: 5, repMax: 10, perSetRir: [3, 3, 2], movementPattern: "push_vertical", setOrder: 1 },
        { name: "DB Lateral Raise", sets: 3, repMin: 12, repMax: 15, perSetRir: [3, 3, 3], movementPattern: "isolation_shoulder", setOrder: 2 },
        { name: "Alternating DB Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 2], movementPattern: "isolation_bicep", setOrder: 3 },
        { name: "Hammer Curl", sets: 2, repMin: 5, repMax: 10, perSetRir: [4, 3], movementPattern: "isolation_bicep", setOrder: 4 },
        { name: "Dips (Triceps Focused)", sets: 2, repMin: 5, repMax: 15, perSetRir: [3, 2], movementPattern: "push_tricep", setOrder: 5 },
        { name: "Cable Triceps Pushdown (Rope)", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_tricep", setOrder: 6 },
        { name: "Waiter's Walk (overhead carry)", sets: 3, repMin: 40, repMax: 40, perSetRir: [3, 3, 3], movementPattern: "gpp", setOrder: 7, notes: "40 yds per set" },
      ]
    },
    {
      dayNumber: 4,
      dayName: "Legs - Posterior Chain",
      exercises: [
        { name: "Deadlift", sets: 6, repMin: 3, repMax: 3, perSetRir: [4, 4, 4, 3, 3, 3], movementPattern: "hinge", setOrder: 1 },
        { name: "Barbell Good Morning", sets: 3, repMin: 6, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "hinge", setOrder: 2 },
        { name: "DB Stiff Legged Deadlift", sets: 2, repMin: 12, repMax: 15, perSetRir: [4, 3], movementPattern: "hinge", setOrder: 3 },
        { name: "Hip Abduction Machine", sets: 3, repMin: 15, repMax: 20, perSetRir: [4, 4, 4], movementPattern: "isolation_hip", setOrder: 4 },
        { name: "Walking Lunges", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 2], movementPattern: "gpp", setOrder: 5 },
        { name: "Back Extension Machine", sets: 4, repMin: 12, repMax: 15, perSetRir: [4, 4, 4, 4], movementPattern: "hinge_extension", setOrder: 6 },
        { name: "Trap Bar Carry", sets: 3, repMin: 50, repMax: 50, perSetRir: [3, 3, 3], movementPattern: "gpp", setOrder: 7, notes: "50 yds per set" },
      ]
    },
    {
      dayNumber: 5,
      dayName: "Pulling",
      exercises: [
        { name: "Barbell Rows", sets: 3, repMin: 5, repMax: 5, perSetRir: [3, 3, 2], movementPattern: "pull_horizontal", setOrder: 1 },
        { name: "Wide Grip Lat Pulldown", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "pull_vertical", setOrder: 2 },
        { name: "Kroc Rows (use straps if possible)", sets: 3, repMin: 12, repMax: 15, perSetRir: [3, 3, 3], movementPattern: "pull_horizontal", setOrder: 3 },
        { name: "Straight Arm Lat Pulldown", sets: 2, repMin: 15, repMax: 20, perSetRir: [4, 3], movementPattern: "pull_vertical", setOrder: 4 },
        { name: "EZ Bar Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 4, 4], movementPattern: "isolation_bicep", setOrder: 5 },
        { name: "Cable Curls", sets: 2, repMin: 12, repMax: 15, perSetRir: [3, 3], movementPattern: "isolation_bicep", setOrder: 6 },
        { name: "Battle Ropes", sets: 3, repMin: 30, repMax: 30, perSetRir: [2, 2, 2], movementPattern: "gpp", setOrder: 7, notes: "30 sec per set" },
      ]
    }
  ]
}

const HYBRID_3 = {
  name: "Hybrid 3",
  daysPerWeek: 3,
  days: [
    {
      dayNumber: 1,
      dayName: "Upper Body Strength",
      exercises: [
        { name: "Barbell Bench Press", sets: 4, repMin: 4, repMax: 6, perSetRir: [3, 3, 3, 2], movementPattern: "push_horizontal", setOrder: 1 },
        { name: "Barbell Rows", sets: 4, repMin: 4, repMax: 6, perSetRir: [3, 3, 3, 2], movementPattern: "pull_horizontal", setOrder: 2 },
        { name: "Barbell OHP", sets: 3, repMin: 6, repMax: 10, perSetRir: [3, 3, 3], movementPattern: "push_vertical", setOrder: 3 },
        { name: "Weighted Pull-Ups", sets: 3, repMin: 6, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "pull_vertical", setOrder: 4 },
        { name: "Incline DB Press", sets: 2, repMin: 8, repMax: 12, perSetRir: [3, 3], movementPattern: "push_horizontal", setOrder: 5 },
        { name: "Seated Cable Rows", sets: 2, repMin: 10, repMax: 12, perSetRir: [3, 3], movementPattern: "pull_horizontal", setOrder: 6 },
        { name: "Face Pulls", sets: 3, repMin: 15, repMax: 20, perSetRir: [4, 4, 3], movementPattern: "pull_rear_delt", setOrder: 7 },
        { name: "DB Lateral Raise", sets: 3, repMin: 12, repMax: 15, perSetRir: [4, 3, 3], movementPattern: "isolation_shoulder", setOrder: 8 },
        { name: "EZ Bar Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "isolation_bicep", setOrder: 9 },
        { name: "Cable Triceps Pushdown", sets: 2, repMin: 10, repMax: 12, perSetRir: [4, 3], movementPattern: "push_tricep", setOrder: 10 },
      ]
    },
    {
      dayNumber: 2,
      dayName: "Legs + Metabolic Conditioning",
      exercises: [
        { name: "Barbell Back Squat", sets: 4, repMin: 4, repMax: 6, perSetRir: [3, 3, 3, 2], movementPattern: "squat", setOrder: 1 },
        { name: "Romanian Deadlift", sets: 3, repMin: 8, repMax: 10, perSetRir: [3, 3, 3], movementPattern: "hinge", setOrder: 2 },
        { name: "KB Front Rack Lunge", sets: 3, repMin: 8, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "squat_unilateral", setOrder: 3, notes: "8 reps each leg" },
        { name: "Nordic Curl / GHR", sets: 2, repMin: 5, repMax: 8, perSetRir: [3, 3], movementPattern: "isolation_hamstring", setOrder: 4 },
        { name: "Standing Calf Raise", sets: 3, repMin: 10, repMax: 15, perSetRir: [4, 4, 4], movementPattern: "isolation_calf", setOrder: 5 },
        { name: "KB Swings", sets: 3, repMin: 15, repMax: 15, perSetRir: [2, 2, 2], movementPattern: "gpp_conditioning", setOrder: 6, notes: "3 rounds, 15 reps — load by feel, RPE 8" },
        { name: "Row / Bike / Run", sets: 3, repMin: 400, repMax: 400, perSetRir: [2, 2, 2], movementPattern: "gpp_cardio", setOrder: 7, notes: "3 rounds, 400m — RPE 8" },
      ]
    },
    {
      dayNumber: 3,
      dayName: "GPP / Strongman + Full Body",
      exercises: [
        { name: "Deadlift", sets: 5, repMin: 3, repMax: 5, perSetRir: [3, 3, 3, 2, 2], movementPattern: "hinge", setOrder: 1 },
        { name: "Farmer's Carry", sets: 4, repMin: 50, repMax: 50, perSetRir: [3, 3, 2, 2], movementPattern: "gpp_carry", setOrder: 2, notes: "50 yds per set — load by feel, RPE 7-8" },
        { name: "Sled Push / Prowler", sets: 4, repMin: 20, repMax: 20, perSetRir: [2, 2, 2, 2], movementPattern: "gpp_push", setOrder: 3, notes: "20 yds per set — RPE 8" },
        { name: "Axle Bar / Log Press", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "push_vertical", setOrder: 4 },
        { name: "Sandbag Clean / KB Clean", sets: 4, repMin: 5, repMax: 5, perSetRir: [3, 3, 3, 3], movementPattern: "gpp_power", setOrder: 5, notes: "Load by feel, RPE 7" },
        { name: "Atlas Stone / Sandbag Loads", sets: 3, repMin: 1, repMax: 1, perSetRir: [2, 2, 2], movementPattern: "gpp_strongman", setOrder: 6, notes: "3 loads — RPE 8" },
        { name: "DB/KB Hang Power Clean Finisher", sets: 3, repMin: 8, repMax: 8, perSetRir: [2, 2, 2], movementPattern: "gpp_power", setOrder: 7, notes: "3 rounds, RPE 8" },
        { name: "Row / Bike / Run", sets: 3, repMin: 200, repMax: 200, perSetRir: [2, 2, 2], movementPattern: "gpp_cardio", setOrder: 8, notes: "3 rounds, 200m — RPE 8" },
      ]
    },
  ]
}

const HYBRID_5 = {
  name: "Hybrid 5",
  daysPerWeek: 5,
  days: [
    {
      dayNumber: 1,
      dayName: "Bodybuilding Push",
      exercises: [
        { name: "Barbell Bench Press", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "push_horizontal", setOrder: 1 },
        { name: "Incline DB Press", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_horizontal", setOrder: 2 },
        { name: "Cable Flyes", sets: 3, repMin: 12, repMax: 15, perSetRir: [4, 3, 3], movementPattern: "push_fly", setOrder: 3 },
        { name: "Barbell OHP", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_vertical", setOrder: 4 },
        { name: "DB Lateral Raise", sets: 3, repMin: 12, repMax: 15, perSetRir: [4, 3, 3], movementPattern: "isolation_shoulder", setOrder: 5 },
        { name: "Dips (Triceps)", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 2], movementPattern: "push_tricep", setOrder: 6 },
        { name: "KB/DB Push Press Explosive", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "push_power", setOrder: 7 },
      ]
    },
    {
      dayNumber: 2,
      dayName: "Metabolic Conditioning",
      exercises: [
        { name: "DB/KB Hang Power Clean", sets: 4, repMin: 5, repMax: 5, perSetRir: [3, 3, 3, 3], movementPattern: "gpp_power", setOrder: 1, notes: "Strength primer — RPE 7" },
        { name: "Row / Bike / Run Circuit", sets: 4, repMin: 500, repMax: 500, perSetRir: [2, 2, 2, 2], movementPattern: "gpp_cardio", setOrder: 2, notes: "4 rounds, 500m — RPE 8" },
        { name: "KB Swings", sets: 4, repMin: 15, repMax: 15, perSetRir: [2, 2, 2, 2], movementPattern: "gpp_conditioning", setOrder: 3, notes: "4 rounds, 15 reps — RPE 8" },
        { name: "Goblet Squat", sets: 4, repMin: 12, repMax: 12, perSetRir: [3, 3, 3, 3], movementPattern: "squat", setOrder: 4, notes: "4 rounds, 12 reps" },
        { name: "DB Push Press", sets: 4, repMin: 10, repMax: 10, perSetRir: [3, 3, 3, 3], movementPattern: "push_vertical", setOrder: 5, notes: "4 rounds, 10 reps" },
        { name: "Box Jumps", sets: 3, repMin: 8, repMax: 8, perSetRir: [2, 2, 2], movementPattern: "gpp_power", setOrder: 6, notes: "RPE 8" },
        { name: "Burpees", sets: 3, repMin: 10, repMax: 10, perSetRir: [2, 2, 2], movementPattern: "gpp_conditioning", setOrder: 7, notes: "RPE 8" },
      ]
    },
    {
      dayNumber: 3,
      dayName: "Functional Legs + Conditioning",
      exercises: [
        { name: "Barbell Back Squat", sets: 4, repMin: 4, repMax: 6, perSetRir: [3, 3, 3, 2], movementPattern: "squat", setOrder: 1 },
        { name: "Romanian Deadlift", sets: 3, repMin: 8, repMax: 10, perSetRir: [3, 3, 3], movementPattern: "hinge", setOrder: 2 },
        { name: "KB Front Rack Lunge", sets: 3, repMin: 8, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "squat_unilateral", setOrder: 3, notes: "8 reps each leg" },
        { name: "Weighted Box Step-Up", sets: 3, repMin: 10, repMax: 10, perSetRir: [3, 3, 3], movementPattern: "squat_unilateral", setOrder: 4, notes: "10 reps each leg" },
        { name: "Nordic Curl / GHR", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "isolation_hamstring", setOrder: 5 },
        { name: "KB Swing Finisher", sets: 3, repMin: 20, repMax: 20, perSetRir: [2, 2, 2], movementPattern: "gpp_conditioning", setOrder: 6, notes: "RPE 8" },
        { name: "Row / Bike / Run", sets: 3, repMin: 250, repMax: 250, perSetRir: [2, 2, 2], movementPattern: "gpp_cardio", setOrder: 7, notes: "3 intervals, 250m — RPE 8" },
      ]
    },
    {
      dayNumber: 4,
      dayName: "GPP / Strongman",
      exercises: [
        { name: "Deadlift", sets: 5, repMin: 3, repMax: 5, perSetRir: [3, 3, 3, 2, 2], movementPattern: "hinge", setOrder: 1 },
        { name: "Farmer's Carry", sets: 4, repMin: 50, repMax: 50, perSetRir: [3, 3, 2, 2], movementPattern: "gpp_carry", setOrder: 2, notes: "50 yds per set — load by feel, RPE 7-8" },
        { name: "Trap Bar Carry", sets: 3, repMin: 40, repMax: 40, perSetRir: [3, 3, 3], movementPattern: "gpp_carry", setOrder: 3, notes: "40 yds per set — RPE 7" },
        { name: "Sled Push / Prowler", sets: 4, repMin: 20, repMax: 20, perSetRir: [2, 2, 2, 2], movementPattern: "gpp_push", setOrder: 4, notes: "20 yds per set — RPE 8" },
        { name: "Sandbag Clean / KB Clean", sets: 4, repMin: 5, repMax: 5, perSetRir: [3, 3, 3, 3], movementPattern: "gpp_power", setOrder: 5, notes: "Load by feel, RPE 7" },
        { name: "Axle Bar / Log Press", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "push_vertical", setOrder: 6 },
        { name: "Atlas Stone / Sandbag Loads", sets: 3, repMin: 1, repMax: 1, perSetRir: [2, 2, 2], movementPattern: "gpp_strongman", setOrder: 7, notes: "3 loads — RPE 8" },
      ]
    },
    {
      dayNumber: 5,
      dayName: "Bodybuilding Pull",
      exercises: [
        { name: "Barbell Rows", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "pull_horizontal", setOrder: 1 },
        { name: "Weighted Pull-Ups", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "pull_vertical", setOrder: 2 },
        { name: "Wide Grip Lat Pulldown", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "pull_vertical", setOrder: 3 },
        { name: "Seated Cable Rows", sets: 3, repMin: 10, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "pull_horizontal", setOrder: 4 },
        { name: "Face Pulls", sets: 3, repMin: 15, repMax: 20, perSetRir: [4, 4, 3], movementPattern: "pull_rear_delt", setOrder: 5 },
        { name: "EZ Bar Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "isolation_bicep", setOrder: 6 },
        { name: "Hammer Curls", sets: 3, repMin: 10, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "isolation_bicep", setOrder: 7 },
      ]
    },
  ]
}

const PROGRAM_TEMPLATES: Record<string, typeof DAD_STRONG_5> = {
  'dad-strong-3': DAD_STRONG_3,
  'dad-strong-5': DAD_STRONG_5,
  'hybrid-3': HYBRID_3,
  'hybrid-5': HYBRID_5,
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId, weekNumber, programSlug, userProfile, recentLogs, calibrationWeights } = await request.json() as {
      userId: string
      weekNumber: number
      programSlug: string
      userProfile?: Record<string, unknown>
      recentLogs?: unknown[]
      calibrationWeights?: Record<string, number>
    }

    if (!userId || !weekNumber || !programSlug) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Derive accessory weights from main lift calibration weights
    function deriveAccessoryWeights(cw: Record<string, number>) {
      const bench = cw.bench || 0
      const squat = cw.squat || 0
      const deadlift = cw.deadlift || 0
      const row = cw.row || 0

      return {
        // Chest accessories
        incline_db_press: Math.round((bench * 0.35) / 5) * 5,
        cable_flyes: Math.round((bench * 0.15) / 5) * 5,
        jm_press: Math.round((bench * 0.45) / 5) * 5,
        skull_crushers: Math.round((bench * 0.35) / 5) * 5,
        // Back accessories
        lat_pulldown: Math.round((row * 0.85) / 5) * 5,
        seated_cable_row: Math.round((row * 0.75) / 5) * 5,
        straight_arm_pulldown: Math.round((row * 0.3) / 5) * 5,
        // Leg accessories
        leg_press: Math.round((squat * 1.5) / 5) * 5,
        romanian_deadlift: Math.round((deadlift * 0.5) / 5) * 5,
        good_morning: Math.round((squat * 0.3) / 5) * 5,
        // Small muscles (rough estimates)
        curl: Math.round((row * 0.2) / 5) * 5,
        tricep_pushdown: Math.round((bench * 0.2) / 5) * 5,
        calf_raise: Math.round((squat * 0.4) / 5) * 5,
      }
    }

    const template = PROGRAM_TEMPLATES[programSlug] ?? PROGRAM_TEMPLATES['dad-strong-5']
    if (!template) {
      return NextResponse.json({ error: `Unknown program: ${programSlug}` }, { status: 400 })
    }

    // ── Build log summary per exercise ─────────────────────────────────────
    const logsByExercise: Record<string, Array<{
      weight: number
      reps: number
      rir_actual: number | null
      completed: boolean
      logged_at: string
    }>> = {}

    for (const log of (recentLogs || [])) {
      if (!logsByExercise[log.exercise]) {
        logsByExercise[log.exercise] = []
      }
      logsByExercise[log.exercise].push(log)
    }

    // Summarize last session per exercise
    const exerciseSummaryLines: string[] = []
    for (const [exercise, logs] of Object.entries(logsByExercise)) {
      const sorted = logs.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
      const lastSessionDate = sorted[0].logged_at.split('T')[0]
      const lastSession = sorted.filter(l => l.logged_at.startsWith(lastSessionDate))
      const setLines = lastSession.map((s, i) =>
        `  Set ${i + 1}: ${s.weight}lbs x ${s.reps} reps, RIR logged=${s.rir_actual ?? 'not logged'}, completed=${s.completed}`
      ).join('\n')
      exerciseSummaryLines.push(`${exercise} (last session: ${lastSessionDate}):\n${setLines}`)
    }

    const hasHistory = exerciseSummaryLines.length > 0
    const logContext = hasHistory
      ? `RECENT TRAINING LOGS (last 2 weeks):\n${exerciseSummaryLines.join('\n\n')}`
      : `RECENT TRAINING LOGS: None — this is the user's first week on this program.`

    const templateJson = JSON.stringify(template, null, 2)

    const prompt = `
PROGRAM TEMPLATE:
${templateJson}

USER PROFILE:
- Training age: ${userProfile?.trainingAge ?? 'intermediate'}
- Primary goal: ${userProfile?.primaryGoal ?? 'strength'}
- Equipment available: ${userProfile?.equipment ? Object.entries(userProfile.equipment).filter(([, v]) => v).map(([k]) => k).join(', ') || 'standard gym' : 'standard gym'}

WEEK: ${weekNumber}

${logContext}

Generate a complete week of programmed workouts for week ${weekNumber}.
`.trim()

    // ── Generate AI program ─────────────────────────────────────────────────
    const { object: program } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are an experienced strength coach programming for busy dads. You are data-driven, direct, and brief — no fluff. You write like a coach talking to someone with limited time and real responsibilities.

PROGRAM CHARACTER:
- Dad Strong (dad-strong-3, dad-strong-5): Strength + bodybuilding hybrid with linear progression. Compound-first, accessories follow. Progress weights methodically each week.
- Hybrid (hybrid-3, hybrid-5): Functional strength + GPP. Carries, loaded conditioning, and strongman movements are core to this program. For GPP/strongman days (Farmer's Carry, Sled Push, Atlas Stone, etc.): no RIR targets — use RPE 7-8, load by feel, focus on quality movement and effort. Do not program targetWeight for GPP carries/sleds — set to 0 and note "load by feel".

PROGRESSION RULES (follow these exactly):
1. For each exercise, find the user's last logged weight, reps, and rir_actual from the provided logs.
2. If rir_actual > target RIR (too easy): increase weight — 5 lbs for isolation movements, 10 lbs for compound movements.
3. If rir_actual = target RIR (on target): keep weight. If they hit the top of the rep range, add 2.5 lbs.
4. If rir_actual < target RIR (too hard): keep weight or reduce 5-10%.
5. If completed=false on any set: reduce weight 10% for that exercise.
6. For week 1 with no history and no calibration data, suggest conservative starting weights based on training age:
   - beginner: empty bar or very light weight, technique focus
   - intermediate: moderate working weights (e.g., bench ~135 lbs, squat ~155 lbs, deadlift ~185 lbs)
   - advanced: near-max programming with heavier starting points
7. For week 1 new users: add a note like "Start conservative — we'll dial in your weights over the first 2 sessions"

OUTPUT RULES:
- Always reference actual numbers from logs when explaining progression decisions in progressionNote.
- Keep progressionNote brief: one sentence max. Example: "Up from 185x5 last week — hit top of range with RIR 4."
- coachNote should be 1-2 sentences max. Direct. References what the data shows or what to focus on this week.
- weekTheme should be concise: e.g. "Foundation Week", "Week 3 — Adding Load", "Deload Week".
- Set targetWeight to 0 for bodyweight exercises.
- Ensure every exercise from the template is included in each day.
- deloadRecommended should be true if the user has 4+ consecutive weeks of logged data showing fatigue indicators (rir_actual consistently below target or failed sets).${
        weekNumber === 1 && calibrationWeights && Object.keys(calibrationWeights).length > 0
          ? `

CALIBRATION WEEK RULES (Week 1 only):
- This is the user's calibration week. Do NOT try to guess weights based on training age.
- Use the calibration weights EXACTLY as the starting point for primary lifts.
- For primary lifts: use the calibration weight directly as targetWeight.
- For accessory lifts: use the derived accessory weights provided below.
- Set ALL sets to the SAME weight for each exercise (no wave loading in Week 1).
- The weekTheme should be "Calibration Week"
- The coachNote should explain: "Week 1 is about locking in your baselines. Use exactly these weights, focus on form, and hit the target RIR. We'll start pushing load in Week 2."

Calibration weights entered by user:
${JSON.stringify(calibrationWeights)}

Derived accessory weights (use these for accessories):
${JSON.stringify(deriveAccessoryWeights(calibrationWeights))}`
          : weekNumber === 1
          ? `

WEEK 1 - NO CALIBRATION DATA:
User did not enter starting weights. Suggest conservative starter weights based on training age:
- Beginner: very light (bar + 25s for compounds)
- Intermediate: moderate (bar + 45-90s for compounds)
- Advanced: moderate-heavy (bar + 90-135s for compounds)
Add a note on each exercise: "Adjust this weight to achieve the target RIR — these are estimates."
Set weekTheme to "Calibration Week" regardless.`
          : ''
      }`,
      prompt,
      schema: z.object({
        weekNumber: z.number(),
        programName: z.string(),
        weekTheme: z.string().describe('Short label for this week, e.g. "Foundation Week" or "Push Week 3 — Adding Load"'),
        coachNote: z.string().describe('1-2 sentences from the coach on what to focus on this week, referencing actual data'),
        days: z.array(z.object({
          dayNumber: z.number(),
          dayName: z.string(),
          exercises: z.array(z.object({
            name: z.string(),
            sets: z.array(z.object({
              setNumber: z.number(),
              targetWeight: z.number().describe('Weight in lbs. Use 0 for bodyweight exercises.'),
              targetReps: z.number(),
              targetRir: z.number(),
              notes: z.string().optional().describe('e.g. "increase from last week" or "start conservative"'),
            })),
            progressionNote: z.string().optional().describe('One sentence explaining why weight changed or stayed the same vs last week'),
          })),
        })),
        deloadRecommended: z.boolean(),
        deloadReason: z.string().optional().describe('Why a deload is recommended, if applicable'),
        isCalibrationWeek: z.boolean(),
      }),
    })

    return NextResponse.json({ program })
  } catch (error) {
    console.error('Program Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate program. Try again.' }, { status: 500 })
  }
}
