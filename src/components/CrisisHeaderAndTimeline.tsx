// src/components/CrisisHeaderAndTimeline.tsx
import React, { useState, useId } from 'react';
import {
  Play,
  Pause,
  StepForward,
  FastForward,
  RotateCcw,
  Zap,
  Flame,
  BookOpen,
  Sun,
  Shield,
  Wind,
  Activity,
  Sprout,
  Thermometer,
  ExternalLink,
  ChevronRight,
  Info,
  Radio,
  Clock,
  Compass,
} from 'lucide-react';
import type { CitationId, CrisisGameState, CrisisHourEnvironment } from '../contracts/types';
import { NASA_CITATIONS } from '../data/nasaCrisisData';

export interface CrisisHeaderAndTimelineProps {
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  timeline: CrisisHourEnvironment[];
  isPlaying: boolean;
  playbackSpeedMs: number;
  onTogglePlay: () => void;
  onStepHour: () => void;
  onChangeSpeed: (ms: number) => void;
  onJumpPreset: (preset: 'nominal_start' | 'hour15_spe_onset' | 'sabatier_bleed_trap') => void;
  onInspectCitation: (id: CitationId) => void;
  onOpenScienceModal: () => void;
}

export const CrisisHeaderAndTimeline: React.FC<CrisisHeaderAndTimelineProps> = ({
  state,
  env,
  timeline,
  isPlaying,
  playbackSpeedMs,
  onTogglePlay,
  onStepHour,
  onChangeSpeed,
  onJumpPreset,
  onInspectCitation,
  onOpenScienceModal,
}) => {
  const amberGradId = useId();
  const crimsonGradId = useId();

  // Flip states for inline [CITE] formula revelation
  const [flippedGauges, setFlippedGauges] = useState<Record<string, boolean>>({});

  const toggleFlip = (gaugeKey: string) => {
    setFlippedGauges((prev) => ({
      ...prev,
      [gaugeKey]: !prev[gaugeKey],
    }));
  };

  // Compact Timeline SVG constants (56px height)
  const svgWidth = 1000;
  const svgHeight = 56;
  const paddingX = 16;
  const paddingY = 6;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;
  const maxDose = 150;

  // Solar curve (Amber)
  const solarPoints = timeline.map((pt) => {
    const x = paddingX + (pt.hour / 72) * graphWidth;
    const y = svgHeight - paddingY - pt.solarIlluminationFactor * graphHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const solarPathD = `M ${solarPoints.join(' L ')}`;
  const solarAreaD = `${solarPathD} L ${(paddingX + graphWidth).toFixed(1)},${(svgHeight - paddingY).toFixed(1)} L ${paddingX.toFixed(1)},${(svgHeight - paddingY).toFixed(1)} Z`;

  // Radiation curve (Crimson)
  const radPoints = timeline.map((pt) => {
    const x = paddingX + (pt.hour / 72) * graphWidth;
    const norm = Math.min(1, pt.unshieldedDoseRateMsvPerHr / maxDose);
    const y = svgHeight - paddingY - norm * graphHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const radPathD = `M ${radPoints.join(' L ')}`;
  const radAreaD = `${radPathD} L ${(paddingX + graphWidth).toFixed(1)},${(svgHeight - paddingY).toFixed(1)} L ${paddingX.toFixed(1)},${(svgHeight - paddingY).toFixed(1)} Z`;

  // Playhead position
  const playheadX = paddingX + (state.hour / 72) * graphWidth;

  // Eclipse & SPE Zones
  const eclipseStartX = paddingX + (12 / 72) * graphWidth;
  const eclipseEndX = paddingX + (58 / 72) * graphWidth;
  const eclipseWidth = eclipseEndX - eclipseStartX;

  const speStartX = paddingX + (15 / 72) * graphWidth;
  const speEndX = paddingX + (38 / 72) * graphWidth;
  const speWidth = speEndX - speStartX;

  // Net CO2 rate calculation (CO2_KG_TO_MMHG = 3.5)
  const netCo2Kg = state.lastFlows.co2ProducedKgPerHr - state.lastFlows.co2ScrubbedKgPerHr;
  const netCo2RateMmHgPerHr = netCo2Kg * 3.5;
  const isTankStarved = state.activeTankWaterLiters < 200;

  // Alert level styles
  const alertBadge = {
    nominal: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-400',
    watch: 'border-amber-500/40 bg-amber-950/40 text-amber-400',
    warning: 'border-orange-500/50 bg-orange-950/50 text-orange-400',
    critical: 'border-red-500/60 bg-red-950/60 text-red-400 animate-pulse',
  }[env.alertLevel] || 'border-slate-700 bg-slate-900 text-slate-300';

  return (
    <header className="w-full bg-[#090D16] border-b border-[#1E293B] text-slate-100 select-none shadow-xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. COMPACT TOP TACTICAL FLIGHT DECK HEADER (<40px height) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-3 py-1.5 border-b border-[#1E293B]/80 bg-[#0F172A]/80 backdrop-blur flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Mission Title, Coordinates & Status */}
        <div className="flex items-center space-x-2.5 min-w-fit">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-cyan-500/40 bg-cyan-950/50 text-cyan-400 flex-shrink-0">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest px-1.5 py-0.2 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 uppercase font-semibold">
              AEGIS // DIR-01
            </span>
            <h1 className="text-xs md:text-sm font-bold font-mono tracking-wider text-slate-100 uppercase whitespace-nowrap">
              STORM-72H: SHACKLETON RIM ECLSS FLIGHT DECK
            </h1>
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
              <Compass className="h-3 w-3 text-cyan-400" />
              89.47°S, 222.6°E (LRO LOLA Peak SP-1)
            </span>
            <span className="text-amber-400/90 font-mono text-[11px] font-semibold flex items-center gap-1">
              <Clock className="h-3 w-3" />
              T+{state.hour.toString().padStart(2, '0')}:00h
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono border ${alertBadge}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {state.status === 'failed'
                ? 'FAILED'
                : state.status === 'survived'
                ? 'SURVIVED'
                : env.alertLevel.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Right: Playback, Speed, Scenario Presets & Science Modal */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Play/Pause & Step */}
          <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded p-0.5 gap-0.5">
            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                isPlaying
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-500/30'
              }`}
              title={isPlaying ? 'Pause Simulation' : 'Run Simulation'}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              type="button"
              onClick={onStepHour}
              disabled={isPlaying || state.hour >= 72}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
              title="Advance 1 Hour"
            >
              <StepForward className="h-3 w-3 text-cyan-400" />
              <span>+1H</span>
            </button>

            <div className="h-3.5 w-px bg-slate-700/60 mx-0.5" />

            {/* Speed Selector */}
            <button
              type="button"
              onClick={() => onChangeSpeed(1000)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                playbackSpeedMs >= 800
                  ? 'bg-cyan-500/30 text-cyan-300 font-semibold border border-cyan-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1x
            </button>
            <button
              type="button"
              onClick={() => onChangeSpeed(150)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                playbackSpeedMs < 800
                  ? 'bg-purple-500/30 text-purple-300 font-semibold border border-purple-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="60s Judge Turbo"
            >
              <FastForward className="h-2.5 w-2.5" />
              <span>TURBO</span>
            </button>
          </div>

          {/* Quick Presets */}
          <button
            type="button"
            onClick={() => onJumpPreset('hour15_spe_onset')}
            className="flex items-center gap-1 px-2 py-1 rounded bg-gradient-to-r from-red-950/90 to-amber-950/90 border border-red-500/70 hover:border-red-400 text-red-300 text-[11px] font-mono font-bold shadow-[0_0_10px_rgba(239,68,68,0.25)] transition-all active:scale-95"
            title="Jump to T+15h Solar Particle Event onset & deep eclipse shadow"
          >
            <Zap className="h-3 w-3 text-amber-400 animate-pulse" />
            <span className="whitespace-nowrap">⚡ T+15h SPE CLIMAX</span>
          </button>

          <button
            type="button"
            onClick={() => onJumpPreset('sabatier_bleed_trap')}
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded bg-purple-950/40 border border-purple-500/40 hover:border-purple-400 text-purple-300 text-[10px] font-mono transition-colors whitespace-nowrap"
            title="Sabatier Venting Bleed Trap Demo"
          >
            <Flame className="h-3 w-3 text-purple-400" />
            <span>SABATIER DEMO</span>
          </button>

          <button
            type="button"
            onClick={() => onJumpPreset('nominal_start')}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-[10px] font-mono transition-colors"
            title="Reset to T+0h"
          >
            <RotateCcw className="h-3 w-3 text-slate-400" />
            <span>RESET</span>
          </button>

          {/* NASA Science Inspector */}
          <button
            type="button"
            onClick={onOpenScienceModal}
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/60 hover:border-cyan-400 text-cyan-300 text-[10px] font-mono font-semibold transition-colors whitespace-nowrap"
            title="Open NASA Primary Sources & Equations Inspector"
          >
            <BookOpen className="h-3 w-3 text-cyan-400" />
            <span>NASA SPECS</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. 6 PRIMARY INSTRUMENT GAUGES (Untruncated, Compact grid-cols-6) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-1.5 p-2 bg-[#0B1120]">
        {/* GAUGE 1: SOLAR & BATTERY */}
        <GaugeCard
          id="gauge-battery"
          title="SOLAR & BATTERY"
          citationId="lola_shackleton_eclipse"
          icon={<Sun className="h-3.5 w-3.5 text-amber-400" />}
          accentColor="#F59E0B"
          isFlipped={!!flippedGauges['battery']}
          onToggleFlip={() => toggleFlip('battery')}
          onInspectCitation={onInspectCitation}
          primaryValue={`${state.batteryKwh.toFixed(1)} / ${state.maxBatteryKwh.toFixed(0)} kWh`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Net Flow:</span>
                <span
                  className={
                    state.lastFlows.netBatteryKw >= 0
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {state.lastFlows.netBatteryKw >= 0 ? '+' : ''}
                  {state.lastFlows.netBatteryKw.toFixed(1)} kW
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[9px]">
                <span>Array: {state.lastFlows.solarGeneratedKw.toFixed(1)} kW</span>
                <span>Load: {state.lastFlows.totalLoadKw.toFixed(1)} kW</span>
              </div>
            </div>
          }
          barPercent={(state.batteryKwh / state.maxBatteryKwh) * 100}
          barColor={
            state.batteryKwh < 30
              ? 'bg-red-500'
              : state.batteryKwh < 70
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }
          extraFooter={
            <span className="text-[9px] text-amber-400/80 font-mono truncate">
              Illum: {(env.solarIlluminationFactor * 100).toFixed(0)}% (LOLA Mask)
            </span>
          }
        />

        {/* GAUGE 2: WATER SHIELD/TANK */}
        <GaugeCard
          id="gauge-water"
          title="WATER SHIELD/TANK"
          citationId="crater_oltaris_waterwall"
          icon={<Shield className="h-3.5 w-3.5 text-cyan-400" />}
          accentColor="#06B6D4"
          isFlipped={!!flippedGauges['water']}
          onToggleFlip={() => toggleFlip('water')}
          onInspectCitation={onInspectCitation}
          warningBadge={
            isTankStarved ? (
              <div className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-amber-950/90 border border-amber-500/70 text-amber-300 font-bold tracking-tighter truncate animate-pulse text-center">
                TANK LOW (&lt;200L): CROP &amp; OGA STARVED
              </div>
            ) : undefined
          }
          primaryValue={`${state.controls.shelterWallWaterLiters.toFixed(0)} L / ${state.activeTankWaterLiters.toFixed(0)} L`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Wall Areal:</span>
                <span className="text-cyan-300 font-bold">
                  {state.lastFlows.waterWallArealDensityGPerCm2.toFixed(1)} g/cm²
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[9px]">
                <span>Atten: {state.lastFlows.shieldAttenuationPct.toFixed(1)}%</span>
                <span
                  className={
                    state.controls.crewInStormShelter ? 'text-emerald-400 font-bold' : 'text-amber-400'
                  }
                >
                  {state.controls.crewInStormShelter ? 'SHELTERED' : 'CABIN CORE'}
                </span>
              </div>
            </div>
          }
          barPercent={(state.controls.shelterWallWaterLiters / 500) * 100}
          barColor={isTankStarved ? 'bg-amber-500' : 'bg-cyan-500'}
          extraFooter={
            <span className="text-[9px] text-slate-400 font-mono truncate">
              Conserved: {state.totalSystemWaterLiters.toFixed(0)} L
            </span>
          }
        />

        {/* GAUGE 3: CABIN O2 & CO2 */}
        <GaugeCard
          id="gauge-gas"
          title="CABIN O2 & CO2"
          citationId="bvad_metabolism"
          icon={<Wind className="h-3.5 w-3.5 text-emerald-400" />}
          accentColor="#10B981"
          isFlipped={!!flippedGauges['gas']}
          onToggleFlip={() => toggleFlip('gas')}
          onInspectCitation={onInspectCitation}
          primaryValue={`${state.cabinO2Kg.toFixed(2)} kg | ${state.cabinCo2MmHg.toFixed(2)} mmHg`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">CO2 Rate:</span>
                {netCo2RateMmHgPerHr > 0.005 ? (
                  <span className="text-red-400 font-bold animate-pulse text-[9px]">
                    +{netCo2RateMmHgPerHr.toFixed(2)} mmHg/h RISING
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold text-[9px]">
                    {netCo2RateMmHgPerHr.toFixed(2)} mmHg/h (OK)
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>O2 Gen: +{state.lastFlows.o2GeneratedKgPerHr.toFixed(2)}</span>
                <span
                  className={
                    state.cabinCo2MmHg >= 7.5
                      ? 'text-red-400 font-bold'
                      : state.cabinCo2MmHg >= 4.0
                      ? 'text-amber-400 font-bold'
                      : 'text-emerald-400'
                  }
                >
                  {state.cabinCo2MmHg >= 7.5
                    ? 'FAIL (≥7.5)'
                    : state.cabinCo2MmHg >= 4.0
                    ? 'WARN (≥4.0)'
                    : 'NOMINAL (<2.0)'}
                </span>
              </div>
            </div>
          }
          barPercent={Math.min(100, (state.cabinCo2MmHg / 7.5) * 100)}
          barColor={
            state.cabinCo2MmHg >= 7.5
              ? 'bg-red-500'
              : state.cabinCo2MmHg >= 4.0
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }
          extraFooter={
            <span className="text-[9px] text-slate-400 font-mono truncate">
              BVAD: {state.crewCount} Astronauts
            </span>
          }
        />

        {/* GAUGE 4: RADIATION DOSE */}
        <GaugeCard
          id="gauge-radiation"
          title="RADIATION DOSE"
          citationId="aug1972_spe_flux"
          icon={<Activity className="h-3.5 w-3.5 text-red-400" />}
          accentColor="#EF4444"
          isFlipped={!!flippedGauges['radiation']}
          onToggleFlip={() => toggleFlip('radiation')}
          onInspectCitation={onInspectCitation}
          primaryValue={`${state.lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Cumulative:</span>
                <span
                  className={
                    state.cumulativeRadiationMsv >= 75
                      ? 'text-red-400 font-bold'
                      : state.cumulativeRadiationMsv >= 25
                      ? 'text-amber-400 font-bold'
                      : 'text-cyan-400'
                  }
                >
                  {state.cumulativeRadiationMsv.toFixed(2)} / 75 mSv
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>Free-space: {env.unshieldedDoseRateMsvPerHr.toFixed(1)}</span>
                <span>{Math.round(env.protonFluxPfu).toLocaleString()} pfu</span>
              </div>
            </div>
          }
          barPercent={Math.min(100, (state.cumulativeRadiationMsv / 75.0) * 100)}
          barColor={
            state.cumulativeRadiationMsv >= 75
              ? 'bg-red-600 animate-pulse'
              : state.cumulativeRadiationMsv >= 25
              ? 'bg-amber-500'
              : 'bg-cyan-500'
          }
          extraFooter={
            <span className="text-[9px] text-red-400/80 font-mono truncate">
              Aug 1972 SPE Peak: 142 mSv/h
            </span>
          }
        />

        {/* GAUGE 5: HYDROPONIC BAY */}
        <GaugeCard
          id="gauge-crops"
          title="HYDROPONIC BAY"
          citationId="veggie_hydroponics"
          icon={<Sprout className="h-3.5 w-3.5 text-emerald-400" />}
          accentColor="#10B981"
          isFlipped={!!flippedGauges['crops']}
          onToggleFlip={() => toggleFlip('crops')}
          onInspectCitation={onInspectCitation}
          warningBadge={
            isTankStarved ? (
              <div className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-amber-950/90 border border-amber-500/70 text-amber-300 font-bold tracking-tighter truncate animate-pulse text-center">
                TANK LOW (&lt;200L): CROP &amp; OGA STARVED
              </div>
            ) : undefined
          }
          primaryValue={`${state.cropHealthPct.toFixed(0)}% | ${state.foodBufferKcal.toFixed(0)} kcal`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Net Calories:</span>
                <span
                  className={
                    state.lastFlows.foodProducedKcalPerHr >= state.lastFlows.foodConsumedKcalPerHr
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {(
                    state.lastFlows.foodProducedKcalPerHr - state.lastFlows.foodConsumedKcalPerHr
                  ).toFixed(0)}{' '}
                  kcal/h
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>PAR: {state.controls.hydroponicsThrottlePct}%</span>
                <span
                  className={
                    state.cropHealthPct > 70
                      ? 'text-emerald-400'
                      : state.cropHealthPct > 35
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }
                >
                  {state.cropHealthPct > 70
                    ? 'HEALTHY'
                    : state.cropHealthPct > 35
                    ? 'STRESSED'
                    : 'WILTING'}
                </span>
              </div>
            </div>
          }
          barPercent={state.cropHealthPct}
          barColor={
            state.cropHealthPct < 30
              ? 'bg-red-500'
              : state.cropHealthPct < 70
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }
          extraFooter={
            <span className="text-[9px] text-emerald-400/80 font-mono truncate">
              VEGGIE/APH 12m² Bay
            </span>
          }
        />

        {/* GAUGE 6: THERMAL & H2 BLEED */}
        <GaugeCard
          id="gauge-thermal"
          title="THERMAL & H2 BLEED"
          citationId="nasa_std_3001"
          secondaryCitationId="bvad_electrolysis_sabatier"
          icon={<Thermometer className="h-3.5 w-3.5 text-purple-400" />}
          accentColor="#A855F7"
          isFlipped={!!flippedGauges['thermal']}
          onToggleFlip={() => toggleFlip('thermal')}
          onInspectCitation={onInspectCitation}
          primaryValue={`${state.cabinTempC.toFixed(1)} °C | ${state.lastFlows.sabatierWaterBleedEquivLPerHr.toFixed(3)} L/h`}
          subValue={
            <div className="space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Sabatier Vent:</span>
                <span
                  className={
                    state.controls.methanePyrolysisActive
                      ? 'text-emerald-400 font-bold'
                      : state.controls.sabatierActive
                      ? 'text-purple-400 font-bold animate-pulse'
                      : 'text-slate-400'
                  }
                >
                  {state.controls.methanePyrolysisActive
                    ? '0 BLEED'
                    : state.controls.sabatierActive
                    ? 'VENTING CH4'
                    : 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>Ext: {env.surfaceTempK} K</span>
                <span>Bleed: {state.cumulativeWaterBleedLiters.toFixed(2)} L</span>
              </div>
            </div>
          }
          barPercent={Math.max(0, Math.min(100, ((state.cabinTempC - 10) / 25) * 100))}
          barColor={
            state.cabinTempC < 15 || state.cabinTempC > 30 ? 'bg-red-500' : 'bg-purple-500'
          }
          extraFooter={
            <span className="text-[9px] text-purple-400/80 font-mono truncate">
              STD-3001 [15°C, 30°C]
            </span>
          }
        />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. 72-HOUR TIMELINE SCRUBBER (Compact h-14 / 56px SVG) */}
      {/* ------------------------------------------------------------- */}
      <div className="px-3 py-1.5 bg-[#080C14] border-t border-[#1E293B]">
        {/* Timeline Header Row with Phase & Legend */}
        <div className="flex items-center justify-between text-[10px] font-mono mb-1 gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className="text-cyan-400 font-bold tracking-wider uppercase text-[10px]">
              72H PROFILE
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-semibold truncate">{env.phaseLabel}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[9px] text-slate-400">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-0.5 bg-amber-400 rounded" />
              <span>Solar (LOLA Mask)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-0.5 bg-red-500 rounded" />
              <span>SPE Dose Rate</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-slate-800 border border-dashed border-slate-600" />
              <span>T+12h-58h Eclipse</span>
            </div>
          </div>
        </div>

        {/* SVG Sparkline Scrubber (h-14 = 56px) */}
        <div className="relative w-full rounded border border-[#1E293B] bg-[#0A0F1D] overflow-hidden">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-14 block cursor-pointer"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={amberGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id={crimsonGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
              </linearGradient>

              <pattern
                id="eclipse-hatch"
                width="6"
                height="6"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="#334155" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Interval Grid Guides */}
            {[0, 12, 24, 36, 48, 60, 72].map((h) => {
              const gx = paddingX + (h / 72) * graphWidth;
              return (
                <g key={`grid-line-${h}`}>
                  <line
                    x1={gx}
                    y1={paddingY}
                    x2={gx}
                    y2={svgHeight - paddingY}
                    stroke="#1E293B"
                    strokeWidth="1"
                    strokeDasharray={h === 0 || h === 72 ? 'none' : '2 2'}
                  />
                  <text
                    x={gx}
                    y={svgHeight - 1}
                    fill="#64748B"
                    fontSize="7.5"
                    fontFamily="monospace"
                    textAnchor={h === 0 ? 'start' : h === 72 ? 'end' : 'middle'}
                  >
                    T+{h}h
                  </text>
                </g>
              );
            })}

            {/* Eclipse Backdrop (T+12h to T+58h) */}
            <rect
              x={eclipseStartX}
              y={paddingY}
              width={eclipseWidth}
              height={graphHeight}
              fill="url(#eclipse-hatch)"
              opacity="0.3"
            />
            <rect
              x={eclipseStartX}
              y={paddingY}
              width={eclipseWidth}
              height={graphHeight}
              fill="#0F172A"
              opacity="0.4"
            />
            <text
              x={eclipseStartX + eclipseWidth / 2}
              y={paddingY + 9}
              fill="#94A3B8"
              fontSize="7"
              fontFamily="monospace"
              textAnchor="middle"
            >
              [ SHACKLETON HORIZON ECLIPSE 46h ]
            </text>

            {/* SPE Peak Backdrop (T+15h to T+38h) */}
            <rect
              x={speStartX}
              y={paddingY}
              width={speWidth}
              height={graphHeight}
              fill="#EF4444"
              opacity="0.1"
            />
            <line
              x1={speStartX}
              y1={paddingY}
              x2={speStartX}
              y2={svgHeight - paddingY}
              stroke="#EF4444"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1={speEndX}
              y1={paddingY}
              x2={speEndX}
              y2={svgHeight - paddingY}
              stroke="#EF4444"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />

            {/* 1. Amber Solar Illumination Area & Curve */}
            <path d={solarAreaD} fill={`url(#${amberGradId})`} />
            <path
              d={solarPathD}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 2. Crimson Radiation Dose Area & Curve */}
            <path d={radAreaD} fill={`url(#${crimsonGradId})`} />
            <path
              d={radPathD}
              fill="none"
              stroke="#EF4444"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active Playhead */}
            <g transform={`translate(${playheadX}, 0)`}>
              <line
                x1="0"
                y1={paddingY - 2}
                x2="0"
                y2={svgHeight - paddingY + 2}
                stroke="#38BDF8"
                strokeWidth="1.5"
                className="drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]"
              />
              <polygon points="-3,2 3,2 0,7" fill="#38BDF8" />
              <polygon
                points={`-3,${svgHeight - paddingY} 3,${svgHeight - paddingY} 0,${
                  svgHeight - paddingY - 5
                }`}
                fill="#38BDF8"
              />
            </g>
          </svg>

          {/* Floating Time indicator on playhead */}
          <div
            className="absolute top-0.5 pointer-events-none transform -translate-x-1/2"
            style={{ left: `${(playheadX / svgWidth) * 100}%` }}
          >
            <span className="px-1 py-0.2 rounded text-[8.5px] font-mono font-bold bg-cyan-950/90 border border-cyan-400 text-cyan-300">
              T+{state.hour}h
            </span>
          </div>
        </div>

        {/* Compact Event Headline Bar */}
        <div className="mt-1 px-2 py-0.5 rounded bg-[#0F172A]/80 border border-[#1E293B] flex items-center justify-between text-[10px] font-mono text-slate-300">
          <div className="truncate flex items-center gap-1.5">
            <span className="text-cyan-400 font-bold whitespace-nowrap">
              T+{state.hour}h EVENT:
            </span>
            <span className="truncate text-slate-200">{env.eventHeadline}</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-400 flex-shrink-0 text-[9px]">
            <span>
              Elev:{' '}
              <span className="text-amber-400 font-bold">
                {env.sunElevationAboveRidgeDeg >= 0 ? '+' : ''}
                {env.sunElevationAboveRidgeDeg.toFixed(1)}°
              </span>
            </span>
            <span>
              Ext Temp: <span className="text-purple-400 font-bold">{env.surfaceTempK} K</span>
            </span>
            <span>
              Proton:{' '}
              <span className="text-red-400 font-bold">
                {Math.round(env.protonFluxPfu).toLocaleString()} pfu
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------------
// GAUGE CARD COMPONENT WITH CITE FLIP-SWITCH
// ---------------------------------------------------------------------------

interface GaugeCardProps {
  id: string;
  title: string;
  citationId: CitationId;
  secondaryCitationId?: CitationId;
  icon: React.ReactNode;
  accentColor: string;
  isFlipped: boolean;
  onToggleFlip: () => void;
  onInspectCitation: (id: CitationId) => void;
  primaryValue: string;
  subValue: React.ReactNode;
  barPercent: number;
  barColor: string;
  extraFooter: React.ReactNode;
  warningBadge?: React.ReactNode;
}

const GaugeCard: React.FC<GaugeCardProps> = ({
  title,
  citationId,
  secondaryCitationId,
  icon,
  accentColor,
  isFlipped,
  onToggleFlip,
  onInspectCitation,
  primaryValue,
  subValue,
  barPercent,
  barColor,
  extraFooter,
  warningBadge,
}) => {
  const citation = NASA_CITATIONS[citationId];
  const secondaryCitation = secondaryCitationId ? NASA_CITATIONS[secondaryCitationId] : null;

  return (
    <div
      className={`relative rounded border bg-[#111827] p-2 transition-all duration-200 shadow-sm flex flex-col justify-between ${
        warningBadge
          ? 'border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
          : isFlipped
          ? 'border-cyan-500/70 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
          : 'border-[#1E293B] hover:border-slate-600'
      }`}
    >
      {/* Front Face: Telemetry View */}
      {!isFlipped ? (
        <div className="flex flex-col h-full justify-between space-y-1.5">
          {/* Card Header with Icon, Title, and [CITE] Flip Switch */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              {icon}
              <span className="text-[10px] md:text-[11px] font-bold font-mono tracking-tight text-slate-300 uppercase whitespace-nowrap">
                {title}
              </span>
            </div>

            {/* Actions: Flip or Inspect */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={onToggleFlip}
                className="px-1 py-0.2 rounded text-[8.5px] font-mono tracking-tighter bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 transition-colors"
                title={`Flip to view formula for ${citation.code}`}
              >
                CITE
              </button>
              <button
                type="button"
                onClick={() => onInspectCitation(citationId)}
                className="p-0.5 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                title={`Open NASA spec for ${citation.code}`}
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>

          {/* Optional Warning Badge (e.g. Tank Low <200L) */}
          {warningBadge && <div>{warningBadge}</div>}

          {/* Primary Metric Reading */}
          <div>
            <div
              className="text-xs md:text-sm font-bold font-mono tracking-tight text-white tabular-nums truncate"
              style={{ color: accentColor }}
            >
              {primaryValue}
            </div>
            <div className="mt-0.5 pt-0.5 border-t border-slate-800/80">{subValue}</div>
          </div>

          {/* Visual Percentage Progress Bar */}
          <div className="space-y-0.5">
            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, barPercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px]">{extraFooter}</div>
          </div>
        </div>
      ) : (
        /* Back Face: NASA Citation & Formula View */
        <div className="flex flex-col h-full justify-between space-y-1.5 bg-[#0C1322] p-1.5 rounded border border-cyan-950">
          <div>
            <div className="flex items-center justify-between border-b border-cyan-900/60 pb-0.5 mb-1">
              <span className="text-[9px] font-mono font-bold text-cyan-300 uppercase flex items-center gap-1">
                <Info className="h-2.5 w-2.5 text-cyan-400" />
                NASA: {citation.code}
              </span>
              <button
                type="button"
                onClick={onToggleFlip}
                className="text-[8.5px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                [BACK]
              </button>
            </div>

            <div className="text-[9px] text-slate-300 font-mono line-clamp-1 font-semibold">
              {citation.documentNumber}
            </div>

            {/* Formula Block */}
            <div className="mt-1 p-1 rounded bg-black/60 border border-slate-800 font-mono text-[8.5px] text-cyan-200 line-clamp-3 leading-tight">
              {citation.formulaUsed}
            </div>

            {secondaryCitation && (
              <div className="mt-0.5 text-[8px] font-mono text-purple-300 truncate">
                + {secondaryCitation.code}
              </div>
            )}
          </div>

          {/* Action to launch full modal */}
          <button
            type="button"
            onClick={() => onInspectCitation(citationId)}
            className="w-full flex items-center justify-center gap-0.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-300 text-[9px] font-mono transition-colors font-semibold"
          >
            <span>FULL SPEC</span>
            <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CrisisHeaderAndTimeline;
