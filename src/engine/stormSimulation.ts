// src/engine/stormSimulation.ts
// Deterministic 72-hour lunar outpost physics & ECLSS mass/power balance engine.

import type {
  CrisisGameState,
  CrisisHourEnvironment,
  HourlyMassAndPowerFlows,
} from '../contracts/types';
import { CRISIS_CONSTANTS, CRISIS_TIMELINE_72H } from '../data/nasaCrisisData';

export type CrisisPreset = 'nominal_start' | 'hour15_spe_onset' | 'sabatier_bleed_trap';

const SOLAR_PEAK_KW = 32.0;
const BASE_AVIONICS_KW = 2.2;
const OGA_MAX_KW = 3.6;
const OGA_MAX_O2_KG_PER_HR = 0.18;
const OGA_MIN_WATER_LITERS = 20;
const HYDRO_IRRIGATION_FULL_LITERS = 200;
const LOW_HEAD_PRESSURE_LITERS = 140;
const LOW_HEAD_SCRUB_FACTOR = 0.65;
const SABATIER_HEATER_KW = 1.2;
const SABATIER_CO2_SCRUB_KG_PER_HR = 0.14;
const SABATIER_BLEED_L_PER_HR = 1.85;
const PYROLYSIS_TOTAL_KW = 3.8;
const PYROLYSIS_RESIDUAL_BLEED_L_PER_HR = 0.05;
const PSR_ICE_RECOVERY_L_PER_HR = 1.2;
const THERMAL_LOOP_MAX_KW = 4.5;
const LIOH_BACKUP_SCRUB_KG_PER_HR = 0.01;
const HULL_BASE_RADIATION_FACTOR = 0.62;
const SHELTER_CORE_RADIATION_FACTOR = 0.32;
const CO2_KG_TO_MMHG = 3.5;

export function computeHourlyFlows(
  state: CrisisGameState,
  env: CrisisHourEnvironment,
): HourlyMassAndPowerFlows {
  const { controls, crewCount } = state;
  const activeWater = Math.max(0, state.totalSystemWaterLiters - controls.shelterWallWaterLiters);

  // 1. Power generation & loads
  const solarGeneratedKw = SOLAR_PEAK_KW * env.solarIlluminationFactor;
  const ogaThrottle = Math.max(0, Math.min(1, controls.electrolysisThrottlePct / 100));
  const hydroThrottle = Math.max(0, Math.min(1, controls.hydroponicsThrottlePct / 100));
  const thermalThrottle = Math.max(0, Math.min(1, controls.thermalLoopPct / 100));

  const ogaKw = ogaThrottle * OGA_MAX_KW;
  const hydroKw = hydroThrottle * CRISIS_CONSTANTS.hydroponicsLedKw;
  const sabatierKw = controls.sabatierActive ? SABATIER_HEATER_KW : 0;
  const pyrolysisKw = controls.methanePyrolysisActive ? PYROLYSIS_TOTAL_KW : 0;
  const thermalKw = thermalThrottle * THERMAL_LOOP_MAX_KW;

  const totalLoadKw = BASE_AVIONICS_KW + ogaKw + hydroKw + sabatierKw + pyrolysisKw + thermalKw;
  const netBatteryKw = solarGeneratedKw - totalLoadKw;
  const hasPower = state.batteryKwh > 0 || solarGeneratedKw >= totalLoadKw;

  // 2. O2 & CO2 mass balance
  const lowHeadFactor = activeWater < LOW_HEAD_PRESSURE_LITERS ? LOW_HEAD_SCRUB_FACTOR : 1.0;
  const ogaWaterOk = activeWater >= OGA_MIN_WATER_LITERS;
  const ogaO2KgPerHr =
    hasPower && ogaWaterOk ? ogaThrottle * OGA_MAX_O2_KG_PER_HR * lowHeadFactor : 0;

  const hydroIrrigationFactor =
    activeWater >= HYDRO_IRRIGATION_FULL_LITERS
      ? 1.0
      : Math.max(0.1, (activeWater - 20) / 180);
  const effectiveHydroFactor = hasPower ? hydroThrottle * hydroIrrigationFactor : 0;

  const hydroO2KgPerHr = CRISIS_CONSTANTS.hydroponicsO2GenKgPerHr * effectiveHydroFactor;
  const o2GeneratedKgPerHr = ogaO2KgPerHr + hydroO2KgPerHr;
  const o2ConsumedKgPerHr = crewCount * CRISIS_CONSTANTS.o2KgPerCmHour;

  const co2ProducedKgPerHr = crewCount * CRISIS_CONSTANTS.co2KgPerCmHour;
  const sabatierCo2Scrub =
    controls.sabatierActive && hasPower ? SABATIER_CO2_SCRUB_KG_PER_HR * lowHeadFactor : 0;
  const hydroCo2Scrub = CRISIS_CONSTANTS.hydroponicsCo2ScrubKgPerHr * effectiveHydroFactor;
  const co2ScrubbedKgPerHr = sabatierCo2Scrub + hydroCo2Scrub + LIOH_BACKUP_SCRUB_KG_PER_HR;

  // 3. Water & Sabatier Hydrogen Bleed ("The Sabatier Trap")
  const ogaWaterConsumedLPerHr = ogaO2KgPerHr * CRISIS_CONSTANTS.electrolysisWaterLPerKgO2;
  const hydroWaterConsumedLPerHr =
    CRISIS_CONSTANTS.hydroponicsTranspirationLPerHr * effectiveHydroFactor;
  const hydroWaterRecoveredLPerHr =
    hydroWaterConsumedLPerHr * (CRISIS_CONSTANTS.hydroponicsCondensateReturnPct / 100);

  const crewWaterConsumedLPerHr = (crewCount * CRISIS_CONSTANTS.potableWaterKgPerCmDay) / 24;
  const crewWaterRecoveredLPerHr = crewWaterConsumedLPerHr * 0.95;

  let sabatierWaterBleedEquivLPerHr = 0;
  let psrIceRecoveryLPerHr = 0;

  if (controls.sabatierActive) {
    if (controls.methanePyrolysisActive && hasPower) {
      sabatierWaterBleedEquivLPerHr = PYROLYSIS_RESIDUAL_BLEED_L_PER_HR;
      psrIceRecoveryLPerHr = PSR_ICE_RECOVERY_L_PER_HR;
    } else {
      sabatierWaterBleedEquivLPerHr = SABATIER_BLEED_L_PER_HR;
    }
  } else if (controls.methanePyrolysisActive && hasPower) {
    psrIceRecoveryLPerHr = PSR_ICE_RECOVERY_L_PER_HR;
  }

  const waterConsumedLPerHr =
    ogaWaterConsumedLPerHr + hydroWaterConsumedLPerHr + crewWaterConsumedLPerHr;
  const waterRecoveredLPerHr =
    hydroWaterRecoveredLPerHr + crewWaterRecoveredLPerHr + psrIceRecoveryLPerHr;

  // 4. Radiation attenuation (CRaTER / OLTARIS Water-Wall curve)
  const waterWallArealDensityGPerCm2 =
    (controls.shelterWallWaterLiters / CRISIS_CONSTANTS.shelterWaterJacketMaxLiters) *
    CRISIS_CONSTANTS.shelterMaxArealDensityGPerCm2;
  const shelterCoreFactor = controls.crewInStormShelter ? SHELTER_CORE_RADIATION_FACTOR : 1.0;
  const shieldedDoseRateMsvPerHr =
    env.unshieldedDoseRateMsvPerHr *
    HULL_BASE_RADIATION_FACTOR *
    shelterCoreFactor *
    Math.exp(-CRISIS_CONSTANTS.shieldingAttenuationCoeff * waterWallArealDensityGPerCm2);

  const shieldAttenuationPct =
    env.unshieldedDoseRateMsvPerHr > 0
      ? Math.max(
          0,
          Math.min(99.9, (1 - shieldedDoseRateMsvPerHr / env.unshieldedDoseRateMsvPerHr) * 100),
        )
      : 0;

  // 5. Food balance
  const foodProducedKcalPerHr = CRISIS_CONSTANTS.hydroponicsFoodKcalPerHr * effectiveHydroFactor;
  const foodConsumedKcalPerHr = crewCount * CRISIS_CONSTANTS.kcalPerCmHour;

  return {
    solarGeneratedKw,
    totalLoadKw,
    netBatteryKw,
    o2GeneratedKgPerHr,
    o2ConsumedKgPerHr,
    co2ProducedKgPerHr,
    co2ScrubbedKgPerHr,
    waterConsumedLPerHr,
    waterRecoveredLPerHr,
    sabatierWaterBleedEquivLPerHr,
    shieldedDoseRateMsvPerHr,
    shieldAttenuationPct,
    waterWallArealDensityGPerCm2,
    foodProducedKcalPerHr,
    foodConsumedKcalPerHr,
  };
}

export function createInitialCrisisState(): CrisisGameState {
  const controls = {
    shelterWallWaterLiters: 70,
    electrolysisThrottlePct: 75,
    sabatierActive: true,
    methanePyrolysisActive: false,
    hydroponicsThrottlePct: 80,
    thermalLoopPct: 60,
    crewInStormShelter: false,
  };

  const totalSystemWaterLiters = 520;
  const baseState: CrisisGameState = {
    hour: 0,
    maxHours: 72,
    crewCount: CRISIS_CONSTANTS.crewCount,
    batteryKwh: 155,
    maxBatteryKwh: CRISIS_CONSTANTS.maxBatteryKwh,
    totalSystemWaterLiters,
    activeTankWaterLiters: totalSystemWaterLiters - controls.shelterWallWaterLiters,
    cabinO2Kg: 18.0,
    cabinCo2MmHg: 1.8,
    cumulativeRadiationMsv: 0.2,
    foodBufferKcal: 18000,
    cropHealthPct: 100,
    cabinTempC: 21.5,
    cumulativeWaterBleedLiters: 0,
    controls,
    lastFlows: {} as HourlyMassAndPowerFlows,
    eventLog: [
      {
        hour: 0,
        message: CRISIS_TIMELINE_72H[0].eventHeadline,
        severity: 'info',
      },
    ],
    status: 'running',
  };

  baseState.lastFlows = computeHourlyFlows(baseState, CRISIS_TIMELINE_72H[0]);
  return baseState;
}

export function advanceCrisisHour(state: CrisisGameState): CrisisGameState {
  if (state.status !== 'running') {
    return state;
  }

  const env =
    CRISIS_TIMELINE_72H[state.hour] ?? CRISIS_TIMELINE_72H[CRISIS_TIMELINE_72H.length - 1];
  const flows = computeHourlyFlows(state, env);
  const nextHour = Math.min(state.maxHours, state.hour + 1);

  const batteryKwh = Math.max(
    0,
    Math.min(state.maxBatteryKwh, state.batteryKwh + flows.netBatteryKw),
  );

  const totalSystemWaterLiters = Math.max(
    0,
    state.totalSystemWaterLiters +
      flows.waterRecoveredLPerHr -
      flows.waterConsumedLPerHr -
      flows.sabatierWaterBleedEquivLPerHr,
  );
  const activeTankWaterLiters = Math.max(
    0,
    totalSystemWaterLiters - state.controls.shelterWallWaterLiters,
  );
  const cumulativeWaterBleedLiters =
    state.cumulativeWaterBleedLiters + flows.sabatierWaterBleedEquivLPerHr;

  const cabinO2Kg = Math.max(
    0,
    state.cabinO2Kg + flows.o2GeneratedKgPerHr - flows.o2ConsumedKgPerHr,
  );
  const netCo2Kg = flows.co2ProducedKgPerHr - flows.co2ScrubbedKgPerHr;
  const cabinCo2MmHg = Math.max(0.4, state.cabinCo2MmHg + netCo2Kg * CO2_KG_TO_MMHG);
  const cumulativeRadiationMsv = state.cumulativeRadiationMsv + flows.shieldedDoseRateMsvPerHr;
  const foodBufferKcal = Math.max(
    0,
    state.foodBufferKcal + flows.foodProducedKcalPerHr - flows.foodConsumedKcalPerHr,
  );

  const cropsStressed =
    (activeTankWaterLiters < HYDRO_IRRIGATION_FULL_LITERS &&
      state.controls.hydroponicsThrottlePct > 0) ||
    activeTankWaterLiters < 40 ||
    state.controls.hydroponicsThrottlePct < 25;
  const cropHealthPct = cropsStressed
    ? Math.max(0, state.cropHealthPct - 2.5)
    : Math.min(100, state.cropHealthPct + 1.0);

  const ambientLossC = env.surfaceTempK < 100 ? 2.8 : 1.6;
  const thermalGainC = (state.controls.thermalLoopPct / 100) * 4.2 + 0.35;
  const cabinTempC = state.cabinTempC + (thermalGainC - ambientLossC) * 0.4;

  let status: CrisisGameState['status'] = 'running';
  let failureReason: string | undefined;
  let failureCitationId: CrisisGameState['failureCitationId'];

  if (cumulativeRadiationMsv >= CRISIS_CONSTANTS.radiationAbortMsv) {
    status = 'failed';
    failureCitationId = 'nasa_std_3001';
    failureReason = `Cumulative crew BFO dose (${cumulativeRadiationMsv.toFixed(1)} mSv) exceeded NASA-STD-3001 75 mSv mission abort threshold.`;
  } else if (cabinCo2MmHg >= CRISIS_CONSTANTS.co2AcuteToxicityMmHg) {
    status = 'failed';
    failureCitationId = 'nasa_std_3001';
    failureReason = `Cabin CO2 (${cabinCo2MmHg.toFixed(1)} mmHg) exceeded NASA-STD-3001 7.5 mmHg acute toxicity limit.`;
  } else if (cabinO2Kg <= 0.5) {
    status = 'failed';
    failureCitationId = 'bvad_metabolism';
    failureReason = `Cabin O2 reserve (${cabinO2Kg.toFixed(2)} kg) depleted below 0.5 kg critical life-support floor.`;
  } else if (cabinTempC <= 5 || cabinTempC >= 38) {
    status = 'failed';
    failureCitationId = 'nasa_std_3001';
    failureReason = `Cabin temperature (${cabinTempC.toFixed(1)}°C) breached survivable thermal envelope (5°C - 38°C).`;
  } else if (nextHour >= state.maxHours) {
    status = 'survived';
  }

  const nextEnv = CRISIS_TIMELINE_72H[nextHour] ?? env;
  const eventLog = [...state.eventLog];

  if (status === 'failed' && failureReason) {
    eventLog.push({ hour: nextHour, message: failureReason, severity: 'danger' });
  } else if (status === 'survived') {
    eventLog.push({
      hour: nextHour,
      message: '72-hour solar particle event & eclipse survived. Shackleton Ridge sun restored.',
      severity: 'info',
    });
  } else if (nextEnv.phaseLabel !== env.phaseLabel) {
    const severity =
      nextEnv.alertLevel === 'critical'
        ? 'danger'
        : nextEnv.alertLevel === 'warning'
          ? 'warn'
          : 'info';
    eventLog.push({ hour: nextHour, message: nextEnv.eventHeadline, severity });
  }

  const boundedLog = eventLog.slice(-30);

  return {
    ...state,
    hour: nextHour,
    batteryKwh,
    totalSystemWaterLiters,
    activeTankWaterLiters,
    cabinO2Kg,
    cabinCo2MmHg,
    cumulativeRadiationMsv,
    foodBufferKcal,
    cropHealthPct,
    cabinTempC,
    cumulativeWaterBleedLiters,
    lastFlows: flows,
    eventLog: boundedLog,
    status,
    failureReason,
    failureCitationId,
  };
}

export function createCrisisPresetState(preset: CrisisPreset): CrisisGameState {
  const base = createInitialCrisisState();
  if (preset === 'nominal_start') {
    return base;
  }

  if (preset === 'hour15_spe_onset') {
    const hour = 15;
    const env = CRISIS_TIMELINE_72H[hour];
    const next: CrisisGameState = {
      ...base,
      hour,
      batteryKwh: 142,
      cumulativeRadiationMsv: 1.4,
      status: 'running',
      eventLog: [
        {
          hour,
          message: env.eventHeadline,
          severity: 'danger',
        },
      ],
    };
    next.lastFlows = computeHourlyFlows(next, env);
    return next;
  }

  // 'sabatier_bleed_trap'
  const hour = 18;
  const env = CRISIS_TIMELINE_72H[hour];
  const controls = {
    ...base.controls,
    shelterWallWaterLiters: 380,
    sabatierActive: true,
    methanePyrolysisActive: false,
    crewInStormShelter: true,
  };
  const totalSystemWaterLiters = 480;
  const next: CrisisGameState = {
    ...base,
    hour,
    batteryKwh: 120,
    totalSystemWaterLiters,
    activeTankWaterLiters: totalSystemWaterLiters - controls.shelterWallWaterLiters,
    cumulativeRadiationMsv: 3.2,
    cumulativeWaterBleedLiters: 33.3,
    controls,
    status: 'running',
    eventLog: [
      {
        hour,
        message:
          'Sabatier CH4 venting is bleeding 1.85 L/hr water-equivalent H2! Engage Methane Pyrolysis to close the loop.',
        severity: 'warn',
      },
    ],
  };
  next.lastFlows = computeHourlyFlows(next, env);
  return next;
}
