import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Droplets,
  Flame,
  Lock,
  RefreshCw,
  Shield,
  Sprout,
  Thermometer,
  Unlock,
  Wind,
  Zap,
} from 'lucide-react';
import type {
  CitationId,
  CrisisGameState,
  CrisisHourEnvironment,
  ValveAndBreakerControls,
} from '../contracts/types';

export interface MassFlowSchematicProps {
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onInspectCitation: (id: CitationId) => void;
}

const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

export const MassFlowSchematic: React.FC<MassFlowSchematicProps> = ({
  state,
  env,
  onUpdateControls,
  onInspectCitation,
}) => {
  const { controls, lastFlows } = state;

  // Derived visual states
  const solarPct = Math.round(env.solarIlluminationFactor * 100);
  const batteryPct = clamp(
    (state.batteryKwh / Math.max(1, state.maxBatteryKwh)) * 100,
    0,
    100
  );
  const tankMaxRef = Math.max(500, state.totalSystemWaterLiters);
  const tankPct = clamp((state.activeTankWaterLiters / tankMaxRef) * 100, 0, 100);
  const waterStarved = state.activeTankWaterLiters < 200;
  const co2Accumulating = lastFlows.co2ProducedKgPerHr > lastFlows.co2ScrubbedKgPerHr;

  // Sabatier bleed vs closed loop
  const isBleedActive = controls.sabatierActive && !controls.methanePyrolysisActive;
  const isClosedLoop = controls.sabatierActive && controls.methanePyrolysisActive;

  // Water-wall visual thickness (scales 3px to 24px across 0-500 L)
  const jacketStrokeWidth = 3 + (clamp(controls.shelterWallWaterLiters, 0, 500) / 500) * 21;
  const protonIntensity = clamp(Math.log10(Math.max(1, env.protonFluxPfu)) / 4, 0.12, 1);
  const isProtonStorm = env.protonFluxPfu >= 100 || env.unshieldedDoseRateMsvPerHr >= 5;

  // Power estimates for throttle sliders
  const electrolysisKw = ((controls.electrolysisThrottlePct / 100) * 1.65).toFixed(2);
  const hydroponicsKw = ((controls.hydroponicsThrottlePct / 100) * 14.0).toFixed(1);
  const thermalKw = ((controls.thermalLoopPct / 100) * 4.2).toFixed(2);

  // Pipe stroke widths proportional to flow
  const solarPipeW = 1.5 + clamp(lastFlows.solarGeneratedKw / 20, 0, 1) * 3.5;
  const o2PipeW = 1.5 + clamp(lastFlows.o2GeneratedKgPerHr / 0.5, 0, 1) * 3;
  const hydroPipeW = 1.2 + (controls.hydroponicsThrottlePct / 100) * 2.8;
  const crossFeedW = 1.5 + (controls.shelterWallWaterLiters / 500) * 4;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 shadow-2xl">
      {/* Top Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] pb-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#06B6D4] shadow-[0_0_8px_#06B6D4]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-200">
            ECLSS Mass-Flow &amp; Power Bus Schematic — Closed-Loop Water &amp; Sabatier Telemetry
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-slate-400">
          <span>
            TOTAL H2O:{' '}
            <strong className="text-cyan-300">
              {state.totalSystemWaterLiters.toFixed(1)} L
            </strong>
          </span>
          <span>
            CUMULATIVE CH4 BLEED:{' '}
            <strong className={state.cumulativeWaterBleedLiters > 10 ? 'text-purple-400' : 'text-slate-200'}>
              -{state.cumulativeWaterBleedLiters.toFixed(2)} L
            </strong>
          </span>
          <span>
            NET BUS:{' '}
            <strong className={lastFlows.netBatteryKw >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {lastFlows.netBatteryKw >= 0 ? '+' : ''}
              {lastFlows.netBatteryKw.toFixed(2)} kW
            </strong>
          </span>
        </div>
      </div>

      {/* Side-by-Side Main Grid: SVG Schematic (Left ~58%) + Valve & Breaker Deck (Right ~42%) */}
      <div className="grid grid-cols-1 items-start gap-2.5 lg:grid-cols-12">
        {/* 1. Interactive SVG Mass-Flow & Pipe Schematic */}
        <div className="relative w-full overflow-hidden rounded-md border border-[#1E293B] bg-[#090D16] lg:col-span-7">
          <svg
            viewBox="0 0 960 430"
            className="h-auto max-h-[375px] w-full select-none"
            role="img"
            aria-label="Interactive ECLSS Mass-Flow and Water-Wall Radiation Schematic"
          >
          <defs>
            {/* Subtle instrument grid */}
            <pattern id="tacticalGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="#1E293B"
                strokeWidth="0.6"
                strokeOpacity="0.45"
              />
            </pattern>

            <marker id="arrowAmber" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#F59E0B" />
            </marker>
            <marker id="arrowCyan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#06B6D4" />
            </marker>
            <marker id="arrowEmerald" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#10B981" />
            </marker>
            <marker id="arrowViolet" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#A855F7" />
            </marker>
            <marker id="arrowCrimson" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444" />
            </marker>
          </defs>

          {/* Background */}
          <rect width="960" height="430" fill="#090D16" />
          <rect width="960" height="430" fill="url(#tacticalGrid)" />

          {/* ================= PIPES & FLOW PATHS ================= */}

          {/* Power Bus: Node A (Solar/RFC) -> B, C, D, E */}
          <g opacity={lastFlows.solarGeneratedKw > 0.2 || state.batteryKwh > 1 ? 0.9 : 0.3}>
            {/* Main Amber Power Trunk */}
            <path
              d="M 220 90 L 305 90 L 305 125 L 340 125"
              fill="none"
              stroke="#F59E0B"
              strokeWidth={solarPipeW}
              strokeDasharray="8 6"
              className="animate-pipe-flow"
              markerEnd="url(#arrowAmber)"
            />
            {/* A -> D (14 kW PAR LED Bus) */}
            <path
              d="M 120 156 L 120 264"
              fill="none"
              stroke="#F59E0B"
              strokeWidth={1.5 + (controls.hydroponicsThrottlePct / 100) * 2.5}
              strokeDasharray="7 5"
              className={controls.hydroponicsThrottlePct > 0 ? 'animate-pipe-flow' : ''}
              opacity={controls.hydroponicsThrottlePct > 0 ? 0.9 : 0.25}
              markerEnd="url(#arrowAmber)"
            />
            <rect x="64" y="198" width="112" height="18" rx="3" fill="#090D16" stroke="#78350F" strokeWidth="1" />
            <text x="120" y="210" textAnchor="middle" fill="#FBBF24" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              PAR LED {hydroponicsKw} kW
            </text>

            {/* A -> E (Cabin & Thermal Power Bus) */}
            <path
              d="M 220 56 L 780 56 L 780 185"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.8"
              strokeDasharray="6 6"
              className="animate-pipe-flow"
              opacity="0.55"
              markerEnd="url(#arrowAmber)"
            />
            <rect x="435" y="46" width="150" height="18" rx="3" fill="#090D16" stroke="#78350F" strokeWidth="1" />
            <text x="510" y="58" textAnchor="middle" fill="#FBBF24" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              LOAD {lastFlows.totalLoadKw.toFixed(1)} kW / GEN {lastFlows.solarGeneratedKw.toFixed(1)} kW
            </text>
          </g>

          {/* Node B (ECLSS Tank/OGA) -> Node C (Sabatier): H2 Feed */}
          <path
            d="M 555 112 L 625 112"
            fill="none"
            stroke="#06B6D4"
            strokeWidth={o2PipeW}
            strokeDasharray="6 6"
            className={controls.electrolysisThrottlePct > 0 && controls.sabatierActive ? 'animate-pipe-flow' : ''}
            opacity={controls.electrolysisThrottlePct > 0 && controls.sabatierActive ? 0.95 : 0.25}
            markerEnd="url(#arrowCyan)"
          />
          <text x="590" y="104" textAnchor="middle" fill="#22D3EE" fontSize="9" fontFamily="JetBrains Mono, monospace">
            2H2
          </text>

          {/* Node C (Sabatier) -> Node B (ECLSS Tank): Condensed 2H2O Return */}
          <path
            d="M 625 142 L 555 142"
            fill="none"
            stroke="#06B6D4"
            strokeWidth={controls.sabatierActive ? 3 : 1.5}
            strokeDasharray="8 4"
            className={controls.sabatierActive ? 'animate-pipe-flow' : ''}
            opacity={controls.sabatierActive ? 0.95 : 0.2}
            markerEnd="url(#arrowCyan)"
          />
          <text x="590" y="156" textAnchor="middle" fill="#22D3EE" fontSize="9" fontFamily="JetBrains Mono, monospace">
            2H2O REC
          </text>

          {/* Node C -> OVERBOARD CH4 VENT OR CLOSED-LOOP PYROLYSIS */}
          {isBleedActive ? (
            <g>
              <path
                d="M 855 108 L 938 108"
                fill="none"
                stroke="#A855F7"
                strokeWidth="4.5"
                strokeDasharray="8 5"
                className="animate-pipe-flow"
                markerEnd="url(#arrowViolet)"
              />
              <rect x="862" y="72" width="92" height="28" rx="3" fill="#2E1065" stroke="#A855F7" strokeWidth="1" />
              <text x="908" y="84" textAnchor="middle" fill="#E9D5FF" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                CH4 VENT BLEED
              </text>
              <text x="908" y="95" textAnchor="middle" fill="#C084FC" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                -{lastFlows.sabatierWaterBleedEquivLPerHr.toFixed(2)} L/hr
              </text>
            </g>
          ) : isClosedLoop ? (
            <g>
              {/* Sealed vent stub */}
              <path d="M 855 108 L 892 108" fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="3 3" />
              <line x1="892" y1="99" x2="892" y2="117" stroke="#10B981" strokeWidth="3" />
              <text x="922" y="111" textAnchor="middle" fill="#34D399" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                SEALED
              </text>
              {/* Closed Loop H2 Pyrolysis Return Arc */}
              <path
                d="M 740 165 L 740 182 L 450 182 L 450 168"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeDasharray="8 5"
                className="animate-pipe-flow"
                markerEnd="url(#arrowEmerald)"
              />
              <rect x="520" y="173" width="165" height="17" rx="3" fill="#064E3B" stroke="#10B981" strokeWidth="1" />
              <text x="602" y="185" textAnchor="middle" fill="#6EE7B7" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                PYROLYSIS LOOP CLOSED (+H2)
              </text>
            </g>
          ) : (
            <g opacity="0.45">
              <path d="M 855 108 L 910 108" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
              <text x="908" y="98" textAnchor="middle" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
                SABATIER OFF
              </text>
            </g>
          )}

          {/* Node B -> Node D: Irrigation H2O */}
          <path
            d="M 380 168 L 380 282 L 265 282"
            fill="none"
            stroke={waterStarved ? '#EF4444' : '#06B6D4'}
            strokeWidth={hydroPipeW}
            strokeDasharray="7 5"
            className={`${controls.hydroponicsThrottlePct > 0 && state.activeTankWaterLiters > 0 ? 'animate-pipe-flow' : ''} ${waterStarved ? 'animate-pulse' : ''}`}
            opacity={controls.hydroponicsThrottlePct > 0 ? 0.9 : 0.25}
            markerEnd={waterStarved ? 'url(#arrowCrimson)' : 'url(#arrowCyan)'}
          />
          <rect x="275" y="272" width="102" height="17" rx="3" fill={waterStarved ? '#450A0A' : '#090D16'} stroke={waterStarved ? '#EF4444' : '#164E63'} strokeWidth="1" />
          <text
            x="326"
            y="284"
            textAnchor="middle"
            fill={waterStarved ? '#FCA5A5' : '#22D3EE'}
            fontSize="8.5"
            fontWeight={waterStarved ? '700' : '400'}
            fontFamily="JetBrains Mono, monospace"
          >
            {waterStarved ? 'STARVED <200L' : 'IRRIGATION H2O'}
          </text>

          {/* Node D -> Node E: Bio-Regen O2 + Kcal */}
          <path
            d="M 265 352 L 580 352"
            fill="none"
            stroke="#10B981"
            strokeWidth={1.5 + clamp(lastFlows.foodProducedKcalPerHr / 300, 0, 1) * 2.5}
            strokeDasharray="7 5"
            className={controls.hydroponicsThrottlePct > 0 ? 'animate-pipe-flow' : ''}
            opacity={controls.hydroponicsThrottlePct > 0 ? 0.9 : 0.25}
            markerEnd="url(#arrowEmerald)"
          />
          <rect x="345" y="343" width="160" height="18" rx="3" fill="#090D16" stroke="#065F46" strokeWidth="1" />
          <text x="425" y="355" textAnchor="middle" fill="#34D399" fontSize="9" fontFamily="JetBrains Mono, monospace">
            BIO O2 + {lastFlows.foodProducedKcalPerHr.toFixed(0)} kcal/hr
          </text>

          {/* Node B -> Node E: O2 Supply & Water-Wall Cross-Feed */}
          <path
            d="M 480 168 L 480 245 L 595 245"
            fill="none"
            stroke="#06B6D4"
            strokeWidth={o2PipeW}
            strokeDasharray="7 5"
            className="animate-pipe-flow"
            markerEnd="url(#arrowCyan)"
          />
          <rect x="492" y="236" width="96" height="17" rx="3" fill="#090D16" stroke="#164E63" strokeWidth="1" />
          <text x="540" y="248" textAnchor="middle" fill="#22D3EE" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
            O2 {lastFlows.o2GeneratedKgPerHr.toFixed(2)} kg/h
          </text>

          {/* Cross-Feed Water-Wall Pipe (B <-> E) */}
          <path
            d="M 455 168 L 455 298 L 586 298"
            fill="none"
            stroke="#38BDF8"
            strokeWidth={crossFeedW}
            strokeDasharray="10 4"
            className={controls.shelterWallWaterLiters > 0 ? 'animate-pipe-flow' : ''}
            opacity={controls.shelterWallWaterLiters > 0 ? 0.95 : 0.25}
            markerEnd="url(#arrowCyan)"
          />
          <rect x="464" y="289" width="114" height="17" rx="3" fill="#0C4A6E" stroke="#38BDF8" strokeWidth="1" />
          <text x="521" y="301" textAnchor="middle" fill="#BAE6FD" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
            WALL PUMP: {controls.shelterWallWaterLiters.toFixed(0)} L
          </text>

          {/* Node E -> Node C: Cabin CO2 Exhaust */}
          <path
            d="M 740 198 L 740 168"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.2"
            strokeDasharray="5 4"
            className={controls.sabatierActive ? 'animate-pipe-flow' : ''}
            markerEnd="url(#arrowAmber)"
          />
          <text x="772" y="186" textAnchor="middle" fill="#CBD5E1" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
            CO2 {lastFlows.co2ProducedKgPerHr.toFixed(2)}
          </text>

          {/* ================= 5 PHYSICAL NODES ================= */}

          {/* NODE A: SHACKLETON SOLAR & RFC BATTERY BUS */}
          <g transform="translate(20, 22)">
            <rect
              width="200"
              height="134"
              rx="6"
              fill="#111827"
              stroke={solarPct > 20 ? '#F59E0B' : '#475569'}
              strokeWidth="1.5"
            />
            <rect width="200" height="24" rx="5" fill="#1E293B" />
            <text x="10" y="16" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              A // SOLAR &amp; RFC BUS
            </text>
            {/* Sun & Illumination */}
            <text x="10" y="42" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              LOLA SUN MASK:
            </text>
            <text x="190" y="42" textAnchor="end" fill={solarPct > 15 ? '#FBBF24' : '#94A3B8'} fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {solarPct}% ({env.sunElevationAboveRidgeDeg >= 0 ? '+' : ''}{env.sunElevationAboveRidgeDeg.toFixed(2)}°)
            </text>
            <text x="10" y="59" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              ARRAY OUTPUT:
            </text>
            <text x="190" y="59" textAnchor="end" fill="#F8FAFC" fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {lastFlows.solarGeneratedKw.toFixed(2)} kW
            </text>

            {/* Battery Gauge */}
            <text x="10" y="79" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              RFC BATTERY:
            </text>
            <text
              x="190"
              y="79"
              textAnchor="end"
              fill={batteryPct < 20 ? '#EF4444' : '#34D399'}
              fontSize="10.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {state.batteryKwh.toFixed(1)} / {state.maxBatteryKwh} kWh
            </text>
            <rect x="10" y="86" width="180" height="10" rx="2" fill="#090D16" stroke="#334155" strokeWidth="1" />
            <rect
              x="11"
              y="87"
              width={Math.max(0, (178 * batteryPct) / 100)}
              height="8"
              rx="1.5"
              fill={batteryPct < 20 ? '#EF4444' : batteryPct < 45 ? '#F59E0B' : '#10B981'}
            />

            {/* Cite Button */}
            <g
              transform="translate(10, 105)"
              className="cursor-pointer"
              onClick={() => onInspectCitation('lola_shackleton_eclipse')}
            >
              <rect width="180" height="20" rx="3" fill="#0F172A" stroke="#F59E0B" strokeOpacity="0.55" strokeWidth="1" />
              <text x="90" y="13.5" textAnchor="middle" fill="#FBBF24" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                [CITE: LOLA #5027]
              </text>
            </g>
          </g>

          {/* NODE B: ACTIVE ECLSS WATER TANK & OGA ELECTROLYSIS */}
          <g transform="translate(340, 68)">
            <rect
              width="215"
              height="100"
              rx="6"
              fill="#111827"
              stroke={waterStarved ? '#EF4444' : '#06B6D4'}
              strokeWidth="1.5"
            />
            <rect width="215" height="22" rx="5" fill="#1E293B" />
            <text x="10" y="15" fill="#22D3EE" fontSize="9.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              B // ECLSS TANK &amp; OGA (2H2O→2H2+O2)
            </text>

            {/* Mini Liquid Level Tank Graphic */}
            <rect x="10" y="30" width="32" height="58" rx="3" fill="#090D16" stroke="#0891B2" strokeWidth="1.2" />
            <rect
              x="12"
              y={32 + (54 * (100 - tankPct)) / 100}
              width="28"
              height={(54 * tankPct) / 100}
              rx="1.5"
              fill={waterStarved ? '#EF4444' : '#06B6D4'}
              fillOpacity="0.8"
            />
            <text x="26" y="63" textAnchor="middle" fill="#F8FAFC" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {Math.round(tankPct)}%
            </text>

            <text x="50" y="42" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              ACTIVE TANK:
            </text>
            <text
              x="205"
              y="42"
              textAnchor="end"
              fill={waterStarved ? '#F87171' : '#22D3EE'}
              fontSize="10.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {state.activeTankWaterLiters.toFixed(1)} L
            </text>

            <text x="50" y="58" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              OGA O2 GEN:
            </text>
            <text x="205" y="58" textAnchor="end" fill="#F8FAFC" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {lastFlows.o2GeneratedKgPerHr.toFixed(2)} kg/hr
            </text>

            {/* Cite Button */}
            <g
              transform="translate(50, 70)"
              className="cursor-pointer"
              onClick={() => onInspectCitation('bvad_electrolysis_sabatier')}
            >
              <rect width="155" height="20" rx="3" fill="#0F172A" stroke="#06B6D4" strokeOpacity="0.6" strokeWidth="1" />
              <text x="77.5" y="13.5" textAnchor="middle" fill="#22D3EE" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                [CITE: BVAD 4.3]
              </text>
            </g>
          </g>

          {/* NODE C: SABATIER REACTOR & METHANE VENT */}
          <g transform="translate(625, 68)">
            <rect
              width="230"
              height="100"
              rx="6"
              fill="#111827"
              stroke={isBleedActive ? '#A855F7' : isClosedLoop ? '#10B981' : '#475569'}
              strokeWidth="1.5"
            />
            <rect width="230" height="22" rx="5" fill="#1E293B" />
            <text
              x="10"
              y="15"
              fill={isBleedActive ? '#C084FC' : isClosedLoop ? '#34D399' : '#94A3B8'}
              fontSize="9.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              C // SABATIER (CO2+4H2→CH4↑+2H2O)
            </text>

            <text x="10" y="42" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              REACTOR MODE:
            </text>
            <text
              x="220"
              y="42"
              textAnchor="end"
              fill={isBleedActive ? '#C084FC' : isClosedLoop ? '#34D399' : '#94A3B8'}
              fontSize="9.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {isBleedActive ? 'OPEN VENT BLEED' : isClosedLoop ? 'PYROLYSIS CLOSED' : 'STANDBY / OFF'}
            </text>

            <text x="10" y="59" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              CO2 SCRUBBED:
            </text>
            <text x="220" y="59" textAnchor="end" fill="#F8FAFC" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {lastFlows.co2ScrubbedKgPerHr.toFixed(2)} kg/hr
            </text>

            <text x="10" y="76" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              H2O BLEED LOSS:
            </text>
            <text
              x="220"
              y="76"
              textAnchor="end"
              fill={isBleedActive ? '#E879F9' : '#34D399'}
              fontSize="10"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {isBleedActive ? `-${lastFlows.sabatierWaterBleedEquivLPerHr.toFixed(2)} L/hr` : '0.00 L/hr'}
            </text>

            <text x="10" y="92" fill="#64748B" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
              H2O RECOVERED: +{lastFlows.waterRecoveredLPerHr.toFixed(2)} L/hr
            </text>
          </g>

          {/* NODE D: VEGGIE / APH HYDROPONIC SALAD & WHEAT BAY */}
          <g transform="translate(20, 264)">
            <rect
              width="245"
              height="146"
              rx="6"
              fill="#111827"
              stroke={waterStarved ? '#EF4444' : '#10B981'}
              strokeWidth={waterStarved ? '2.2' : '1.5'}
              className={waterStarved ? 'animate-pulse' : ''}
            />
            <rect width="245" height="24" rx="5" fill={waterStarved ? '#450A0A' : '#1E293B'} />
            <text x="10" y="16" fill={waterStarved ? '#FCA5A5' : '#34D399'} fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              D // VEGGIE HYDROPONIC BAY
            </text>

            <text x="10" y="42" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              CROP HEALTH:
            </text>
            <text
              x="235"
              y="42"
              textAnchor="end"
              fill={state.cropHealthPct < 50 ? '#EF4444' : '#34D399'}
              fontSize="10.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {state.cropHealthPct.toFixed(0)}%
            </text>

            <text x="10" y="59" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              KCAL OUTPUT:
            </text>
            <text x="235" y="59" textAnchor="end" fill="#F8FAFC" fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {lastFlows.foodProducedKcalPerHr.toFixed(0)} kcal/hr
            </text>

            <text x="10" y="76" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
              PAR LED ARRAY:
            </text>
            <text x="235" y="76" textAnchor="end" fill="#FBBF24" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {hydroponicsKw} / 14 kW ({controls.hydroponicsThrottlePct}%)
            </text>

            {/* Water Starvation Warning Banner */}
            {waterStarved ? (
              <g transform="translate(10, 86)" className="animate-pulse">
                <rect width="225" height="22" rx="3" fill="#450A0A" stroke="#EF4444" strokeWidth="1.2" />
                <text x="112.5" y="14.5" textAnchor="middle" fill="#FCA5A5" fontSize="8.8" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                  WATER STARVED: &lt;200L TANK
                </text>
              </g>
            ) : (
              <g transform="translate(10, 86)">
                <rect width="225" height="22" rx="3" fill="#064E3B" fillOpacity="0.4" stroke="#065F46" strokeWidth="1" />
                <text x="112.5" y="14.5" textAnchor="middle" fill="#6EE7B7" fontSize="9" fontFamily="JetBrains Mono, monospace">
                  HYDROPONIC IRRIGATION NOMINAL
                </text>
              </g>
            )}

            {/* Cite Button */}
            <g
              transform="translate(10, 116)"
              className="cursor-pointer"
              onClick={() => onInspectCitation('veggie_hydroponics')}
            >
              <rect width="225" height="20" rx="3" fill="#0F172A" stroke="#10B981" strokeOpacity="0.6" strokeWidth="1" />
              <text x="112.5" y="13.5" textAnchor="middle" fill="#34D399" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                [CITE: OSDR VEGGIE]
              </text>
            </g>
          </g>

          {/* NODE E: CREW CABIN & WATER-WALL STORM SHELTER JACKET */}
          <g transform="translate(580, 198)">
            {/* Outer Panel */}
            <rect
              width="360"
              height="212"
              rx="6"
              fill="#111827"
              stroke={isProtonStorm ? '#EF4444' : '#38BDF8'}
              strokeWidth="1.5"
            />
            <rect width="360" height="24" rx="5" fill="#1E293B" />
            <text x="10" y="16" fill="#F8FAFC" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              E // CREW CABIN &amp; WATER-WALL JACKET
            </text>

            {/* Incoming Crimson SPE Proton Tracks from right edge */}
            <g opacity={protonIntensity}>
              {[52, 74, 96, 118, 140].map((py, idx) => (
                <g key={py}>
                  <line
                    x1="354"
                    y1={py}
                    x2={278 + (idx % 2) * 8}
                    y2={py}
                    stroke="#EF4444"
                    strokeWidth={isProtonStorm ? 2.4 : 1.4}
                    strokeDasharray="6 4"
                    className="animate-pipe-flow"
                    markerEnd="url(#arrowCrimson)"
                  />
                </g>
              ))}
              <text x="350" y="42" textAnchor="end" fill="#F87171" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                SPE {env.protonFluxPfu.toFixed(0)} pfu
              </text>
            </g>

            {/* Concentric Water-Wall Bladder Ring around Crew Core */}
            <g transform="translate(210, 112)">
              {/* Outer Habitat Hull */}
              <circle r="62" fill="#090D16" stroke="#334155" strokeWidth="1.5" />
              {/* Dynamic Water-Wall Jacket */}
              <circle
                r="48"
                fill="none"
                stroke="#06B6D4"
                strokeOpacity={controls.shelterWallWaterLiters > 0 ? 0.85 : 0.15}
                strokeWidth={jacketStrokeWidth}
              />
              {/* Inner Storm Shelter Core */}
              <circle
                r="30"
                fill={controls.crewInStormShelter ? '#0C4A6E' : '#1E293B'}
                stroke={controls.crewInStormShelter ? '#38BDF8' : '#64748B'}
                strokeWidth="1.5"
              />
              {/* 4 Crew Dots */}
              {[
                [-8, -7],
                [8, -7],
                [-8, 7],
                [8, 7],
              ].map(([cx, cy], i) => (
                <circle
                  key={i}
                  cx={controls.crewInStormShelter ? cx : cx * 2.1}
                  cy={controls.crewInStormShelter ? cy : cy * 2.1}
                  r="3.5"
                  fill={controls.crewInStormShelter ? '#34D399' : '#FBBF24'}
                />
              ))}
              <text
                x="0"
                y="22"
                textAnchor="middle"
                fill={controls.crewInStormShelter ? '#6EE7B7' : '#FCD34D'}
                fontSize="7.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {controls.crewInStormShelter ? 'LOCKDOWN' : 'NOMINAL'}
              </text>
            </g>

            {/* Left-side Telemetry inside Node E */}
            <text x="12" y="46" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
              JACKET MASS:
            </text>
            <text x="12" y="59" fill="#38BDF8" fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {controls.shelterWallWaterLiters.toFixed(0)} L ({lastFlows.waterWallArealDensityGPerCm2.toFixed(1)} g/cm²)
            </text>

            <text x="12" y="80" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
              SHIELDED DOSE:
            </text>
            <text
              x="12"
              y="93"
              fill={lastFlows.shieldedDoseRateMsvPerHr > 1.5 ? '#EF4444' : '#34D399'}
              fontSize="10.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/hr
            </text>

            <text x="12" y="114" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
              ATTENUATION:
            </text>
            <text x="12" y="127" fill="#22D3EE" fontSize="10.5" fontWeight="700" fontFamily="JetBrains Mono, monospace">
              {lastFlows.shieldAttenuationPct.toFixed(1)}% BLOCKED
            </text>

            <text x="12" y="148" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
              CABIN TEMP / CO2:
            </text>
            <text
              x="12"
              y="161"
              fill={co2Accumulating ? '#FBBF24' : '#F8FAFC'}
              fontSize="9.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {state.cabinTempC.toFixed(1)}°C | {state.cabinCo2MmHg.toFixed(1)} mmHg
            </text>
            {co2Accumulating && (
              <text
                x="12"
                y="173"
                fill="#F87171"
                fontSize="8.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
                className="animate-pulse"
              >
                CO2 ACCUMULATING
              </text>
            )}

            {/* Cite Button */}
            <g
              transform="translate(12, 180)"
              className="cursor-pointer"
              onClick={() => onInspectCitation('crater_oltaris_waterwall')}
            >
              <rect width="336" height="22" rx="3" fill="#0F172A" stroke="#EF4444" strokeOpacity="0.6" strokeWidth="1" />
              <text x="168" y="14.5" textAnchor="middle" fill="#FCA5A5" fontSize="9" fontWeight="700" fontFamily="JetBrains Mono, monospace">
                [CITE: CRaTER / OLTARIS]
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* 2. Tactile Valve & Breaker Control Deck (Right ~42% Side-by-Side) */}
      <div className="flex flex-col gap-2 lg:col-span-5">
        {/* EMERGENCY WATER-WALL CROSS-FEED VALVE */}
        <div className="flex flex-col justify-between rounded-md border border-[#1E293B] bg-[#090D16] p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <Droplets className="h-3.5 w-3.5" />
                <span>Emergency Water-Wall Cross-Feed Valve</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Dual-use mass trade-off: radiation shielding vs. active ECLSS &amp; crop supply.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onInspectCitation('crater_oltaris_waterwall')}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 hover:border-cyan-500"
            >
              <BookOpen className="h-3 w-3" />
              CITE
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
              <span className="text-sky-300">
                Jacket:{' '}
                <strong>{controls.shelterWallWaterLiters.toFixed(0)} L</strong> (
                {lastFlows.waterWallArealDensityGPerCm2.toFixed(1)} g/cm²)
              </span>
              <span className={waterStarved ? 'text-red-400' : 'text-cyan-300'}>
                Active Tank:{' '}
                <strong>{state.activeTankWaterLiters.toFixed(1)} L</strong>
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={controls.shelterWallWaterLiters}
              onChange={(e) =>
                onUpdateControls({ shelterWallWaterLiters: Number(e.target.value) })
              }
              aria-label="Emergency Water-Wall Cross-Feed Valve"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
            />

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onUpdateControls({ shelterWallWaterLiters: 80 })}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                  controls.shelterWallWaterLiters === 80
                    ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                [80L NOMINAL]
              </button>
              <button
                type="button"
                onClick={() => onUpdateControls({ shelterWallWaterLiters: 450 })}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                  controls.shelterWallWaterLiters === 450
                    ? 'border-red-400 bg-red-950/60 text-red-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-red-500/70'
                }`}
              >
                [450L STORM SHIELD MAX]
              </button>
              {waterStarved && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  TANK &lt; 200 L
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BREAKER PANEL: CREW LOCKDOWN + SABATIER + PYROLYSIS */}
        <div className="flex flex-col gap-1.5 rounded-md border border-[#1E293B] bg-[#090D16] p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span>Mission &amp; Loop Breakers</span>
          </div>

          {/* Crew Storm Shelter Lockdown Breaker */}
          <button
            type="button"
            onClick={() =>
              onUpdateControls({ crewInStormShelter: !controls.crewInStormShelter })
            }
            className={`flex items-center justify-between rounded border px-2 py-1 text-left transition ${
              controls.crewInStormShelter
                ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {controls.crewInStormShelter ? (
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-amber-400" />
              )}
              <div>
                <div className="font-mono text-[10.5px] font-bold">
                  CREW STORM SHELTER LOCKDOWN
                </div>
                <div className="font-mono text-[9.5px] text-slate-400">
                  {controls.crewInStormShelter
                    ? 'ACTIVE: Core shielded (-68% dose geometry)'
                    : 'NOMINAL CABIN (-68% dose if locked down)'}
                </div>
              </div>
            </div>
            <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {controls.crewInStormShelter ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Sabatier Reactor Breaker */}
          <button
            type="button"
            onClick={() =>
              onUpdateControls({ sabatierActive: !controls.sabatierActive })
            }
            className={`flex items-center justify-between rounded border px-2 py-1 text-left transition ${
              controls.sabatierActive
                ? isBleedActive
                  ? 'border-purple-500 bg-purple-950/40 text-purple-200'
                  : 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-purple-400" />
              <div>
                <div className="font-mono text-[10.5px] font-bold">SABATIER REACTOR</div>
                <div className="font-mono text-[9.5px] text-slate-400">
                  {controls.sabatierActive
                    ? isBleedActive
                      ? '-1.85 L/hr H2 Bleed to Vacuum'
                      : 'Feeding Pyrolysis Loop'
                    : 'OFF (CO2 scrubbed by LiOH/Bio)'}
                </div>
              </div>
            </div>
            <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {controls.sabatierActive ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Methane Pyrolysis Loop Closure Breaker */}
          <button
            type="button"
            onClick={() =>
              onUpdateControls({
                methanePyrolysisActive: !controls.methanePyrolysisActive,
              })
            }
            className={`flex items-center justify-between rounded border px-2 py-1 text-left transition ${
              controls.methanePyrolysisActive
                ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200'
                : 'border-slate-700 bg-slate-900/90 text-slate-300 hover:border-emerald-500/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-emerald-400" />
              <div>
                <div className="font-mono text-[10.5px] font-bold">METHANE PYROLYSIS</div>
                <div className="font-mono text-[9.5px] text-slate-400">
                  {controls.methanePyrolysisActive
                    ? 'Closed Loop (+3.8 kW) — 0 H2 Bleed'
                    : '-1.85 L/hr H2 Bleed vs Closed Loop (+3.8 kW)'}
                </div>
              </div>
            </div>
            <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] font-bold">
              {controls.methanePyrolysisActive ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* THROTTLE SLIDERS: OGA ELECTROLYSIS, HYDROPONIC PAR LED, THERMAL BUS */}
        <div className="flex flex-col gap-1.5 rounded-md border border-[#1E293B] bg-[#090D16] p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              <span>Subsystem Throttle Bus (0-100%)</span>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-slate-400">
              TOTAL: {lastFlows.totalLoadKw.toFixed(1)} kW
            </span>
          </div>

          {/* OGA Electrolysis Throttle */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between font-mono text-[10.5px] tabular-nums">
              <span className="flex items-center gap-1 text-cyan-300">
                <Wind className="h-3 w-3" /> OGA ELECTROLYSIS
              </span>
              <span className="text-slate-200">
                {controls.electrolysisThrottlePct}% | {electrolysisKw} kW | +
                {lastFlows.o2GeneratedKgPerHr.toFixed(2)} kg/hr O2
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={controls.electrolysisThrottlePct}
              onChange={(e) =>
                onUpdateControls({ electrolysisThrottlePct: Number(e.target.value) })
              }
              aria-label="OGA Electrolysis Throttle"
              className="h-1.5 w-full cursor-pointer appearance-none rounded bg-slate-800 accent-cyan-400"
            />
          </div>

          {/* Hydroponic PAR LED Throttle */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between font-mono text-[10.5px] tabular-nums">
              <span className="flex items-center gap-1 text-emerald-300">
                <Sprout className="h-3 w-3" /> HYDROPONIC PAR LED
              </span>
              <span className="text-slate-200">
                {controls.hydroponicsThrottlePct}% | {hydroponicsKw} kW |{' '}
                {lastFlows.foodProducedKcalPerHr.toFixed(0)} kcal/hr
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={controls.hydroponicsThrottlePct}
              onChange={(e) =>
                onUpdateControls({ hydroponicsThrottlePct: Number(e.target.value) })
              }
              aria-label="Hydroponic PAR LED Throttle"
              className="h-1.5 w-full cursor-pointer appearance-none rounded bg-slate-800 accent-emerald-400"
            />
          </div>

          {/* Thermal Bus Throttle */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between font-mono text-[10.5px] tabular-nums">
              <span className="flex items-center gap-1 text-amber-300">
                <Thermometer className="h-3 w-3" /> THERMAL RADIATOR BUS
              </span>
              <span className="text-slate-200">
                {controls.thermalLoopPct}% | {thermalKw} kW |{' '}
                {state.cabinTempC.toFixed(1)}°C
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={controls.thermalLoopPct}
              onChange={(e) =>
                onUpdateControls({ thermalLoopPct: Number(e.target.value) })
              }
              aria-label="Thermal Bus Throttle"
              className="h-1.5 w-full cursor-pointer appearance-none rounded bg-slate-800 accent-amber-400"
            />
          </div>
        </div>
      </div>
      </div>
    </section>
  );
};

export default MassFlowSchematic;
