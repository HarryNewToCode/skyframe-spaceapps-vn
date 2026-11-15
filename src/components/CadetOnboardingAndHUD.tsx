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
  'min-h-[32px] w-full px-2.5 py-1.5 rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] font-mono text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors active:translate-y-px pointer-events-auto';

/** Compact Cadet HUD: 4-checkpoint strip, "What now?" hint, and 4 meter cards. */
export const CadetControlDeck: React.FC<{
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

  const handleExecuteGuidance = () => {
    if (guidance.controlPatch) onUpdateControls(guidance.controlPatch);
    if (guidance.station) onSelectStation(guidance.station);
  };

  return (
    <div className="pointer-events-none w-full h-full flex flex-col justify-between p-2 sm:p-4 select-none font-sans">
      {/* Top: checkpoints + guidance */}
      <div className="pointer-events-auto w-full max-w-5xl mx-auto flex flex-col gap-2">
        <div className="bg-[#14171C]/95 border border-[#2E3440] p-2.5 sm:p-3 rounded-[2px]">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#2E3440]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-[#F59E0B] tracking-wider uppercase">
                {enStrings.views.missionGoalsTitle}
              </span>
              <span className="font-mono text-[10px] text-[#9CA3AF] tabular-nums">
                ({checkpoints.earnedCount}/4 {enStrings.views.starsLabel})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setHintOpen((prev) => !prev)}
              className="min-h-[32px] px-3 py-1 rounded-[2px] border border-[#F59E0B]/80 bg-[#1E232B] hover:bg-[#2A303A] text-[#F59E0B] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors active:translate-y-px"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>{enStrings.views.whatNowBtn}</span>
              {hintOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          <div className="w-full bg-[#1E232B] h-1.5 rounded-full overflow-hidden my-2 border border-[#2E3440]">
            <div
              className="bg-[#F59E0B] h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            {enStrings.checkpoints.map((cp, idx) => {
              const isEarned = checkpoints.completed[idx];
              const isActive = idx === checkpoints.activeIndex;
              return (
                <div
                  key={cp.id}
                  className={`p-2 rounded-[2px] border flex flex-col justify-between ${
                    isActive ? 'border-[#F59E0B] bg-[#1E232B]' : 'border-[#2E3440] bg-[#14171C]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] text-[#9CA3AF] tracking-wide">{cp.hours}</span>
                    <Star
                      className={`h-3.5 w-3.5 ${
                        isEarned ? 'fill-[#F59E0B] text-[#F59E0B]' : 'fill-transparent text-[#4B5563]'
                      }`}
                    />
                  </div>
                  <div className="font-sans text-xs font-semibold text-[#F4F4F0] line-clamp-1">{cp.title}</div>
                </div>
              );
            })}
          </div>

          {activeGoal && (
            <div className="mt-2 pt-2 border-t border-[#2E3440] flex items-center gap-2 text-xs font-sans text-[#D1D5DB]">
              <span className="font-mono text-[10px] text-[#F59E0B] uppercase font-bold shrink-0">ACTIVE GOAL:</span>
              <span className="line-clamp-1">{activeGoal.goal}</span>
            </div>
          )}
        </div>

        {hintOpen && (
          <div className="bg-[#14171C]/95 border border-[#2E3440] border-l-4 border-l-[#F59E0B] p-2.5 sm:p-3 rounded-[2px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-[#F4F4F0]">
              <Compass className="h-4 w-4 text-[#F59E0B] shrink-0" />
              <span className="font-sans">{guidance.hint}</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              {guidance.controlPatch && (
                <button
                  type="button"
                  onClick={handleExecuteGuidance}
                  className="min-h-[32px] px-3 py-1 rounded-[2px] border border-[#34D399] bg-[#1E232B] hover:bg-[#2A303A] text-[#34D399] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors active:translate-y-px pointer-events-auto"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{guidance.actionLabel ?? enStrings.views.doMoveBtn}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setHintOpen(false)}
                className="min-h-[32px] px-2.5 py-1 rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] text-[#9CA3AF] hover:text-[#F4F4F0] font-sans text-xs cursor-pointer transition-colors pointer-events-auto"
              >
                {enStrings.views.hideHintBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: 4 Cadet meter cards */}
      <div className="pointer-events-auto w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-auto pt-4">
        {/* Power */}
        <div className={`bg-[#14171C]/95 border ${powerFace.border} p-3 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <BatteryCharging className="h-4 w-4 text-[#F59E0B]" />
                <span className="font-mono text-xs font-bold text-[#F4F4F0] uppercase">{enStrings.meters.power.label}</span>
              </div>
              <span className={`font-mono text-xs font-bold ${powerFace.color}`}>{powerFace.text}</span>
            </div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F4F4F0] my-1">
              {state.batteryKwh.toFixed(1)}{' '}
              <span className="text-xs font-normal text-[#9CA3AF]">
                kWh ({((state.batteryKwh / state.maxBatteryKwh) * 100).toFixed(0)}%)
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mb-2.5" title={enStrings.meters.power.jargon}>
              {enStrings.meters.power.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateControls({ hydroponicsThrottlePct: lightsDimmed ? 100 : 25 })}
            className={`${TAP_BTN} text-[#F4F4F0] ${lightsDimmed ? 'text-[#F59E0B]' : 'text-[#34D399]'}`}
          >
            <span>{lightsDimmed ? enStrings.actions.lights100 : enStrings.actions.lights25}</span>
            <span className={`h-2 w-2 rounded-full ${lightsDimmed ? 'bg-[#F59E0B]' : 'bg-[#34D399]'}`} />
          </button>
        </div>

        {/* Air */}
        <div className={`bg-[#14171C]/95 border ${airFace.border} p-3 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Wind className="h-4 w-4 text-[#34D399]" />
                <span className="font-mono text-xs font-bold text-[#F4F4F0] uppercase">{enStrings.meters.air.label}</span>
              </div>
              <span className={`font-mono text-xs font-bold ${airFace.color}`}>{airFace.text}</span>
            </div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F4F4F0] my-1">
              {state.cabinCo2MmHg.toFixed(2)}{' '}
              <span className="text-xs font-normal text-[#9CA3AF]">
                mmHg CO2 | {state.cabinO2Kg.toFixed(1)} kg O2
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mb-2.5" title={enStrings.meters.air.jargon}>
              {enStrings.meters.air.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateControls({ sabatierActive: !controls.sabatierActive })}
            className={`${TAP_BTN} text-[#F4F4F0] ${controls.sabatierActive ? 'text-[#34D399]' : ''}`}
          >
            <span>{controls.sabatierActive ? enStrings.actions.airBoostOff : enStrings.actions.airBoostOn}</span>
            <span className={`h-2 w-2 rounded-full ${controls.sabatierActive ? 'bg-[#34D399]' : 'bg-[#4B5563]'}`} />
          </button>
        </div>

        {/* Water & Plants */}
        <div className={`bg-[#14171C]/95 border ${waterFace.border} p-3 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-4 w-4 text-[#34D399]" />
                <span className="font-mono text-xs font-bold text-[#F4F4F0] uppercase">{enStrings.meters.waterFood.label}</span>
              </div>
              <span className={`font-mono text-xs font-bold ${waterFace.color}`}>{waterFace.text}</span>
            </div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F4F4F0] my-1">
              {state.activeTankWaterLiters.toFixed(0)}{' '}
              <span className="text-xs font-normal text-[#9CA3AF]">
                L tank | {state.cropHealthPct.toFixed(0)}% crops
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mb-2.5" title={enStrings.meters.waterFood.jargon}>
              {enStrings.meters.waterFood.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onUpdateControls({ methanePyrolysisActive: !controls.methanePyrolysisActive })}
            className={`${TAP_BTN} text-[#F4F4F0] ${controls.methanePyrolysisActive ? 'text-[#34D399]' : 'text-[#F59E0B]'}`}
          >
            <span>
              {controls.methanePyrolysisActive ? enStrings.actions.leakStopOff : enStrings.actions.leakStopOn}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${controls.methanePyrolysisActive ? 'bg-[#34D399]' : 'bg-[#F59E0B]'}`}
            />
          </button>
        </div>

        {/* Radiation Shield: water wall + crew posture move together */}
        <div className={`bg-[#14171C]/95 border ${shieldFace.border} p-3 rounded-[2px] flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#F59E0B]" />
                <span className="font-mono text-xs font-bold text-[#F4F4F0] uppercase">{enStrings.meters.shield.label}</span>
              </div>
              <span className={`font-mono text-xs font-bold ${shieldFace.color}`}>{shieldFace.text}</span>
            </div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F4F4F0] my-1">
              {controls.shelterWallWaterLiters.toFixed(0)}{' '}
              <span className="text-xs font-normal text-[#9CA3AF]">
                L | {state.lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] line-clamp-1 mb-2.5" title={enStrings.meters.shield.jargon}>
              {enStrings.meters.shield.jargon}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateControls({
                shelterWallWaterLiters: shieldUp ? 70 : 450,
                crewInStormShelter: !controls.crewInStormShelter,
              })
            }
            className={`${TAP_BTN} text-[#F4F4F0] ${shieldUp ? 'text-[#34D399]' : ''}`}
          >
            <span>{shieldUp ? enStrings.actions.shield70 : enStrings.actions.shield450}</span>
            <span className={`h-2 w-2 rounded-full ${shieldUp ? 'bg-[#34D399]' : 'bg-[#4B5563]'}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

/** Story briefing (welcome) and 3-step spotlight tutorial (step1-3). */
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
          className="w-full max-w-lg bg-[#14171C] border border-[#3B4252] p-6 rounded-[2px] text-[#F4F4F0]"
        >
          <div className="inline-block px-2.5 py-1 rounded-[2px] bg-[#1E232B] border border-[#F59E0B]/60 text-[#F59E0B] font-mono text-[10px] font-bold tracking-widest uppercase mb-3">
            {enStrings.welcome.badge}
          </div>
          <h2 className="text-xl font-bold tracking-wide text-[#F4F4F0] mb-3">{enStrings.welcome.title}</h2>
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
              onClick={() => onStageChange('step1')}
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
    <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center px-4 pointer-events-none font-sans">
      <div
        role="region"
        aria-label="Cadet Tutorial Step"
        className="pointer-events-auto w-full max-w-xl bg-[#14171C] border-2 border-[#F59E0B] p-5 rounded-[2px] text-[#F4F4F0]"
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
              onClick={() => onStageChange('step2')}
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
                onUpdateControls({ shelterWallWaterLiters: 450, crewInStormShelter: true });
                onStageChange('step3');
              }}
              className="min-h-[40px] px-5 py-2 rounded-[2px] border border-[#34D399] bg-[#1E232B] hover:bg-[#2A303A] text-[#34D399] font-sans text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all active:translate-y-px animate-pulse"
            >
              <Check className="h-4 w-4" />
              <span>{enStrings.tutorial.moveBtn}</span>
            </button>
          )}

          {stage === 'step3' && (
            <button
              type="button"
              onClick={() => {
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
