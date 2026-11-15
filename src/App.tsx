// src/App.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  BookOpen,
} from 'lucide-react';

import type {
  CameraStationId,
  CitationId,
  CrisisGameState,
  CrisisHourEnvironment,
  Interactive3DTarget,
  ValveAndBreakerControls,
} from './contracts/types';
import { CRISIS_TIMELINE_72H, NASA_CITATIONS } from './data/nasaCrisisData';
import {
  createInitialCrisisState,
  advanceCrisisHour,
  computeHourlyFlows,
  createCrisisPresetState,
  type CrisisPreset,
} from './engine/stormSimulation';

import { AquariusHabitat3D } from './three/AquariusHabitat3D';
import { DiegeticReticleAndHUD } from './components/DiegeticReticleAndHUD';
import { NasaSourceModal } from './components/NasaSourceModal';
import {
  WelcomeAndTutorialModal,
  computeDebriefSummary,
  type TutorialStage,
} from './components/CadetOnboardingAndHUD';
import enStrings from './i18n/en.json';
import * as CockpitAudio from './three/CockpitAudioAndTextures';

// Safe bridge to parallel-updated audio engine
const ensureAmbientFanStarted = (): void => {
  const fn = (CockpitAudio as Record<string, unknown>).ensureAmbientFanStarted;
  if (typeof fn === 'function') {
    (fn as () => void)();
  }
};

export function App(): React.ReactElement {
  // 1. Simulation Game State
  const [state, setState] = useState<CrisisGameState>(() => createInitialCrisisState());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeedMs, setPlaybackSpeedMs] = useState<number>(800); // 800ms default (~58s total)

  // 2. 3D Camera Station & Interaction Targets
  const [cameraStation, setCameraStation] = useState<CameraStationId>('station_1_console');
  const [hoveredTarget, setHoveredTarget] = useState<Interactive3DTarget | null>(null);

  // 3. NASA Citation Modal State
  const [scienceModalOpen, setScienceModalOpen] = useState<boolean>(false);
  const [activeCitationId, setActiveCitationId] = useState<CitationId | null>(null);

  // Cadet View Mode & Tutorial Flow State
  const [viewMode, setViewMode] = useState<'cadet' | 'engineer'>('cadet');
  const [tutorialStage, setTutorialStage] = useState<TutorialStage>('welcome');

  // 4. Telemetry Tracking
  const minBatteryRef = useRef<number>(state.batteryKwh);

  const currentEnv: CrisisHourEnvironment = useMemo(() => {
    const idx = Math.max(0, Math.min(state.hour, CRISIS_TIMELINE_72H.length - 1));
    return CRISIS_TIMELINE_72H[idx];
  }, [state.hour]);

  // Track minimum battery reserve over the crisis
  useEffect(() => {
    if (state.batteryKwh < minBatteryRef.current) {
      minBatteryRef.current = state.batteryKwh;
    }
  }, [state.batteryKwh]);

  // One-time gesture listener to guarantee ambient audio initialization
  useEffect(() => {
    const handleFirstGesture = () => {
      ensureAmbientFanStarted();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };

    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // 5. Simulation Step & Playback Handlers
  const handleStepHour = useCallback(() => {
    ensureAmbientFanStarted();
    setState((prev) => {
      if (prev.status !== 'running') return prev;
      const next = advanceCrisisHour(prev);
      if (next.status !== 'running') {
        setIsPlaying(false);
      }
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    ensureAmbientFanStarted();
    setState((prev) => {
      if (prev.status === 'survived' || prev.status === 'failed') {
        const reset = createInitialCrisisState();
        minBatteryRef.current = reset.batteryKwh;
        setIsPlaying(true);
        return reset;
      }
      setIsPlaying((p) => !p);
      return prev;
    });
  }, []);

  const handleChangeSpeed = useCallback((speedMs: number) => {
    setPlaybackSpeedMs(speedMs);
  }, []);

  // Real-Time Playback Timer Interval
  useEffect(() => {
    if (!isPlaying || state.status !== 'running') return;

    const timer = setInterval(() => {
      setState((prev) => {
        if (prev.status !== 'running') {
          setIsPlaying(false);
          return prev;
        }
        const next = advanceCrisisHour(prev);
        if (next.status !== 'running') {
          setIsPlaying(false);
        }
        return next;
      });
    }, playbackSpeedMs);

    return () => clearInterval(timer);
  }, [isPlaying, state.status, playbackSpeedMs]);

  // 6. Instant Flow Recalculation on Control Actuation
  const handleUpdateControls = useCallback(
    (patch: Partial<ValveAndBreakerControls>) => {
      setState((prev) => {
        const nextControls: ValveAndBreakerControls = {
          ...prev.controls,
          ...patch,
        };

        if (nextControls.shelterWallWaterLiters !== undefined) {
          nextControls.shelterWallWaterLiters = Math.max(
            0,
            Math.min(500, Math.round(nextControls.shelterWallWaterLiters))
          );
        }

        const totalSystemWaterLiters = prev.totalSystemWaterLiters;
        const activeTankWaterLiters = Math.max(
          0,
          totalSystemWaterLiters - nextControls.shelterWallWaterLiters
        );

        const env = CRISIS_TIMELINE_72H[Math.min(prev.hour, CRISIS_TIMELINE_72H.length - 1)];

        const intermediateState: CrisisGameState = {
          ...prev,
          controls: nextControls,
          activeTankWaterLiters,
        };

        const lastFlows = computeHourlyFlows(intermediateState, env);

        return {
          ...intermediateState,
          lastFlows,
        };
      });
    },
    []
  );

  // 7. Preset Jumping
  const handleJumpPreset = useCallback((preset: CrisisPreset) => {
    ensureAmbientFanStarted();
    setIsPlaying(false);
    const next = createCrisisPresetState(preset);
    minBatteryRef.current = next.batteryKwh;
    setState(next);
  }, []);

  // 8. Citation Inspection
  const handleInspectCitation = useCallback((id: CitationId) => {
    setActiveCitationId(id);
    setScienceModalOpen(true);
  }, []);

  const handleOpenScienceModal = useCallback((citationId?: CitationId) => {
    if (citationId) {
      setActiveCitationId(citationId);
    }
    setScienceModalOpen(true);
  }, []);

  const handleCloseScienceModal = useCallback(() => {
    setScienceModalOpen(false);
  }, []);

  // 9. Keyboard Shortcuts: 1-5 for camera stations, Space for play/pause, C for citation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (scienceModalOpen) {
        if (e.key === 'Escape') {
          setScienceModalOpen(false);
        }
        return;
      }

      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'Digit1') {
        ensureAmbientFanStarted();
        setCameraStation('station_1_console');
      } else if (e.code === 'Digit2') {
        ensureAmbientFanStarted();
        setCameraStation('station_2_breakers');
      } else if (e.code === 'Digit3') {
        ensureAmbientFanStarted();
        setCameraStation('station_3_valves');
      } else if (e.code === 'Digit4') {
        ensureAmbientFanStarted();
        setCameraStation('station_4_mailbox_garden');
      } else if (e.code === 'Digit5') {
        ensureAmbientFanStarted();
        setCameraStation('station_5_shelter');
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyC') {
        if (hoveredTarget?.citationId) {
          handleInspectCitation(hoveredTarget.citationId);
        } else {
          handleOpenScienceModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    scienceModalOpen,
    hoveredTarget,
    handleTogglePlay,
    handleInspectCitation,
    handleOpenScienceModal,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070B] select-none text-[#F4F4F0] font-sans">
      {/* 1. Fullscreen 3D First-Person Apollo LM-7 Aquarius Habitat */}
      <div className="absolute inset-0 w-full h-full z-0">
        <AquariusHabitat3D
          state={state}
          env={currentEnv}
          cameraStation={cameraStation}
          onStationChange={setCameraStation}
          onHoverTarget={setHoveredTarget}
          onUpdateControls={handleUpdateControls}
          onInspectCitation={handleInspectCitation}
        />
      </div>

      {/* 2. Diegetic First-Person Reticle & Telemetry Overlay (<8% UI coverage) */}
      <DiegeticReticleAndHUD
        state={state}
        env={currentEnv}
        hoveredTarget={hoveredTarget}
        cameraStation={cameraStation}
        isPlaying={isPlaying}
        playbackSpeedMs={playbackSpeedMs}
        onSelectStation={setCameraStation}
        onTogglePlay={handleTogglePlay}
        onStepHour={handleStepHour}
        onChangeSpeed={handleChangeSpeed}
        onJumpPreset={handleJumpPreset}
        onOpenScienceModal={handleOpenScienceModal}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode((v) => (v === 'cadet' ? 'engineer' : 'cadet'))}
        onReplayTutorial={() => setTutorialStage('welcome')}
        onUpdateControls={handleUpdateControls}
      />

      {/* 3. End-of-Mission Debrief Modal (when Survived or Failed) */}
      {state.status !== 'running' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mission Engineering Debrief"
            className="w-full max-w-2xl p-6 rounded-[2px] border border-[#3B4252] bg-[#14171C] font-sans shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-[#2E3440] pb-3">
              {state.status === 'survived' ? (
                <>
                  <ShieldCheck className="h-8 w-8 text-[#34D399] shrink-0" />
                  <div>
                    <h2 className="font-sans text-base font-bold uppercase tracking-wider text-[#F4F4F0]">
                      Mission Success — 72-Hour Lunar Crisis Survived
                    </h2>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Apollo LM-7 Aquarius Outpost sustained all 4 crewmembers through the Carrington-class SPE and Shackleton Ridge eclipse.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-8 w-8 text-[#EF4444] shrink-0" />
                  <div>
                    <h2 className="font-sans text-base font-bold uppercase tracking-wider text-[#EF4444]">
                      Mission Casualty — ECLSS Life Support Collapsed at T+{state.hour}:00 h
                    </h2>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Root cause: {state.failureReason ?? 'Life-critical physiological threshold exceeded NASA-STD-3001 limits.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 4 Scorecard Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-[#1C2026] p-3 rounded-[2px] border border-[#2E3440]">
                <div className="font-sans text-[10px] text-[#9CA3AF] uppercase font-medium">Final Crew Dose</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#EF4444] mt-1">
                  {state.cumulativeRadiationMsv.toFixed(2)} <span className="text-xs font-normal text-[#9CA3AF]">mSv</span>
                </div>
                <div className="font-mono text-[9px] text-[#9CA3AF] mt-0.5">
                  Limit: 75.0 mSv ({((state.cumulativeRadiationMsv / 75) * 100).toFixed(0)}%)
                </div>
              </div>

              <div className="bg-[#1C2026] p-3 rounded-[2px] border border-[#2E3440]">
                <div className="font-sans text-[10px] text-[#9CA3AF] uppercase font-medium">Conserved Water</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#F4F4F0] mt-1">
                  {state.totalSystemWaterLiters.toFixed(1)} <span className="text-xs font-normal text-[#9CA3AF]">L</span>
                </div>
                <div className="font-mono text-[9px] text-[#F59E0B] mt-0.5">
                  Lost to bleed: -{state.cumulativeWaterBleedLiters.toFixed(1)} L
                </div>
              </div>

              <div className="bg-[#1C2026] p-3 rounded-[2px] border border-[#2E3440]">
                <div className="font-sans text-[10px] text-[#9CA3AF] uppercase font-medium">Min Battery Reserve</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#F59E0B] mt-1">
                  {Math.min(minBatteryRef.current, state.batteryKwh).toFixed(1)} <span className="text-xs font-normal text-[#9CA3AF]">kWh</span>
                </div>
                <div className="font-mono text-[9px] text-[#9CA3AF] mt-0.5">
                  Capacity: 180.0 kWh
                </div>
              </div>

              <div className="bg-[#1C2026] p-3 rounded-[2px] border border-[#2E3440]">
                <div className="font-sans text-[10px] text-[#9CA3AF] uppercase font-medium">Crop Biomass</div>
                <div className="font-mono tabular-nums text-base font-bold text-[#34D399] mt-1">
                  {state.cropHealthPct.toFixed(0)}% <span className="text-xs font-normal text-[#9CA3AF]">| {Math.round(state.foodBufferKcal)} kcal</span>
                </div>
                <div className="font-mono text-[9px] text-[#9CA3AF] mt-0.5">
                  Hydroponic salad bay
                </div>
              </div>
            </div>

            {/* Cadet Mission Debrief Checklist (Stars & Checkpoints) */}
            {(() => {
              const debrief = computeDebriefSummary(state, minBatteryRef.current);
              return (
                <div className="bg-[#1C2026] p-3.5 rounded-[2px] border border-[#2E3440] my-3">
                  <div className="flex items-center justify-between border-b border-[#2E3440] pb-1.5 mb-2.5">
                    <span className="font-sans text-xs font-bold uppercase tracking-wider text-[#F4F4F0]">
                      {enStrings.debrief.starsEarned}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#F59E0B] tracking-wider">
                      {debrief.stars}/4 ★
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
                    <div>
                      <div className="text-[#34D399] font-medium text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>✓</span> {enStrings.debrief.workedTitle}
                      </div>
                      {debrief.worked.length > 0 ? (
                        <ul className="space-y-1 text-[#D1D5DB] text-[11px]">
                          {debrief.worked.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-[#34D399] shrink-0 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-[#6B7280] italic">None completed</p>
                      )}
                    </div>
                    <div>
                      <div className="text-[#EF4444] font-medium text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>✕</span> {enStrings.debrief.failedTitle}
                      </div>
                      {debrief.failed.length > 0 ? (
                        <ul className="space-y-1 text-[#D1D5DB] text-[11px]">
                          {debrief.failed.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-[#EF4444] shrink-0 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-[#6B7280] italic">None failed</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#2E3440]">
              {state.failureCitationId && (
                <button
                  type="button"
                  onClick={() => handleInspectCitation(state.failureCitationId!)}
                  className="rounded-[2px] border border-[#3B4252] bg-[#1E232B] hover:bg-[#2A303A] text-[#F4F4F0] text-xs font-sans font-medium px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#9CA3AF]" />
                  <span>Inspect NASA Standard [{NASA_CITATIONS[state.failureCitationId]?.code}]</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const reset = createInitialCrisisState();
                  minBatteryRef.current = reset.batteryKwh;
                  setState(reset);
                  setCameraStation('station_1_console');
                  setIsPlaying(false);
                }}
                className={`rounded-[2px] border px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:translate-y-px ${
                  state.status === 'survived'
                    ? 'bg-[#1E232B] border-[#34D399] text-[#F4F4F0] hover:bg-[#2A303A]'
                    : 'bg-[#1E232B] border-[#EF4444] text-[#F4F4F0] hover:bg-[#2A303A]'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#9CA3AF]" />
                <span>Reinitialize Flight Deck (T+0h)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Full NASA Scientific Citations & System Architecture Inspector Modal */}
      <NasaSourceModal
        isOpen={scienceModalOpen}
        activeCitationId={activeCitationId}
        onSelectCitation={(id) => setActiveCitationId(id)}
        onClose={handleCloseScienceModal}
        citations={NASA_CITATIONS}
      />

      {/* 5. Cadet Onboarding Briefing & 1-Move Tutorial Modal */}
      {tutorialStage !== 'done' && (
        <WelcomeAndTutorialModal
          stage={tutorialStage}
          state={state}
          onStageChange={setTutorialStage}
          onUpdateControls={handleUpdateControls}
          onResetTutorialWater={() =>
            handleUpdateControls({ shelterWallWaterLiters: 70, crewInStormShelter: false })
          }
        />
      )}
    </div>
  );
}

export default App;
