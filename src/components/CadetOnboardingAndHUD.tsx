// src/components/CadetOnboardingAndHUD.tsx
// Apollo-era matte hardware look: Cadet Mode HUD, onboarding tutorial, 4 checkpoints, rule-based guidance.

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Droplets,
  HelpCircle,
  Shield,
  Star,
  Wind,
} from 'lucide-react';
import type {
  CameraStationId,
  CrisisGameState,
  CrisisHourEnvironment,
  ValveAndBreakerControls,
} from '../contracts/types';
import enStrings from '../i18n/en.json';
import * as CockpitAudio from '../three/CockpitAudioAndTextures';

export type TutorialStage = 'welcome' | 'step1' | 'step2' | 'step3' | 'done';

export interface CheckpointResult {
  earnedCount: number;
  completed: boolean[];
  activeIndex: number;
}

export interface WhatNowGuidance {
  hint: string;
  actionLabel?: string;
  controlPatch?: Partial<ValveAndBreakerControls>;
  station?: CameraStationId;
}

function safePlaySound(kind: 'toggle_switch' | 'valve_turn' | 'switch_toggle'): void {
  try {
    const fn = (CockpitAudio as Record<string, unknown>).playCockpitSound;
    if (typeof fn === 'function') {
      (fn as (k: string) => void)(kind === 'switch_toggle' ? 'toggle_switch' : kind);
    }
  } catch {
    // Audio operation safe in restricted/headless contexts
  }
}

/** Four mission checkpoints, evaluated from the live simulation state. */
export function computeCheckpointProgress(state: CrisisGameState): CheckpointResult {
  const cp1 = state.controls.methanePyrolysisActive === true;

  const cp2 =
    (state.hour >= 14 &&
      state.controls.shelterWallWaterLiters >= 350 &&
      state.controls.crewInStormShelter) ||
    (state.hour > 28 && state.cumulativeRadiationMsv < 35);

  const cp3 =
    (state.hour >= 15 && state.controls.hydroponicsThrottlePct <= 50 && state.controls.sabatierActive) ||
    (state.hour > 38 && state.batteryKwh >= 30 && state.cabinCo2MmHg < 4.5);

  const cp4 = (state.hour >= 39 && state.activeTankWaterLiters >= 200) || state.status === 'survived';

  const completed = [cp1, cp2, cp3, cp4];
  const earnedCount = completed.filter(Boolean).length;

  const activeIndex =
    state.hour < 15 ? 0 : state.hour <= 28 ? 1 : state.hour <= 38 ? 2 : 3;

  return { earnedCount, completed, activeIndex };
}

/** Highest-priority rule-based recommendation for the "What now?" strip. */
export function computeWhatNowHint(
  state: CrisisGameState,
  env: CrisisHourEnvironment,
): WhatNowGuidance {
  // 1. Solar storm radiation emergency
  if (
    env.unshieldedDoseRateMsvPerHr >= 15 &&
    (!state.controls.crewInStormShelter || state.controls.shelterWallWaterLiters < 350)
  ) {
    return {
      hint: enStrings.hints.radEmergency,
      actionLabel: enStrings.views.doMoveBtn,
      controlPatch: { shelterWallWaterLiters: 450, crewInStormShelter: true },
      station: 'station_3_valves',
    };
  }

  // 2. Water bleed from Sabatier H2/water venting
  if (!state.controls.methanePyrolysisActive) {
    return {
      hint: enStrings.hints.waterBleed,
      actionLabel: enStrings.actions.leakStopOn,
      controlPatch: { methanePyrolysisActive: true },
      station: 'station_3_valves',
    };
  }

  // 3. Cabin CO2 rising
  if (!state.controls.sabatierActive || state.cabinCo2MmHg >= 3.5) {
    return {
      hint: enStrings.hints.co2Warning,
      actionLabel: enStrings.actions.airBoostOn,
      controlPatch: { sabatierActive: true },
      station: 'station_2_breakers',
    };
  }

  // 4. Eclipse battery drain from grow lights
  if (env.solarIlluminationFactor < 0.25 && state.controls.hydroponicsThrottlePct > 50) {
    return {
      hint: enStrings.hints.eclipseDrain,
      actionLabel: enStrings.actions.lights25,
      controlPatch: { hydroponicsThrottlePct: 25 },
      station: 'station_2_breakers',
    };
  }

  // 5. Storm over, active tank starved
  if (env.unshieldedDoseRateMsvPerHr < 10 && state.hour >= 38 && state.activeTankWaterLiters < 200) {
    return {
      hint: enStrings.hints.postStormRefill,
      actionLabel: enStrings.actions.shield70,
      controlPatch: { shelterWallWaterLiters: 70, crewInStormShelter: false },
      station: 'station_3_valves',
    };
  }

  return { hint: enStrings.hints.steady };
}

/** Plain-language end-of-mission debrief bullets. */
export function computeDebriefSummary(
  state: CrisisGameState,
  minBatteryKwh: number,
): { worked: string[]; failed: string[]; stars: number } {
  const worked: string[] = [];
  const failed: string[] = [];

  const pick = (ok: boolean, passText: string, failText: string) =>
    ok ? worked.push(passText) : failed.push(failText);

  pick(state.cumulativeWaterBleedLiters <= 25, enStrings.debrief.workedLeak, enStrings.debrief.failedLeak);
  pick(state.cumulativeRadiationMsv <= 35, enStrings.debrief.workedShield, enStrings.debrief.failedRad);
  pick(minBatteryKwh >= 25, enStrings.debrief.workedBattery, enStrings.debrief.failedBattery);
  pick(state.cabinCo2MmHg <= 4.0, enStrings.debrief.workedAir, enStrings.debrief.failedAir);
  pick(
    state.cropHealthPct >= 50 && state.activeTankWaterLiters >= 200,
    enStrings.debrief.workedPlants,
    enStrings.debrief.failedWater,
  );

  const { earnedCount } = computeCheckpointProgress(state);
  return { worked, failed, stars: earnedCount };
}

const FACE_STYLES = {
  good: { color: 'text-[#34D399]', border: 'border-[#34D399]/60' },
  warn: { color: 'text-[#F59E0B]', border: 'border-[#F59E0B]/60' },
  bad: { color: 'text-[#EF4444]', border: 'border-[#EF4444]/60' },
} as const;

type FaceKey = keyof typeof FACE_STYLES;

function faceFor(key: FaceKey) {
  const faceText =
    key === 'good' ? enStrings.meters.faces.good : key === 'warn' ? enStrings.meters.faces.warn : enStrings.meters.faces.bad;
  return { text: faceText, ...FACE_STYLES[key] };
}

const TAP_BTN =
  'min-h-[30px] w-full px-2 py-1 rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] text-left font-sans text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors active:translate-y-px pointer-events-auto';

/**
 * 1. CadetMissionStrip
 * Super sleek ~56px Apollo strip for Row 2 of the Flight Controller Top Bar.
 */
export const CadetMissionStrip: React.FC<{
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onSelectStation: (station: CameraStationId) => void;
}> = ({ state, env, onUpdateControls, onSelectStation }) => {
  const [hintOpen, setHintOpen] = useState<boolean>(true);

  const checkpoints = useMemo(() => computeCheckpointProgress(state), [state]);
  const guidance = useMemo(() => computeWhatNowHint(state, env), [state, env]);
  const activeGoal = enStrings.checkpoints[checkpoints.activeIndex];
  const progressPct = Math.min(100, Math.max(0, (state.hour / 72) * 100));

  const handleExecuteGuidance = () => {
    safePlaySound(guidance.station === 'station_3_valves' ? 'valve_turn' : 'toggle_switch');
    if (guidance.controlPatch) onUpdateControls(guidance.controlPatch);
    if (guidance.station) onSelectStation(guidance.station);
  };

  return (
    <div className="w-full bg-[#111419] border-t border-[#1E232B] pt-1.5 flex flex-col gap-1.5 select-none font-sans">
      {/* Line 1: Mission Checkpoints + Progress + What Now toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Goals Title & Stars */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-sans font-semibold text-xs text-[#F59E0B] tracking-wider uppercase">
            {enStrings.views.missionGoalsTitle}
          </span>
          <span className="font-mono text-[10px] text-[#9CA3AF] tabular-nums">
            ({checkpoints.earnedCount}/4 {enStrings.views.starsLabel})
          </span>
        </div>

        {/* Center: 4 Horizontal Segmented Checkpoint Pills + 2px 72h Progress Bar */}
        <div className="flex-1 min-w-[280px] flex flex-col gap-1">
          <div className="grid grid-cols-4 gap-1.5">
            {enStrings.checkpoints.map((cp, idx) => {
              const isEarned = checkpoints.completed[idx];
              const isActive = idx === checkpoints.activeIndex;
              return (
                <div
                  key={cp.id}
                  className={`px-2 py-1 rounded-[2px] border flex items-center justify-between gap-1 min-w-0 transition-colors ${
                    isActive ? 'border-[#F59E0B] bg-[#1E232B]' : 'border-[#252A32] bg-[#14171C]'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-[10px] text-[#9CA3AF] leading-none">{cp.hours}</span>
                    <span
                      className="font-sans text-[11px] font-medium text-[#F4F4F0] truncate leading-tight mt-0.5"
                      title={cp.title}
                    >
                      {cp.title}
                    </span>
                  </div>
                  <Star
                    className={`h-3 w-3 shrink-0 ${
                      isEarned ? 'fill-[#F59E0B] text-[#F59E0B]' : 'fill-transparent text-[#4B5563]'
                    }`}
                  />
                </div>
              );
            })}
          </div>
          {/* Thin 2px 72h progress bar underneath */}
          <div className="w-full bg-[#1E232B] h-[2px] rounded-full overflow-hidden">
            <div
              className="bg-[#F59E0B] h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Right: What now? pill button */}
        <button
          type="button"
          onClick={() => setHintOpen((prev) => !prev)}
          className="min-h-[30px] px-2.5 py-1 rounded-[2px] border border-[#F59E0B]/80 bg-[#1E232B] hover:bg-[#2A303A] text-[#F59E0B] font-sans text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors active:translate-y-px shrink-0"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{enStrings.views.whatNowBtn}</span>
          {hintOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Line 2: Active goal + Collapsible 1-line hint banner */}
      {hintOpen && (
        <div className="border border-[#F59E0B]/60 bg-[#14171C] px-2.5 py-1.5 rounded-[2px] flex items-center justify-between gap-2.5 text-xs text-[#F4F4F0]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Compass className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
            {activeGoal && (
              <span className="font-mono text-[10px] text-[#F59E0B] uppercase font-bold shrink-0 hidden sm:inline">
                [GOAL: {activeGoal.title}]:
              </span>
            )}
            <span className="font-sans text-xs text-[#E5E7EB] truncate">
              {guidance.hint}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {guidance.controlPatch && (
              <button
                type="button"
                onClick={handleExecuteGuidance}
                className="min-h-[28px] px-2.5 py-0.5 rounded-[2px] border border-[#34D399] bg-[#1E232B] hover:bg-[#2A303A] text-[#34D399] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors active:translate-y-px"
              >
                <Check className="h-3 w-3" />
                <span>{guidance.actionLabel ?? enStrings.views.doMoveBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setHintOpen(false)}
              className="min-h-[28px] px-2 py-0.5 rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] text-[#9CA3AF] hover:text-[#F4F4F0] font-sans text-[11px] cursor-pointer transition-colors"
            >
              {enStrings.views.hideHintBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 2. CadetMetersDock
 * Sits at the bottom of the screen right above the Bottom Navigation Strip.
 * Low-profile Apollo matte modules for Power, Air, Water & Plants, Radiation Shield.
 */
export const CadetMetersDock: React.FC<{
  state: CrisisGameState;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onSelectStation: (station: CameraStationId) => void;
  highlightTradeOff?: boolean;
}> = ({ state, onUpdateControls, onSelectStation, highlightTradeOff }) => {
  const { controls } = state;
  const lightsDimmed = controls.hydroponicsThrottlePct <= 25;
  const shieldUp = controls.shelterWallWaterLiters >= 350;

  const powerFace = faceFor(state.batteryKwh >= 60 ? 'good' : state.batteryKwh >= 30 ? 'warn' : 'bad');
  const airFace = faceFor(
    state.cabinCo2MmHg < 3.5 ? 'good' : state.cabinCo2MmHg < 4.5 ? 'warn' : 'bad',
  );
  const waterFace = faceFor(
    state.activeTankWaterLiters >= 200 && state.cropHealthPct >= 75
      ? 'good'
      : state.activeTankWaterLiters >= 100 && state.cropHealthPct >= 40
        ? 'warn'
        : 'bad',
  );
  const shieldFace = faceFor(
    state.lastFlows.shieldedDoseRateMsvPerHr < 2.0 && state.cumulativeRadiationMsv < 35
      ? 'good'
      : state.lastFlows.shieldedDoseRateMsvPerHr < 10.0 && state.cumulativeRadiationMsv < 55
        ? 'warn'
        : 'bad',
  );

  const waterCardBorder = highlightTradeOff
    ? 'border-[#F59E0B] ring-1 ring-[#F59E0B]/70 shadow-lg'
    : waterFace.border;

  const shieldCardBorder = highlightTradeOff
    ? 'border-[#F59E0B] ring-1 ring-[#F59E0B]/70 shadow-lg'
    : shieldFace.border;

  return (
    <div className="w-full px-3 pb-2 pointer-events-none select-none font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-2 pointer-events-auto">
        {/* Module 1: Power (Battery) */}
        <div className={`bg-[#14171C]/95 border ${powerFace.border} p-2.5 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <BatteryCharging className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                <span className="font-sans text-xs font-bold text-[#F4F4F0] truncate">
                  {enStrings.meters.power.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    safePlaySound('toggle_switch');
                    onSelectStation('station_2_breakers');
                  }}
                  className="font-mono text-[10px] font-bold text-[#9CA3AF] hover:text-[#F59E0B] bg-[#1E232B] hover:bg-[#282F3A] border border-[#3B4252] px-1 py-0.5 rounded-[2px] cursor-pointer transition-colors leading-none"
                  title="Jump 3D camera to [2] Panel 11 Breakers"
                >
                  [2]
                </button>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-bold leading-none bg-[#14171C] ${powerFace.border} ${powerFace.color} shrink-0`}
              >
                {powerFace.text}
              </span>
            </div>
            <div className="my-0.5 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-sm font-bold text-[#F4F4F0]">
                {state.batteryKwh.toFixed(1)} kWh
              </span>
              <span className="font-sans text-[11px] text-[#9CA3AF]">
                ({((state.batteryKwh / state.maxBatteryKwh) * 100).toFixed(0)}%)
              </span>
            </div>
            {/* Thin 3px level gauge bar */}
            <div className="w-full bg-[#1E232B] h-[3px] rounded-full overflow-hidden my-1.5">
              <div
                className={`h-full transition-all duration-300 ${
                  state.batteryKwh >= 60 ? 'bg-[#34D399]' : state.batteryKwh >= 30 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (state.batteryKwh / state.maxBatteryKwh) * 100))}%` }}
              />
            </div>
            <p className="font-sans text-[11px] text-[#9CA3AF] truncate mb-2" title={enStrings.meters.power.jargon}>
              {enStrings.meters.power.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              safePlaySound('toggle_switch');
              onUpdateControls({ hydroponicsThrottlePct: lightsDimmed ? 100 : 25 });
            }}
            className={`${TAP_BTN} ${lightsDimmed ? 'text-[#F59E0B]' : 'text-[#34D399]'}`}
          >
            <span className="truncate pr-1">
              {lightsDimmed ? enStrings.actions.lightsState25 : enStrings.actions.lightsState100}
            </span>
            <span className={`h-2 w-2 rounded-full shrink-0 ${lightsDimmed ? 'bg-[#F59E0B]' : 'bg-[#34D399]'}`} />
          </button>
        </div>

        {/* Module 2: Air (O2 & CO2) */}
        <div className={`bg-[#14171C]/95 border ${airFace.border} p-2.5 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Wind className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                <span className="font-sans text-xs font-bold text-[#F4F4F0] truncate">
                  {enStrings.meters.air.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    safePlaySound('toggle_switch');
                    onSelectStation('station_2_breakers');
                  }}
                  className="font-mono text-[10px] font-bold text-[#9CA3AF] hover:text-[#F59E0B] bg-[#1E232B] hover:bg-[#282F3A] border border-[#3B4252] px-1 py-0.5 rounded-[2px] cursor-pointer transition-colors leading-none"
                  title="Jump 3D camera to [2] Panel 11 Breakers"
                >
                  [2]
                </button>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-bold leading-none bg-[#14171C] ${airFace.border} ${airFace.color} shrink-0`}
              >
                {airFace.text}
              </span>
            </div>
            <div className="my-0.5 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-sm font-bold text-[#F4F4F0]">
                {state.cabinCo2MmHg.toFixed(2)} mmHg
              </span>
              <span className="font-sans text-[11px] text-[#9CA3AF]">
                CO2 | {state.cabinO2Kg.toFixed(1)} kg O2
              </span>
            </div>
            {/* Thin 3px level gauge bar (CO2 safe headroom) */}
            <div className="w-full bg-[#1E232B] h-[3px] rounded-full overflow-hidden my-1.5">
              <div
                className={`h-full transition-all duration-300 ${
                  state.cabinCo2MmHg < 3.5 ? 'bg-[#34D399]' : state.cabinCo2MmHg < 4.5 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(0, ((5.0 - state.cabinCo2MmHg) / 3.0) * 100))}%`,
                }}
              />
            </div>
            <p className="font-sans text-[11px] text-[#9CA3AF] truncate mb-2" title={enStrings.meters.air.jargon}>
              {enStrings.meters.air.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              safePlaySound('toggle_switch');
              onUpdateControls({ sabatierActive: !controls.sabatierActive });
            }}
            className={`${TAP_BTN} ${controls.sabatierActive ? 'text-[#34D399]' : 'text-[#EF4444]'}`}
          >
            <span className="truncate pr-1">
              {controls.sabatierActive ? enStrings.actions.airStateOn : enStrings.actions.airStateOff}
            </span>
            <span className={`h-2 w-2 rounded-full shrink-0 ${controls.sabatierActive ? 'bg-[#34D399]' : 'bg-[#EF4444]'}`} />
          </button>
        </div>

        {/* Module 3: Water & Plants */}
        <div className={`bg-[#14171C]/95 border ${waterCardBorder} p-2.5 rounded-[2px] flex flex-col justify-between transition-all`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Droplets className="h-3.5 w-3.5 text-[#34D399] shrink-0" />
                <span className="font-sans text-xs font-bold text-[#F4F4F0] truncate">
                  {enStrings.meters.waterFood.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    safePlaySound('valve_turn');
                    onSelectStation('station_3_valves');
                  }}
                  className="font-mono text-[10px] font-bold text-[#9CA3AF] hover:text-[#F59E0B] bg-[#1E232B] hover:bg-[#282F3A] border border-[#3B4252] px-1 py-0.5 rounded-[2px] cursor-pointer transition-colors leading-none"
                  title="Jump 3D camera to [3] Panel 16 Valves"
                >
                  [3]
                </button>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-bold leading-none bg-[#14171C] ${waterFace.border} ${waterFace.color} shrink-0`}
              >
                {waterFace.text}
              </span>
            </div>
            <div className="my-0.5 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-sm font-bold text-[#F4F4F0]">
                {state.activeTankWaterLiters.toFixed(0)} L
              </span>
              <span className="font-sans text-[11px] text-[#9CA3AF]">
                tank | {state.cropHealthPct.toFixed(0)}% crops
              </span>
            </div>
            {/* Thin 3px level gauge bar with subtle 200 L safe threshold tick marker */}
            <div className="relative w-full bg-[#1E232B] h-[3px] rounded-full overflow-hidden my-1.5">
              <div
                className={`h-full transition-all duration-300 ${
                  state.activeTankWaterLiters >= 200
                    ? 'bg-[#34D399]'
                    : state.activeTankWaterLiters >= 100
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#EF4444]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (state.activeTankWaterLiters / 500) * 100))}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-[#F59E0B]/80 z-10"
                style={{ left: '40%' }}
                title="200 L Safe Threshold"
              />
            </div>
            <p className="font-sans text-[11px] text-[#9CA3AF] truncate mb-2" title={enStrings.meters.waterFood.jargon}>
              {enStrings.meters.waterFood.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              safePlaySound('valve_turn');
              onUpdateControls({ methanePyrolysisActive: !controls.methanePyrolysisActive });
            }}
            className={`${TAP_BTN} ${controls.methanePyrolysisActive ? 'text-[#34D399]' : 'text-[#F59E0B]'}`}
          >
            <span className="truncate pr-1">
              {controls.methanePyrolysisActive ? enStrings.actions.leakStateSaved : enStrings.actions.leakStateLeaking}
            </span>
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                controls.methanePyrolysisActive ? 'bg-[#34D399]' : 'bg-[#F59E0B]'
              }`}
            />
          </button>
        </div>

        {/* Module 4: Radiation Shield */}
        <div className={`bg-[#14171C]/95 border ${shieldCardBorder} p-2.5 rounded-[2px] flex flex-col justify-between transition-all`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Shield className="h-3.5 w-3.5 text-[#F59E0B] shrink-0" />
                <span className="font-sans text-xs font-bold text-[#F4F4F0] truncate">
                  {enStrings.meters.shield.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    safePlaySound('valve_turn');
                    onSelectStation('station_5_shelter');
                  }}
                  className="font-mono text-[10px] font-bold text-[#9CA3AF] hover:text-[#F59E0B] bg-[#1E232B] hover:bg-[#282F3A] border border-[#3B4252] px-1 py-0.5 rounded-[2px] cursor-pointer transition-colors leading-none"
                  title="Jump 3D camera to [5] Storm Shelter"
                >
                  [5]
                </button>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-bold leading-none bg-[#14171C] ${shieldFace.border} ${shieldFace.color} shrink-0`}
              >
                {shieldFace.text}
              </span>
            </div>
            <div className="my-0.5 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-sm font-bold text-[#F4F4F0]">
                {controls.shelterWallWaterLiters.toFixed(0)} L
              </span>
              <span className="font-sans text-[11px] text-[#9CA3AF]">
                | {state.lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h
              </span>
            </div>
            {/* Thin 3px level gauge bar */}
            <div className="w-full bg-[#1E232B] h-[3px] rounded-full overflow-hidden my-1.5">
              <div
                className={`h-full transition-all duration-300 ${shieldUp ? 'bg-[#34D399]' : 'bg-[#EF4444]'}`}
                style={{ width: `${Math.min(100, Math.max(0, (controls.shelterWallWaterLiters / 450) * 100))}%` }}
              />
            </div>
            <p className="font-sans text-[11px] text-[#9CA3AF] truncate mb-2" title={enStrings.meters.shield.jargon}>
              {enStrings.meters.shield.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              safePlaySound('valve_turn');
              onUpdateControls({
                shelterWallWaterLiters: shieldUp ? 70 : 450,
                crewInStormShelter: !controls.crewInStormShelter,
              });
            }}
            className={`${TAP_BTN} ${shieldUp ? 'text-[#34D399]' : 'text-[#F59E0B]'}`}
          >
            <span className="truncate pr-1">
              {shieldUp ? enStrings.actions.shieldStateUp : enStrings.actions.shieldStateDown}
            </span>
            <span className={`h-2 w-2 rounded-full shrink-0 ${shieldUp ? 'bg-[#34D399]' : 'bg-[#4B5563]'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * CadetControlDeck
 * Thin backward-compatibility wrapper combining CadetMissionStrip.
 */
export const CadetControlDeck: React.FC<{
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onSelectStation: (station: CameraStationId) => void;
}> = ({ state, env, onUpdateControls, onSelectStation }) => {
  return (
    <CadetMissionStrip
      state={state}
      env={env}
      onUpdateControls={onUpdateControls}
      onSelectStation={onSelectStation}
    />
  );
};

/**
 * WelcomeAndTutorialModal
 * Story briefing (welcome) and 3-step spotlight tutorial (step1-3).
 * Sits at top-24/top-28 during steps 1-3 so bottom CadetMetersDock remains interactive.
 */
export const WelcomeAndTutorialModal: React.FC<{
  stage: TutorialStage;
  state: CrisisGameState;
  onStageChange: (stage: TutorialStage) => void;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onResetTutorialWater: () => void;
}> = ({ stage, state, onStageChange, onUpdateControls, onResetTutorialWater }) => {
  if (stage === 'done') return null;

  if (stage === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-sans">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enStrings.welcome.title}
          className="w-full max-w-lg bg-[#14171C] border border-[#3B4252] p-6 rounded-[2px] text-[#F4F4F0] shadow-2xl"
        >
          {/* Eyebrow kicker removed per craft checks: h2 leads directly */}
          <h2 className="font-sans font-bold text-xl tracking-wide text-[#F4F4F0] mb-3">
            {enStrings.welcome.title}
          </h2>
          <div className="space-y-2.5 text-sm text-[#D1D5DB] leading-relaxed mb-6">
            {enStrings.welcome.storySentences.map((sentence, idx) => (
              <p key={idx}>{sentence}</p>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-[#2E3440]">
            <button
              type="button"
              onClick={() => onStageChange('done')}
              className="w-full sm:w-auto px-4 py-2 min-h-[40px] rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] text-[#9CA3AF] hover:text-[#F4F4F0] font-sans text-xs font-medium cursor-pointer transition-colors"
            >
              {enStrings.welcome.skipTutorialBtn}
            </button>
            <button
              type="button"
              onClick={() => {
                safePlaySound('toggle_switch');
                onStageChange('step1');
              }}
              className="w-full sm:w-auto px-5 py-2 min-h-[40px] rounded-[2px] border border-[#F59E0B] bg-[#1E232B] hover:bg-[#2A303A] text-[#F59E0B] font-sans text-xs font-bold uppercase tracking-wider cursor-pointer transition-all active:translate-y-px"
            >
              {enStrings.welcome.startTutorialBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepNumber = stage === 'step1' ? 1 : stage === 'step2' ? 2 : 3;

  return (
    <div className="fixed inset-x-0 top-24 sm:top-28 z-40 flex justify-center px-4 pointer-events-none font-sans">
      <div
        role="region"
        aria-label="Cadet Tutorial Step"
        className="pointer-events-auto w-full max-w-xl bg-[#14171C] border border-[#F59E0B] p-5 rounded-[2px] text-[#F4F4F0] shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#2E3440] mb-3">
          <span className="font-mono text-xs font-bold text-[#F59E0B] uppercase">
            {enStrings.tutorial.stepTitle} {stepNumber}/3
          </span>
          <button
            type="button"
            onClick={() => onStageChange('done')}
            className="text-xs text-[#9CA3AF] hover:text-[#F4F4F0] underline cursor-pointer"
          >
            {enStrings.tutorial.skipBtn}
          </button>
        </div>

        <div className="text-sm text-[#D1D5DB] leading-relaxed mb-4">
          {stage === 'step1' && <p>{enStrings.tutorial.step1}</p>}
          {stage === 'step2' && <p>{enStrings.tutorial.step2}</p>}
          {stage === 'step3' && (
            <div>
              <p className="mb-3">{enStrings.tutorial.step3}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-[#1E232B] p-3 rounded-[2px] border border-[#2E3440]">
                <div className="text-[#9CA3AF]">
                  {enStrings.tutorial.tradeOffBefore}
                  <span className="block text-[#4B5563]">live: Tank {state.activeTankWaterLiters.toFixed(0)} L</span>
                </div>
                <div className="text-[#34D399]">{enStrings.tutorial.tradeOffAfter}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {stage === 'step1' && (
            <button
              type="button"
              onClick={() => {
                safePlaySound('toggle_switch');
                onStageChange('step2');
              }}
              className="min-h-[40px] px-5 py-2 rounded-[2px] border border-[#F59E0B] bg-[#1E232B] hover:bg-[#2A303A] text-[#F59E0B] font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all active:translate-y-px"
            >
              <span>{enStrings.tutorial.nextBtn}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {stage === 'step2' && (
            <button
              type="button"
              onClick={() => {
                safePlaySound('valve_turn');
                onUpdateControls({ shelterWallWaterLiters: 450, crewInStormShelter: true });
                onStageChange('step3');
              }}
              className="min-h-[40px] px-5 py-2 rounded-[2px] border border-[#34D399] bg-[#1E232B] hover:bg-[#2A303A] text-[#34D399] font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all active:translate-y-px"
            >
              <Check className="h-4 w-4" />
              <span>{enStrings.tutorial.moveBtn}</span>
            </button>
          )}

          {stage === 'step3' && (
            <button
              type="button"
              onClick={() => {
                safePlaySound('valve_turn');
                onResetTutorialWater();
                onStageChange('done');
              }}
              className="min-h-[40px] px-5 py-2 rounded-[2px] border border-[#F59E0B] bg-[#1E232B] hover:bg-[#2A303A] text-[#F59E0B] font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all active:translate-y-px"
            >
              <Check className="h-4 w-4" />
              <span>{enStrings.tutorial.finishBtn}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
