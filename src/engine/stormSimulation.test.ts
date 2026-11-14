import { describe, expect, it } from 'vitest';
import { CRISIS_TIMELINE_72H } from '../data/nasaCrisisData';
import {
  advanceCrisisHour,
  computeHourlyFlows,
  createCrisisPresetState,
  createInitialCrisisState,
} from './stormSimulation';

describe('stormSimulation physics & ECLSS mass balance', () => {
  it('1. conserves initial water inventory between active tank and storm shelter jacket', () => {
    const state = createInitialCrisisState();
    expect(state.activeTankWaterLiters + state.controls.shelterWallWaterLiters).toBe(
      state.totalSystemWaterLiters,
    );
    expect(state.totalSystemWaterLiters).toBe(520);
    expect(state.controls.shelterWallWaterLiters).toBe(70);
    expect(state.activeTankWaterLiters).toBe(450);
  });

  it('2. pumping 450 L into Storm Shelter + crewInStormShelter cuts Hour 22 SPE peak dose by >90%', () => {
    const base = createInitialCrisisState();
    const hour22Env = CRISIS_TIMELINE_72H[22];

    const unshieldedFlows = computeHourlyFlows(base, hour22Env);

    const shelteredState = {
      ...base,
      activeTankWaterLiters: base.totalSystemWaterLiters - 450,
      controls: {
        ...base.controls,
        shelterWallWaterLiters: 450,
        crewInStormShelter: true,
      },
    };
    const shelteredFlows = computeHourlyFlows(shelteredState, hour22Env);

    const reductionFraction =
      (hour22Env.unshieldedDoseRateMsvPerHr - shelteredFlows.shieldedDoseRateMsvPerHr) /
      hour22Env.unshieldedDoseRateMsvPerHr;

    expect(unshieldedFlows.shieldedDoseRateMsvPerHr).toBeGreaterThan(50);
    expect(reductionFraction).toBeGreaterThan(0.9);
    expect(shelteredFlows.shieldAttenuationPct).toBeGreaterThan(95);
    expect(shelteredFlows.shieldedDoseRateMsvPerHr).toBeLessThan(4.0);
  });

  it('3. pumping 450 L into Storm Shelter starves active tank (70 L < 200 L), throttles hydroponics & raises CO2', () => {
    const base = createInitialCrisisState();
    const env = CRISIS_TIMELINE_72H[0];

    const fullTankFlows = computeHourlyFlows(base, env);

    const starvedState = {
      ...base,
      activeTankWaterLiters: base.totalSystemWaterLiters - 450,
      controls: {
        ...base.controls,
        shelterWallWaterLiters: 450,
      },
    };
    const starvedFlows = computeHourlyFlows(starvedState, env);

    expect(starvedState.totalSystemWaterLiters - starvedState.controls.shelterWallWaterLiters).toBe(
      70,
    );
    expect(starvedFlows.foodProducedKcalPerHr).toBeLessThan(fullTankFlows.foodProducedKcalPerHr * 0.35);
    expect(starvedFlows.co2ScrubbedKgPerHr).toBeLessThan(starvedFlows.co2ProducedKgPerHr);
    expect(starvedFlows.o2GeneratedKgPerHr).toBeLessThan(fullTankFlows.o2GeneratedKgPerHr);

    const afterHour = advanceCrisisHour(starvedState);
    expect(afterHour.cropHealthPct).toBeLessThan(base.cropHealthPct);
    expect(afterHour.cabinCo2MmHg).toBeGreaterThan(base.cabinCo2MmHg);
  });

  it('4. Sabatier without Methane Pyrolysis bleeds water mass; activating Pyrolysis stops the bleed', () => {
    const base = createInitialCrisisState();
    const env = CRISIS_TIMELINE_72H[0];

    const bleedingFlows = computeHourlyFlows(base, env);
    expect(bleedingFlows.sabatierWaterBleedEquivLPerHr).toBeGreaterThan(1.5);

    const afterOneHour = advanceCrisisHour(base);
    expect(afterOneHour.cumulativeWaterBleedLiters).toBeGreaterThan(1.5);
    expect(afterOneHour.totalSystemWaterLiters).toBeLessThan(base.totalSystemWaterLiters);

    const closedLoopState = {
      ...base,
      controls: {
        ...base.controls,
        methanePyrolysisActive: true,
      },
    };
    const closedFlows = computeHourlyFlows(closedLoopState, env);
    expect(closedFlows.sabatierWaterBleedEquivLPerHr).toBeLessThan(0.1);
  });

  it('5. Shackleton Ridge Eclipse (Hours 15-38) drops solar < 3 kW, draining battery unless LED hydroponics are throttled', () => {
    const base = createInitialCrisisState();
    const hour15Env = CRISIS_TIMELINE_72H[15];

    const highHydroState = {
      ...base,
      hour: 15,
      controls: {
        ...base.controls,
        hydroponicsThrottlePct: 100,
      },
    };
    const highHydroFlows = computeHourlyFlows(highHydroState, hour15Env);
    expect(highHydroFlows.solarGeneratedKw).toBeLessThan(3);
    expect(highHydroFlows.netBatteryKw).toBeLessThan(-15);

    const throttledState = {
      ...highHydroState,
      controls: {
        ...highHydroState.controls,
        hydroponicsThrottlePct: 0,
      },
    };
    const throttledFlows = computeHourlyFlows(throttledState, hour15Env);
    expect(throttledFlows.totalLoadKw).toBeLessThan(highHydroFlows.totalLoadKw);
    expect(throttledFlows.netBatteryKw).toBeGreaterThan(highHydroFlows.netBatteryKw);
  });

  it('6. hour15_spe_onset judge preset initializes cleanly at Hour 15 in running status', () => {
    const preset = createCrisisPresetState('hour15_spe_onset');
    expect(preset.hour).toBe(15);
    expect(preset.status).toBe('running');
    expect(preset.lastFlows.solarGeneratedKw).toBeLessThan(3);
    expect(preset.lastFlows.shieldedDoseRateMsvPerHr).toBeGreaterThan(0);
  });
});
