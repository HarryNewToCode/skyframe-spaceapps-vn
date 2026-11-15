// src/components/DiegeticReticleAndHUD.tsx
import React, { useState } from 'react';
import {
  Play,
  Pause,
  StepForward,
  FastForward,
  RotateCcw,
  BookOpen,
  AlertTriangle,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CitationId,
  CrisisGameState,
  CrisisHourEnvironment,
  CameraStationId,
  Interactive3DTarget,
  ValveAndBreakerControls,
} from '../contracts/types';
import enStrings from '../i18n/en.json';
import { CadetControlDeck } from './CadetOnboardingAndHUD';
import * as CockpitAudio from '../three/CockpitAudioAndTextures';

// Safe bridge to parallel-updated audio exports
const isCockpitAudioMuted = (): boolean => {
  const fn = (CockpitAudio as Record<string, unknown>).isCockpitAudioMuted;
  return typeof fn === 'function' ? (fn as () => boolean)() : false;
};

const setCockpitAudioMuted = (muted: boolean): boolean => {
  const fn = (CockpitAudio as Record<string, unknown>).setCockpitAudioMuted;
  return typeof fn === 'function' ? (fn as (m: boolean) => boolean)(muted) : muted;
};

const ensureAmbientFanStarted = (): void => {
  const fn = (CockpitAudio as Record<string, unknown>).ensureAmbientFanStarted;
  if (typeof fn === 'function') {
    (fn as () => void)();
  }
};

export interface DiegeticReticleAndHUDProps {
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  hoveredTarget: Interactive3DTarget | null;
  cameraStation: CameraStationId;
  isPlaying: boolean;
  playbackSpeedMs: number;
  onSelectStation: (station: CameraStationId) => void;
  onTogglePlay: () => void;
  onStepHour: () => void;
  onChangeSpeed: (ms: number) => void;
  onJumpPreset: (preset: 'nominal_start' | 'hour15_spe_onset' | 'sabatier_bleed_trap') => void;
  onOpenScienceModal: (citationId?: CitationId) => void;
  viewMode: 'cadet' | 'engineer';
  onToggleViewMode: () => void;
  onReplayTutorial: () => void;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
}

const STATIONS: { id: CameraStationId; label: string; title: string }[] = [
  { id: 'station_1_console', label: '[1] Forward Console', title: 'Snap camera to Forward DSKY & Flight Console' },
  { id: 'station_2_breakers', label: '[2] Panel 11 Breakers', title: 'Snap camera to Panel 11 Breakers' },
  { id: 'station_3_valves', label: '[3] ECS Water Valves', title: 'Snap camera to Aft ECS Water Manifold' },
  { id: 'station_4_mailbox_garden', label: '[4] Mailbox & Bio-Rack', title: 'Snap camera to Apollo 13 LiOH Mailbox & Hydroponic Bay' },
  { id: 'station_5_shelter', label: '[5] Storm Shelter', title: 'Snap camera to Water-Wall Storm Shelter Core' },
];

export const DiegeticReticleAndHUD: React.FC<DiegeticReticleAndHUDProps> = ({
  state,
  env,
  hoveredTarget,
  cameraStation,
  isPlaying,
  playbackSpeedMs,
  onSelectStation,
  onTogglePlay,
  onStepHour,
  onChangeSpeed,
  onJumpPreset,
  onOpenScienceModal,
  viewMode,
  onToggleViewMode,
  onReplayTutorial,
  onUpdateControls,
}) => {
  // Local audio mute state synced with audio engine
  const [audioMuted, setAudioMuted] = useState<boolean>(() => isCockpitAudioMuted());

  const handleToggleAudio = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    setCockpitAudioMuted(next);
    if (!next) {
      ensureAmbientFanStarted();
    }
  };

  // Annunciator C&W statuses according to authentic Dark-Lamp rules
  const o2Co2Level: 'off' | 'amber' | 'red' =
    state.cabinCo2MmHg >= 7.5 || state.cabinO2Kg < 5
      ? 'red'
      : state.cabinCo2MmHg >= 4.0
      ? 'amber'
      : 'off';

  const h2oLevel: 'off' | 'amber' | 'red' =
    state.activeTankWaterLiters < 120
      ? 'red'
      : state.activeTankWaterLiters < 200
      ? 'amber'
      : 'off';

  const battLevel: 'off' | 'amber' | 'red' =
    state.batteryKwh < 40
      ? 'red'
      : state.batteryKwh < 70 || state.lastFlows.netBatteryKw < -5
      ? 'amber'
      : 'off';

  const radLevel: 'off' | 'amber' | 'red' =
    state.lastFlows.shieldedDoseRateMsvPerHr >= 10 || state.cumulativeRadiationMsv >= 50
      ? 'red'
      : state.lastFlows.shieldedDoseRateMsvPerHr >= 2 || env.unshieldedDoseRateMsvPerHr >= 20
      ? 'amber'
      : 'off';

  const cropLevel: 'off' | 'amber' | 'red' =
    state.cropHealthPct < 40
      ? 'red'
      : state.cropHealthPct < 75
      ? 'amber'
      : 'off';

  const bleedLevel: 'off' | 'amber' | 'red' =
    state.lastFlows.sabatierWaterBleedEquivLPerHr > 0.5
      ? 'amber'
      : 'off';

  const annunciators: {
    id: string;
    label: string;
    value: string;
    level: 'off' | 'amber' | 'red';
  }[] = [
    {
      id: 'o2_co2',
      label: 'O2 / CO2',
      value: `${state.cabinCo2MmHg.toFixed(2)} mmHg`,
      level: o2Co2Level,
    },
    {
      id: 'h2o_tank',
      label: 'H2O Tank',
      value: `${Math.round(state.activeTankWaterLiters)} L`,
      level: h2oLevel,
    },
    {
      id: 'battery',
      label: 'Battery',
      value: `${Math.round(state.batteryKwh)} kWh`,
      level: battLevel,
    },
    {
      id: 'radiation',
      label: 'Radiation',
      value: `${state.lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h`,
      level: radLevel,
    },
    {
      id: 'crop_bay',
      label: 'Crop Bay',
      value: `${Math.round(state.cropHealthPct)}%`,
      level: cropLevel,
    },
    {
      id: 'h2_bleed',
      label: 'H2 Bleed',
      value: `${state.lastFlows.sabatierWaterBleedEquivLPerHr.toFixed(2)} L/h`,
      level: bleedLevel,
    },
  ];

  // Room identification
  let currentRoom = 'Apollo LM-7 Aquarius Flight Deck';
  if (cameraStation === 'station_1_console' || cameraStation === 'station_2_breakers') {
    currentRoom = 'Station 1/2: Forward Flight Console & Breakers';
  } else if (cameraStation === 'station_3_valves') {
    currentRoom = 'Station 3: Aft ECS Water Manifold';
  } else if (cameraStation === 'station_4_mailbox_garden') {
    currentRoom = 'Station 4: Apollo 13 LiOH Mailbox & Bio-Rack';
  } else if (cameraStation === 'station_5_shelter') {
    currentRoom = 'Station 5: Water-Wall Storm Shelter Core';
  }

  // Master Alarm Ticker Condition
  const isHighRadUnshielded =
    env.unshieldedDoseRateMsvPerHr > 20 && state.controls.shelterWallWaterLiters < 300;
  const isWaterStarved = state.activeTankWaterLiters < 200;
  const showMasterAlarm = isHighRadUnshielded || isWaterStarved;

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between overflow-hidden z-20 font-sans">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP BAR: APOLLO DSKY MISSION CLOCK, C&W ANNUNCIATORS, CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full bg-[#111419]/95 border-b border-[#2E3440] px-3 py-1 flex flex-col gap-1 text-xs">
        {/* Row 1: Mission Clock & Phase + Hardware Control Buttons */}
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          {/* Left: Mission Elapsed Time + Mission Phase */}
          <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-sans text-[#9CA3AF] leading-none">Mission Elapsed Time</span>
              <span className="text-sm font-mono font-bold tabular-nums text-[#34D399] leading-tight mt-0.5">
                T+{String(state.hour).padStart(2, '0')}:00 / 72:00 h
              </span>
            </div>

            <div className="h-6 w-px bg-[#2E3440] flex-shrink-0" />

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-sans text-[#9CA3AF] leading-none">Mission Phase</span>
              <span
                className="text-xs font-sans font-semibold text-[#F4F4F0] truncate max-w-[220px] leading-tight mt-0.5"
                title={env.phaseLabel}
              >
                {env.phaseLabel}
              </span>
            </div>
          </div>

          {/* Right: All 8 flat tactile rectangular hardware buttons */}
          <div className="flex flex-wrap items-center justify-end gap-1 pointer-events-auto">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={onTogglePlay}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title={isPlaying ? 'Pause Simulation' : 'Run Simulation'}
            >
              {isPlaying ? (
                <Pause className="h-3 w-3 text-[#34D399]" />
              ) : (
                <Play className="h-3 w-3 text-[#F4F4F0]" />
              )}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* +1h */}
            <button
              type="button"
              onClick={onStepHour}
              disabled={isPlaying || state.hour >= 72}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Advance 1 Hour"
            >
              <StepForward className="h-3 w-3 text-[#9CA3AF]" />
              <span>+1h</span>
            </button>

            {/* Speed: 1x (3.5s/h) -> 2x (1.8s/h) -> Fast (0.8s/h) */}
            <button
              type="button"
              onClick={() => {
                const nextSpeed =
                  playbackSpeedMs >= 3000 ? 1800 : playbackSpeedMs >= 1500 ? 800 : 3500;
                onChangeSpeed(nextSpeed);
              }}
              className={`rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                playbackSpeedMs < 3000 ? 'text-[#F59E0B] border-[#F59E0B]/60' : 'text-[#F4F4F0]'
              }`}
              title="Cycle Simulation Speed: 1x (3.5s/h) -> 2x (1.8s/h) -> Fast (0.8s/h)"
            >
              <FastForward className="h-3 w-3 text-[#9CA3AF]" />
              <span>
                {playbackSpeedMs >= 3000 ? '1x' : playbackSpeedMs >= 1500 ? '2x' : 'Fast'}
              </span>
            </button>

            {/* T+15h SPE Climax */}
            <button
              type="button"
              onClick={() => onJumpPreset('hour15_spe_onset')}
              className="rounded-[2px] border border-[#F59E0B] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#FEF3C7] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title="Jump to T+15h: 1972 SPE + Eclipse Climax"
            >
              <span>T+15h SPE Climax</span>
            </button>

            {/* Sabatier Bleed */}
            <button
              type="button"
              onClick={() => onJumpPreset('sabatier_bleed_trap')}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title="Sabatier Bleed Trap Demonstration"
            >
              <span>Sabatier Bleed</span>
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={() => onJumpPreset('nominal_start')}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title="Reset Simulation to T+0h Nominal"
            >
              <RotateCcw className="h-3 w-3 text-[#9CA3AF]" />
              <span>Reset</span>
            </button>

            {/* Audio: On / Muted */}
            <button
              type="button"
              onClick={handleToggleAudio}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title={audioMuted ? 'Unmute Cockpit Audio' : 'Mute Cockpit Audio'}
            >
              {audioMuted ? (
                <VolumeX className="h-3 w-3 text-[#EF4444]" />
              ) : (
                <Volume2 className="h-3 w-3 text-[#34D399]" />
              )}
              <span>{audioMuted ? 'Audio: Muted' : 'Audio: On'}</span>
            </button>

            {/* NASA Specs [C] */}
            <button
              type="button"
              onClick={() => onOpenScienceModal()}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title="Open NASA Science & Architecture Specifications [C]"
            >
              <BookOpen className="h-3 w-3 text-[#9CA3AF]" />
              <span>NASA Specs [C]</span>
            </button>

            {/* Cadet / Engineer View Toggle */}
            <button
              type="button"
              onClick={onToggleViewMode}
              className={`rounded-[2px] border min-h-[30px] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                viewMode === 'engineer'
                  ? 'border-[#38BDF8] text-[#38BDF8]'
                  : 'border-[#3B4252] text-[#F4F4F0]'
              }`}
              title="Toggle Cadet / Engineer View Deck"
            >
              <span>{viewMode === 'cadet' ? enStrings.views.engineerToggle : enStrings.views.cadetToggle}</span>
            </button>

            {/* Replay Tutorial */}
            <button
              type="button"
              onClick={onReplayTutorial}
              className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 min-h-[30px] text-[11px] font-sans font-medium text-[#F4F4F0] whitespace-nowrap transition-colors flex items-center gap-1.5"
              title="Replay Cadet Briefing & Tutorial"
            >
              <span>{enStrings.tutorial.replayBtn}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Cadet Deck or Caution & Warning Matrix Annunciators */}
        {viewMode === 'cadet' ? (
          <CadetControlDeck
            state={state}
            env={env}
            onUpdateControls={onUpdateControls}
            onSelectStation={onSelectStation}
          />
        ) : (
          <div className="flex items-center justify-between gap-2 w-full border-t border-[#1E232B] pt-1">
            <span className="text-[10px] font-sans font-medium text-[#9CA3AF] whitespace-nowrap">Caution &amp; Warning Matrix</span>
            <div className="grid grid-cols-6 gap-1.5 flex-1 max-w-4xl">
              {annunciators.map((tile) => {
                let tileClass = 'bg-[#0D1014] border-[#252A32] text-[#525B66]';
                let labelClass = 'text-[#525B66]';
                if (tile.level === 'red') {
                  tileClass = 'bg-[#450A0A] border-[#EF4444] text-[#FEE2E2]';
                  labelClass = 'text-[#FCA5A5]';
                } else if (tile.level === 'amber') {
                  tileClass = 'bg-[#451A03] border-[#F59E0B] text-[#FEF3C7]';
                  labelClass = 'text-[#FDE68A]';
                }

                return (
                  <div
                    key={tile.id}
                    className={`rounded-[2px] border px-2 py-0.5 flex flex-col justify-center min-w-0 transition-colors ${tileClass}`}
                  >
                    <span className={`text-[9px] font-sans font-medium uppercase tracking-wider leading-none truncate ${labelClass}`}>
                      {tile.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold tabular-nums leading-tight mt-0.5 truncate">
                      {tile.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CENTER OPTICAL CROSSHAIR & INSPECTION STENCIL */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          {/* Outer circle */}
          <div
            className={`w-7 h-7 rounded-full border transition-colors ${
              hoveredTarget ? 'border-[#F59E0B]' : 'border-[#E5E7EB]/60'
            }`}
          />
          {/* Inner dot */}
          <div
            className={`absolute w-1.5 h-1.5 rounded-full transition-colors ${
              hoveredTarget ? 'bg-[#F59E0B]' : 'bg-[#E5E7EB]/70'
            }`}
          />
          {/* Crosshair tick lines */}
          <div className="absolute w-10 h-px bg-[#E5E7EB]/30" />
          <div className="absolute h-10 w-px bg-[#E5E7EB]/30" />

          {/* Floating Stencil Callout Box (appears right below reticle when hovering a 3D control) */}
          {hoveredTarget && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 max-w-[90vw] rounded-[2px] bg-[#14171C]/95 border border-[#4B525C] p-2.5 shadow-2xl pointer-events-auto text-left">
              <div className="flex items-center justify-between pb-1 border-b border-[#2E3440]">
                <span className="font-sans text-[11px] text-[#9CA3AF] truncate">
                  {hoveredTarget.panelCode} · {hoveredTarget.kind.replace('_', ' ')}
                </span>
              </div>

              {/* Target Label */}
              <div className="font-sans text-sm font-semibold text-[#F4F4F0] mt-1.5 leading-snug">
                {hoveredTarget.label}
              </div>

              {/* Current Value Readout */}
              <div className="font-mono text-xs font-bold text-[#F59E0B] mt-0.5">
                {hoveredTarget.currentValueLabel}
              </div>

              {/* Action Prompt */}
              <div className="font-mono text-[11px] text-[#E5E7EB] bg-[#0D1014] border border-[#2E3440] px-2 py-1 mt-1.5 leading-tight">
                {hoveredTarget.actionPrompt}
              </div>

              {/* Trade-off Note */}
              {hoveredTarget.tradeoffNote && (
                <div className="font-sans text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed">
                  {hoveredTarget.tradeoffNote}
                </div>
              )}

              {/* Clickable NASA Citation Tag */}
              {hoveredTarget.citationId && (
                <div className="mt-2 pt-1.5 border-t border-[#2E3440] flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenScienceModal(hoveredTarget.citationId)}
                    className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] active:translate-y-px px-2 py-1 text-[11px] font-sans font-medium text-[#F4F4F0] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <BookOpen className="h-3 w-3 text-[#9CA3AF]" />
                    <span>[C] Inspect NASA Citation</span>
                    <ExternalLink className="h-2.5 w-2.5 text-[#9CA3AF]" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. BOTTOM NAVIGATION & STATION SWITCH STRIP */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full flex flex-col justify-end">
        {/* Apollo Master Alarm Bar */}
        {showMasterAlarm && (
          <div className="w-full bg-[#450A0A]/95 border-t border-b border-[#EF4444] text-[#FEE2E2] font-sans text-xs px-3 py-1 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="h-3.5 w-3.5 text-[#EF4444] flex-shrink-0" />
              <span className="font-bold tracking-wider mr-1">MASTER ALARM:</span>
              <span className="truncate">
                {isHighRadUnshielded
                  ? 'AUG 1972 SPE PROTON STORM (>20 mSv/h)! Walk to [3] ECS Water Valves for 450L Shield & [2] Panel 11 Breakers to shed loads!'
                  : 'ACTIVE TANK WATER < 200 L — VEGGIE HYDROPONICS & OGA STARVED! Open Cross-Feed Valve V-2 or Reduce Shield Water when safe!'}
              </span>
            </div>
            <span className="text-[10px] font-mono tracking-wider uppercase text-[#FCA5A5] pl-2 flex-shrink-0 hidden md:inline">
              [CRITICAL TELEMETRY]
            </span>
          </div>
        )}

        {/* Bottom Navigation Strip */}
        <div className="w-full bg-[#111419]/95 border-t border-[#2E3440] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
          {/* Current Room Readout */}
          <div className="flex items-center gap-1.5 min-w-fit font-sans text-[11px] text-[#9CA3AF]">
            <span>Location:</span>
            <span className="font-semibold text-[#F4F4F0]">{currentRoom}</span>
          </div>

          {/* 5 Quick-Snap Camera Station Buttons */}
          <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
            {STATIONS.map((st) => {
              const isActive = cameraStation === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSelectStation(st.id)}
                  className={`rounded-[2px] border px-2 py-0.5 text-[11px] font-sans font-medium transition-colors ${
                    isActive
                      ? 'bg-[#282F3A] border-[#F4F4F0] text-[#F4F4F0] shadow-[inset_0_2px_0_#F59E0B]'
                      : 'bg-[#161A20] border-[#2E3440] text-[#9CA3AF] hover:text-[#F4F4F0] hover:bg-[#1E232B]'
                  }`}
                  title={st.title}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Controls Legend */}
          <div className="hidden xl:flex items-center gap-2 font-sans text-[11px] text-[#9CA3AF]">
            <span>WASD Walk</span>
            <span className="text-[#3B4252]">·</span>
            <span>Drag Look</span>
            <span className="text-[#3B4252]">·</span>
            <span>Click/E Actuate</span>
            <span className="text-[#3B4252]">·</span>
            <span>C Citation</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiegeticReticleAndHUD;
