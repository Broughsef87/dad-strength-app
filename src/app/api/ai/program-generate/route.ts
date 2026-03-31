import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

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

// ── Muscle group mapping ─────────────────────────────────────────────────────

const MOVEMENT_TO_MUSCLE: Record<string, string | null> = {
  push_horizontal: 'chest',
  push_fly: 'chest',
  push_vertical: 'shoulders',
  isolation_shoulder: 'shoulders',
  push_tricep: 'triceps',
  push_power: 'shoulders',
  pull_horizontal: 'back',
  pull_vertical: 'back',
  pull_rear_delt: 'back',
  isolation_bicep: 'biceps',
  squat: 'quads',
  squat_unilateral: 'quads',
  isolation_quad: 'quads',
  hinge: 'hamstrings',
  hinge_extension: 'hamstrings',
  isolation_hamstring: 'hamstrings',
  isolation_calf: 'calves',
  isolation_hip: 'glutes',
  gpp_hip: 'glutes',
  gpp: null,
  gpp_carry: null,
  gpp_push: null,
  gpp_conditioning: null,
  gpp_cardio: null,
  gpp_power: null,
  gpp_strongman: null,
}

const COMPOUND_PATTERNS = new Set([
  'push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical',
  'squat', 'squat_unilateral', 'hinge',
])

// ── Epley-based weight recommendation ────────────────────────────────────────

function epleyWeight(oneRM: number, targetReps: number, targetRir: number): number {
  // Effective reps = reps you could do at this weight = targetReps + targetRir
  const effectiveReps = targetReps + targetRir
  if (effectiveReps <= 1) return oneRM
  const weight = oneRM / (1 + effectiveReps / 30)
  return Math.round(weight / 2.5) * 2.5
}

function get1RMForExercise(
  name: string,
  pattern: string,
  oneRepMaxes: Record<string, number>
): number {
  const n = name.toLowerCase()
  const bench = oneRepMaxes.bench || 0
  const squat = oneRepMaxes.squat || 0
  const deadlift = oneRepMaxes.deadlift || 0
  const ohp = oneRepMaxes.ohp || 0
  const row = oneRepMaxes.row || 0

  // Direct matches
  if (n.includes('bench press') && !n.includes('incline') && !n.includes('db')) return bench
  if ((n.includes('back squat') || n === 'squat') && !n.includes('goblet') && !n.includes('hack')) return squat
  if (n.includes('deadlift') && !n.includes('romanian') && !n.includes('stiff')) return deadlift
  if (n.includes('overhead press') || n.includes('ohp') || n.includes('barbell ohp')) return ohp
  if (n.includes('barbell row') || n.includes('barbell rows')) return row

  // Derivatives by pattern
  // Note: DB/cable weights are per-hand. Ratios tuned for realistic starting weights.
  if (pattern === 'push_horizontal') return Math.round(bench * 0.33 / 2.5) * 2.5  // DB press per hand ~33% of barbell 1RM
  if (pattern === 'push_fly') return Math.round(bench * 0.16 / 2.5) * 2.5          // DB/cable fly, lighter
  if (pattern === 'push_vertical') return ohp || Math.round(bench * 0.60 / 2.5) * 2.5
  if (pattern === 'push_tricep') return Math.round(bench * 0.30 / 2.5) * 2.5       // skull crushers/pushdowns total load
  if (pattern === 'pull_horizontal') return Math.round(row * 0.85 / 2.5) * 2.5    // cable/machine row similar to barbell
  if (pattern === 'pull_vertical') return Math.round(row * 0.70 / 2.5) * 2.5      // lat pulldown
  if (pattern === 'pull_rear_delt') return Math.round(row * 0.18 / 2.5) * 2.5     // face pulls / rear delt flies
  if (pattern === 'isolation_bicep') return Math.round(row * 0.16 / 2.5) * 2.5    // curls per hand
  if (pattern === 'isolation_shoulder') return Math.round((ohp || bench * 0.60) * 0.18 / 2.5) * 2.5  // lateral raise per hand
  if (pattern === 'squat') return Math.round(squat * 1.3 / 5) * 5                 // leg press
  if (pattern === 'squat_unilateral') return Math.round(squat * 0.40 / 2.5) * 2.5 // split squat / lunge per hand
  if (pattern === 'isolation_quad') return Math.round(squat * 0.30 / 2.5) * 2.5   // leg extension stack
  if (pattern === 'hinge') return Math.round(deadlift * 0.50 / 2.5) * 2.5         // RDL / good morning
  if (pattern === 'hinge_extension') return Math.round(deadlift * 0.30 / 2.5) * 2.5
  if (pattern === 'isolation_hamstring') return Math.round(deadlift * 0.20 / 2.5) * 2.5  // leg curl stack
  if (pattern === 'isolation_calf') return Math.round(squat * 0.45 / 5) * 5
  if (pattern === 'isolation_hip') return Math.round(squat * 0.25 / 2.5) * 2.5

  return 0
}

function calcRecommendedWeight(
  name: string,
  pattern: string,
  targetReps: number,
  targetRir: number,
  lastWeekWeight: number | null,
  lastWeekRir: number | null,
  oneRepMaxes: Record<string, number>
): number {
  const isCompound = COMPOUND_PATTERNS.has(pattern)

  if (lastWeekWeight === null) {
    // Week 1 — derive from 1RM
    const rm = get1RMForExercise(name, pattern, oneRepMaxes)
    if (!rm) return 0
    return epleyWeight(rm, targetReps, targetRir)
  }

  // Week 2+ — adjust from last week's actual
  if (lastWeekRir === 0) {
    // Hit true failure → add weight
    return lastWeekWeight + (isCompound ? 5 : 2.5)
  }

  // Otherwise weight stays same; AI changes RIR target
  return lastWeekWeight
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  try {
    const {
      userId, weekNumber, programSlug, userProfile,
      recentLogs, oneRepMaxes, muscleGroupFeedback
    } = await request.json() as {
      userId: string
      weekNumber: number
      programSlug: string
      userProfile?: Record<string, unknown>
      recentLogs?: Array<{ exercise_name: string; weight: number; reps: number; rir_actual: number | null; completed: boolean; created_at: string }>
      oneRepMaxes?: Record<string, number>
      muscleGroupFeedback?: Array<{ week_number: number; muscle_group: string; volume_rating: string; pump_rating: string; pain_rating: string }>
    }

    if (!userId || !weekNumber || !programSlug) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const template = PROGRAM_TEMPLATES[programSlug] ?? PROGRAM_TEMPLATES['dad-strong-5']
    if (!template) {
      return NextResponse.json({ error: `Unknown program: ${programSlug}` }, { status: 400 })
    }

    const rms = oneRepMaxes ?? {}

    // ── Build log summary per exercise ──────────────────────────────────────
    type LogEntry = { exercise_name: string; weight: number; reps: number; rir_actual: number | null; completed: boolean; created_at: string }
    const logsByExercise: Record<string, LogEntry[]> = {}
    for (const log of (recentLogs || [])) {
      const key = log.exercise_name
      if (!logsByExercise[key]) logsByExercise[key] = []
      logsByExercise[key].push(log)
    }

    // Last session per exercise
    const exerciseSummaryLines: string[] = []
    const lastSessionByExercise: Record<string, { weight: number; reps: number; rir_actual: number | null }> = {}
    for (const [exercise, logs] of Object.entries(logsByExercise)) {
      const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastDate = sorted[0].created_at.split('T')[0]
      const lastSession = sorted.filter(l => l.created_at.startsWith(lastDate))
      // Store last set's data for weight recommendation
      const lastSet = lastSession[lastSession.length - 1]
      lastSessionByExercise[exercise] = { weight: lastSet.weight, reps: lastSet.reps, rir_actual: lastSet.rir_actual }
      const setLines = lastSession.map((s, i) =>
        `  Set ${i + 1}: ${s.weight}lbs × ${s.reps} reps, RIR=${s.rir_actual ?? 'not logged'}, completed=${s.completed}`
      ).join('\n')
      exerciseSummaryLines.push(`${exercise} (${lastDate}):\n${setLines}`)
    }

    // ── Muscle group feedback context ───────────────────────────────────────
    const feedbackLines: string[] = []
    const painByMuscle: Record<string, number> = {} // muscle → consecutive weeks with pain
    for (const fb of (muscleGroupFeedback || [])) {
      feedbackLines.push(
        `Week ${fb.week_number} — ${fb.muscle_group}: volume=${fb.volume_rating}, pump=${fb.pump_rating}, pain=${fb.pain_rating}`
      )
      if (fb.pain_rating !== 'none') {
        painByMuscle[fb.muscle_group] = (painByMuscle[fb.muscle_group] || 0) + 1
      }
    }
    const painFlags = Object.entries(painByMuscle)
      .filter(([, count]) => count >= 2)
      .map(([muscle]) => muscle)

    const hasHistory = exerciseSummaryLines.length > 0
    const logContext = hasHistory
      ? `RECENT TRAINING LOGS:\n${exerciseSummaryLines.join('\n\n')}`
      : `RECENT TRAINING LOGS: None — Week 1, user's first session.`

    const feedbackContext = feedbackLines.length > 0
      ? `MUSCLE GROUP FEEDBACK (from previous sessions):\n${feedbackLines.join('\n')}`
      : ''

    const painContext = painFlags.length > 0
      ? `PAIN FLAGS (2+ consecutive weeks): ${painFlags.join(', ')} — reduce volume and note to consider exercise swap`
      : ''

    const prompt = `
PROGRAM TEMPLATE:
${JSON.stringify(template, null, 2)}

USER PROFILE:
- Training age: ${userProfile?.trainingAge ?? 'intermediate'}
- Primary goal: ${userProfile?.primaryGoal ?? 'strength'}
- Equipment: ${userProfile?.equipment ? Object.entries(userProfile.equipment as Record<string,unknown>).filter(([, v]) => v).map(([k]) => k).join(', ') || 'standard gym' : 'standard gym'}

WEEK: ${weekNumber}

${logContext}

${feedbackContext}

${painContext}

Generate a complete week of programmed workouts for week ${weekNumber}.
`.trim()

    // ── Generate AI program ─────────────────────────────────────────────────
    const { object: aiProgram } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are an experienced strength coach programming for busy dads. Data-driven, direct, zero fluff.

CRITICAL: Do NOT prescribe specific weights. The system calculates recommended weights automatically.
Your job is to prescribe: exercise name, movementPattern, sets count, targetReps, and targetRir only.

PROGRAM CHARACTER:
- Dad Strong: strength + hypertrophy hybrid. Compound-first. Linear RIR progression.
- Hybrid: functional strength + GPP. For GPP movements (carries, sleds, conditioning): set targetRir to 0 and add note "load by feel, RPE 7-8".

PROGRESSION RULES:
Week 1 (no history): start all exercises at RIR 3-4. Rep ranges as per template. weekTheme = "Week 1 — Find Your Baseline".

Week 2+ per exercise:
- rir_actual was ABOVE target (felt easy): reduce targetRir by 1 next week (same reps, user will use same weight and work harder)
- rir_actual matched target: keep targetRir same; if they hit TOP of rep range → note it in progressionNote
- rir_actual was BELOW target (too hard): increase targetRir by 1
- rir_actual = 0 (true failure): server adds weight automatically; reset targetRir to 2 next week
- completed=false on any set: increase targetRir by 2 (back off)

Volume adjustments from muscle group feedback:
- volume="not_enough": add 1 working set to the primary compound for that muscle
- volume="too_much" or "bit_much": remove 1 set or increase targetRir by 1
- pump="good" or "skin_splitting" AND volume="about_right": reduce targetRir by 1 (capitalize on adaptation)
- pain="mild" once: no change, note it
- pain flag active (2+ weeks): reduce volume 1 set, increase targetRir by 1, add progressionNote "Consider exercise swap"

Deload week (last week of program OR early trigger): reduce sets by ~40%, increase all targetRir by 2-3.

OUTPUT:
- progressionNote: one sentence max referencing actual data. e.g. "RIR 4 last week vs target 3 — tightening to RIR 2."
- coachNote: 1-2 sentences, data-referenced, direct.
- weekTheme: short label, e.g. "Week 3 — Tightening the Vice"
- movementPattern: must match exactly from template data (e.g. push_horizontal, squat, hinge, isolation_bicep)
- Ensure every exercise from the template appears in each day.`,
      prompt,
      schema: z.object({
        weekNumber: z.number(),
        programName: z.string(),
        weekTheme: z.string(),
        coachNote: z.string(),
        days: z.array(z.object({
          dayNumber: z.number(),
          dayName: z.string(),
          exercises: z.array(z.object({
            name: z.string(),
            movementPattern: z.string().describe('Must match template movementPattern exactly'),
            sets: z.array(z.object({
              setNumber: z.number(),
              targetReps: z.number(),
              targetRir: z.number(),
              notes: z.string().optional(),
            })),
            progressionNote: z.string().optional(),
          })),
        })),
        deloadRecommended: z.boolean(),
        deloadReason: z.string().optional(),
        isCalibrationWeek: z.boolean(),
      }),
    })

    // ── Server-side: inject recommendedWeight per set ───────────────────────
    const programWithWeights = {
      ...aiProgram,
      days: aiProgram.days.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => {
          const lastData = lastSessionByExercise[ex.name] ?? null
          return {
            ...ex,
            sets: ex.sets.map(set => ({
              ...set,
              recommendedWeight: calcRecommendedWeight(
                ex.name,
                ex.movementPattern,
                set.targetReps,
                set.targetRir,
                lastData?.weight ?? null,
                lastData?.rir_actual ?? null,
                rms
              ),
            })),
          }
        }),
      })),
    }

    return NextResponse.json({ program: programWithWeights })
  } catch (error) {
    console.error('Program Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate program. Try again.' }, { status: 500 })
  }
}
