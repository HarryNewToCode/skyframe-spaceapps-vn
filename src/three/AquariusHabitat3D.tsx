import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type {
  CameraStationId,
  CitationId,
  CrisisGameState,
  CrisisHourEnvironment,
  Interactive3DTarget,
  ValveAndBreakerControls,
} from '../contracts/types';
import {
  ensureAmbientFanStarted,
  playCockpitSound,
  renderAftManifoldAndMailboxCanvas,
  renderForwardPanels1And2Canvas,
  renderPanel11BreakerPlateCanvas,
} from './CockpitAudioAndTextures';

export interface AquariusHabitat3DProps {
  state: CrisisGameState;
  env: CrisisHourEnvironment;
  cameraStation: CameraStationId;
  onStationChange: (station: CameraStationId) => void;
  onHoverTarget: (target: Interactive3DTarget | null) => void;
  onUpdateControls: (patch: Partial<ValveAndBreakerControls>) => void;
  onInspectCitation: (id: CitationId) => void;
}

interface StationPose {
  pos: THREE.Vector3;
  yaw: number;
  pitch: number;
}

/**
 * Authentic Apollo LM-7 Aquarius 5-Station Camera Poses:
 * Shot 1: Both canted triangular windows AND full forward console (Panels 1, 2, 3) framed together.
 * Shot 2: Left Bulkhead Panel 11 EPS Breaker Plate.
 * Shot 3: Right Aft Panel 8 ECS Manifold & Valves.
 * Shot 4: Apollo 13 Mailbox Rig & VEGGIE-LM Bio-Rack.
 * Shot 5: Aft Mid-Deck Water-Wall Storm Shelter Alcove.
 */
const STATION_POSES: Record<Exclude<CameraStationId, 'free_walk'>, StationPose> = {
  station_1_console: {
    pos: new THREE.Vector3(0, 1.44, -0.18),
    yaw: 0,
    pitch: -0.14,
  },
  station_2_breakers: {
    pos: new THREE.Vector3(-0.32, 1.36, -0.68),
    yaw: Math.PI / 2,
    pitch: -0.02,
  },
  station_3_valves: {
    pos: new THREE.Vector3(-0.35, 1.36, 0.85),
    yaw: -Math.PI / 2,
    pitch: -0.02,
  },
  station_4_mailbox_garden: {
    pos: new THREE.Vector3(0.32, 1.34, 1.08),
    yaw: Math.PI / 2,
    pitch: -0.04,
  },
  station_5_shelter: {
    pos: new THREE.Vector3(0, 1.34, 0.48),
    yaw: Math.PI,
    pitch: -0.04,
  },
};

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

function getTargetMetadata(
  id: string,
  state: CrisisGameState,
  env: CrisisHourEnvironment
): Interactive3DTarget {
  const { controls, lastFlows } = state;
  switch (id) {
    case 'master_alarm_btn':
      return {
        id,
        label: 'MASTER CAUTION & WARNING RESET',
        panelCode: 'PANEL 1 // C&W',
        kind: 'master_alarm',
        currentValueLabel:
          env.alertLevel === 'critical' || state.activeTankWaterLiters < 200
            ? 'ALARM ACTIVE'
            : 'NOMINAL',
        actionPrompt: '[CLICK / E] ACKNOWLEDGE ALARM & INSPECT NASA-STD-3001',
        tradeoffNote:
          'Monitors O2, CO2 (>4.0 mmHg), Water Tank (<200 L), and 1972 SPE Radiation thresholds.',
        citationId: 'nasa_std_3001',
      };
    case 'gauge_solar_batt':
      return {
        id,
        label: 'SHACKLETON SOLAR & RFC BATTERY',
        panelCode: 'PANEL 1 // EPS',
        kind: 'gauge_inspect',
        currentValueLabel: `${state.batteryKwh.toFixed(1)} kWh (${lastFlows.netBatteryKw >= 0 ? '+' : ''}${lastFlows.netBatteryKw.toFixed(1)} kW)`,
        actionPrompt: '[CLICK / C] INSPECT LOLA SHACKLETON ECLIPSE DATA',
        tradeoffNote: `Sun mask ${(env.solarIlluminationFactor * 100).toFixed(0)}% at 89.47°S. Eclipse T+12h to T+58h.`,
        citationId: 'lola_shackleton_eclipse',
      };
    case 'gauge_water_wall':
      return {
        id,
        label: 'WATER-WALL JACKET vs ACTIVE TANK',
        panelCode: 'PANEL 2 // ECS',
        kind: 'gauge_inspect',
        currentValueLabel: `SHIELD ${controls.shelterWallWaterLiters} L | TANK ${state.activeTankWaterLiters.toFixed(0)} L`,
        actionPrompt: '[CLICK / C] INSPECT CRaTER / OLTARIS SHIELDING CURVE',
        tradeoffNote: `${lastFlows.waterWallArealDensityGPerCm2.toFixed(1)} g/cm² areal density (${lastFlows.shieldAttenuationPct.toFixed(0)}% blocked).`,
        citationId: 'crater_oltaris_waterwall',
      };
    case 'gauge_o2_co2':
      return {
        id,
        label: 'CABIN O2 & CO2 PARTIAL PRESSURE',
        panelCode: 'PANEL 2 // ATMOS',
        kind: 'gauge_inspect',
        currentValueLabel: `O2 ${state.cabinO2Kg.toFixed(1)} kg | CO2 ${state.cabinCo2MmHg.toFixed(2)} mmHg`,
        actionPrompt: '[CLICK / C] INSPECT BVAD METABOLIC RATES',
        tradeoffNote: 'NASA-STD-3001 cognitive impairment >4.0 mmHg, critical >7.5 mmHg.',
        citationId: 'bvad_metabolism',
      };
    case 'gauge_radiation':
      return {
        id,
        label: 'CRaTER BFO RADIATION DOSIMETER',
        panelCode: 'PANEL 1 // RAD',
        kind: 'gauge_inspect',
        currentValueLabel: `${lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/hr (${state.cumulativeRadiationMsv.toFixed(1)} / 75 mSv)`,
        actionPrompt: '[CLICK / C] INSPECT AUG 1972 SPE PROTON FLUX',
        tradeoffNote: `Unshielded SPE ${env.unshieldedDoseRateMsvPerHr.toFixed(1)} mSv/hr (${env.protonFluxPfu.toFixed(0)} pfu).`,
        citationId: 'aug1972_spe_flux',
      };
    case 'gauge_hydroponics':
      return {
        id,
        label: 'VEGGIE-LM BIOMASS & KCAL BAY',
        panelCode: 'PANEL 2 // BIO',
        kind: 'gauge_inspect',
        currentValueLabel: `CROP ${state.cropHealthPct.toFixed(0)}% | ${lastFlows.foodProducedKcalPerHr.toFixed(0)} kcal/hr`,
        actionPrompt: '[CLICK / C] INSPECT OSDR VEGGIE HYDROPONICS',
        tradeoffNote:
          state.activeTankWaterLiters < 200
            ? 'STARVED (<200 L tank): Hydroponics & OGA output severely reduced!'
            : 'Nominal irrigation >=200 L active tank.',
        citationId: 'veggie_hydroponics',
      };
    case 'gauge_thermal_bleed':
      return {
        id,
        label: 'CABIN THERMAL & SABATIER H2 BLEED',
        panelCode: 'PANEL 2 // TCS',
        kind: 'gauge_inspect',
        currentValueLabel: `${state.cabinTempC.toFixed(1)}°C | BLEED -${lastFlows.sabatierWaterBleedEquivLPerHr.toFixed(2)} L/hr`,
        actionPrompt: '[CLICK / C] INSPECT NASA-STD-3001 THERMAL LIMITS',
        tradeoffNote: 'Safe cabin range 15°C to 30°C; Sabatier vents H2 unless Pyrolysis closed.',
        citationId: 'nasa_std_3001',
      };
    case 'breaker_oga':
      return {
        id,
        label: 'CB-1: OGA ELECTROLYSIS (14A)',
        panelCode: 'PANEL 11 // EPS',
        kind: 'breaker',
        currentValueLabel: `${controls.electrolysisThrottlePct}% (${lastFlows.o2GeneratedKgPerHr.toFixed(2)} kg/hr O2)`,
        actionPrompt: '[CLICK / E] CYCLE OGA THROTTLE (100% → 75% → 40% → 0%)',
        tradeoffNote: 'Splits H2O into O2 + 2H2 at 4.5 kWh/kg O2.',
        citationId: 'bvad_electrolysis_sabatier',
      };
    case 'breaker_par_lamps':
      return {
        id,
        label: 'CB-2: VEGGIE PAR LAMP BANK (28A)',
        panelCode: 'PANEL 11 // EPS',
        kind: 'breaker',
        currentValueLabel: `${controls.hydroponicsThrottlePct}% (${((controls.hydroponicsThrottlePct / 100) * 14).toFixed(1)} kW)`,
        actionPrompt: '[CLICK / E] CYCLE PAR LAMPS (80% → 35% → 0% SHED)',
        tradeoffNote: 'Pulling CB-2 sheds up to 11.2 kW during the 46-hour Shackleton eclipse.',
        citationId: 'veggie_hydroponics',
      };
    case 'breaker_thermal':
      return {
        id,
        label: 'CB-3: GLYCOL THERMAL HEATERS (12A)',
        panelCode: 'PANEL 11 // EPS',
        kind: 'breaker',
        currentValueLabel: `${controls.thermalLoopPct}% (${state.cabinTempC.toFixed(1)}°C)`,
        actionPrompt: '[CLICK / E] CYCLE THERMAL HEATERS (100% → 60% → 25%)',
        tradeoffNote: 'Saves battery kW in eclipse, but cabin cools toward 15°C limit.',
        citationId: 'nasa_std_3001',
      };
    case 'switch_sabatier':
      return {
        id,
        label: 'SW-1: SABATIER REACTOR BREAKER',
        panelCode: 'PANEL 11 // ECLSS',
        kind: 'toggle_switch',
        currentValueLabel: controls.sabatierActive ? 'ON (CO2+4H2→CH4+2H2O)' : 'OFF (STANDBY)',
        actionPrompt: '[CLICK / E] FLIP SABATIER REACTOR SWITCH',
        tradeoffNote: controls.methanePyrolysisActive
          ? 'Pyrolysis closed: 0 H2 bleed.'
          : 'WARNING: Vents CH4 overboard (-1.85 L/hr H2O eq) unless Pyrolysis ON!',
        citationId: 'bvad_electrolysis_sabatier',
      };
    case 'switch_pyrolysis':
      return {
        id,
        label: 'SW-2: METHANE PYROLYSIS & PSR MELTER',
        panelCode: 'PANEL 11 // ECLSS',
        kind: 'toggle_switch',
        currentValueLabel: controls.methanePyrolysisActive
          ? 'CLOSED LOOP (+3.8 kW)'
          : 'OFF (-1.85 L/hr BLEED)',
        actionPrompt: '[CLICK / E] FLIP PYROLYSIS LOOP CLOSURE SWITCH',
        tradeoffNote: 'Recovers H2 from CH4 to stop -1.85 L/hr water loss at +3.8 kW power cost.',
        citationId: 'bvad_electrolysis_sabatier',
      };
    case 'switch_load_shed': {
      const isShed = controls.hydroponicsThrottlePct <= 25 && controls.thermalLoopPct <= 50;
      return {
        id,
        label: 'SW-3: APOLLO 13 ECLIPSE POWER-DOWN MACRO',
        panelCode: 'PANEL 11 // EPS',
        kind: 'toggle_switch',
        currentValueLabel: isShed ? 'ECLIPSE SHED ACTIVE' : 'NOMINAL FULL BUS',
        actionPrompt: '[CLICK / E] TOGGLE ECLIPSE POWER-DOWN (PAR 20% / THERM 45%)',
        tradeoffNote: 'Single-throw emergency load shed to survive 46-hour Shackleton eclipse.',
        citationId: 'lola_shackleton_eclipse',
      };
    }
    case 'valve_water_wall':
      return {
        id,
        label: 'VALVE V-1: WATER-WALL CROSS-FEED',
        panelCode: 'AFT BAY // ECS VALVES',
        kind: 'rotary_valve',
        currentValueLabel: `${controls.shelterWallWaterLiters} L SHIELD | ${state.activeTankWaterLiters.toFixed(0)} L TANK`,
        actionPrompt: '[CLICK / E] STEP UP (+150L) | [Q] STEP DOWN',
        tradeoffNote:
          'Pumping 450 L blocks ~94% SPE dose, but drops Active Tank to 70 L (starves crops & CO2 scrub).',
        citationId: 'crater_oltaris_waterwall',
      };
    case 'valve_water_dump_max': {
      const isDumped = controls.shelterWallWaterLiters >= 400;
      return {
        id,
        label: 'T-HANDLE T-1: EMERGENCY 450L WATER-WALL DUMP',
        panelCode: 'AFT BAY // EMERGENCY',
        kind: 't_handle',
        currentValueLabel: isDumped
          ? 'PULLED (450L SHIELD + LOCKDOWN)'
          : 'STOWED (70L NOMINAL)',
        actionPrompt: '[CLICK / E] PULL/PUSH 450L EMERGENCY DUMP T-HANDLE',
        tradeoffNote:
          'Immediately floods 450 L into Storm Shelter Wall & locks down crew (-68% geometry).',
        citationId: 'crater_oltaris_waterwall',
      };
    }
    case 'valve_ch4_diverter':
      return {
        id,
        label: 'VALVE V-2: CH4 VENT / PYROLYSIS DIVERTER',
        panelCode: 'AFT BAY // SABATIER',
        kind: 'rotary_valve',
        currentValueLabel: controls.methanePyrolysisActive
          ? 'CLOSED LOOP RECYCLE'
          : 'OPEN VENT BLEED (-1.85 L/hr)',
        actionPrompt: '[CLICK / E] ROTATE 90° CH4 DIVERTER VALVE',
        tradeoffNote: 'Routes CH4 to Pyrolysis (+3.8 kW) instead of venting H2 to lunar vacuum.',
        citationId: 'bvad_electrolysis_sabatier',
      };
    case 'switch_mailbox_boost':
      return {
        id,
        label: 'MAILBOX SUIT-FAN SCRUBBER BOOST',
        panelCode: 'AFT BAY // MAILBOX',
        kind: 'toggle_switch',
        currentValueLabel:
          controls.electrolysisThrottlePct >= 90 ? 'HIGH FLOW (100%)' : 'LOW FLOW',
        actionPrompt: '[CLICK / E] TOGGLE MAILBOX SUIT-FAN & OGA BOOST',
        tradeoffNote: 'Apollo 13 square-peg-in-round-hole LiOH scrubber + OGA airflow boost.',
        citationId: 'bvad_metabolism',
      };
    case 'shelter_latch':
      return {
        id,
        label: 'STORM SHELTER RADIATION BULKHEAD LATCH',
        panelCode: 'AFT ALCOVE // SHELTER',
        kind: 'shelter_latch',
        currentValueLabel: controls.crewInStormShelter
          ? 'LOCKED DOWN (-68% DOSE)'
          : 'OPEN CABIN (NOMINAL)',
        actionPrompt: '[CLICK / E] LATCH / UNLATCH CREW STORM SHELTER',
        tradeoffNote: 'Huddles all 4 crew inside the concentric water-wall trench during SPE.',
        citationId: 'crater_oltaris_waterwall',
      };
    default:
      return {
        id,
        label: id,
        panelCode: 'LM-7 AQUARIUS',
        kind: 'gauge_inspect',
        currentValueLabel: 'ONLINE',
        actionPrompt: '[CLICK / E] INSPECT',
        tradeoffNote: '',
        citationId: 'nasa_std_3001',
      };
  }
}

/**
 * Procedural 512x512 Apollo LM Velcro-Walkway & Machined Aluminum Deck Texture.
 * Replaces generic AI grid helper with authentic Grumman LM floor panels,
 * rivets, non-slip walkway ribs, and tan/olive Velcro restraint strips.
 */
function createDeckFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#22262C';
  ctx.fillRect(0, 0, 512, 512);

  // Four main machined aluminum floor plate tiles
  const tiles = [
    { x: 10, y: 10, w: 238, h: 238 },
    { x: 264, y: 10, w: 238, h: 238 },
    { x: 10, y: 264, w: 238, h: 238 },
    { x: 264, y: 264, w: 238, h: 238 },
  ];

  tiles.forEach((t) => {
    ctx.fillStyle = '#2B3038';
    ctx.fillRect(t.x, t.y, t.w, t.h);

    ctx.strokeStyle = '#15181C';
    ctx.lineWidth = 4;
    ctx.strokeRect(t.x, t.y, t.w, t.h);

    // Subtle brushed aluminum directional lines
    ctx.strokeStyle = '#323740';
    ctx.lineWidth = 1;
    for (let py = t.y + 12; py < t.y + t.h - 10; py += 16) {
      ctx.beginPath();
      ctx.moveTo(t.x + 8, py);
      ctx.lineTo(t.x + t.w - 8, py);
      ctx.stroke();
    }
  });

  // Dark ribbed non-slip walkway channels (#181B20)
  const channels = [
    { x: 24, y: 64, w: 210, h: 130 },
    { x: 278, y: 64, w: 210, h: 130 },
    { x: 24, y: 318, w: 210, h: 130 },
    { x: 278, y: 318, w: 210, h: 130 },
  ];
  channels.forEach((c) => {
    ctx.fillStyle = '#181B20';
    ctx.fillRect(c.x, c.y, c.w, c.h);

    ctx.strokeStyle = '#101317';
    ctx.lineWidth = 2.5;
    for (let py = c.y + 6; py < c.y + c.h - 4; py += 10) {
      ctx.beginPath();
      ctx.moveTo(c.x + 4, py);
      ctx.lineTo(c.x + c.w - 4, py);
      ctx.stroke();
    }
  });

  // Authentic Apollo tan/olive-grey Velcro foot-restraint strips (#5C5649)
  // running parallel along standing stations
  const velcroStrips = [
    { x: 48, y: 92, w: 162, h: 74 },
    { x: 302, y: 92, w: 162, h: 74 },
    { x: 48, y: 346, w: 162, h: 74 },
    { x: 302, y: 346, w: 162, h: 74 },
  ];
  velcroStrips.forEach((v) => {
    ctx.fillStyle = '#5C5649';
    ctx.fillRect(v.x, v.y, v.w, v.h);

    ctx.strokeStyle = '#433E34';
    ctx.lineWidth = 2;
    ctx.strokeRect(v.x, v.y, v.w, v.h);

    // Stippled hook-and-loop texture
    ctx.fillStyle = '#6E6759';
    for (let i = 0; i < 480; i++) {
      const rx = v.x + 4 + Math.random() * (v.w - 8);
      const ry = v.y + 4 + Math.random() * (v.h - 8);
      ctx.fillRect(rx, ry, 1.6, 1.6);
    }
    ctx.fillStyle = '#4B463B';
    for (let i = 0; i < 300; i++) {
      const rx = v.x + 4 + Math.random() * (v.w - 8);
      const ry = v.y + 4 + Math.random() * (v.h - 8);
      ctx.fillRect(rx, ry, 1.2, 1.2);
    }
  });

  // Structural rivets around perimeter seams
  ctx.fillStyle = '#4B525C';
  for (let x = 16; x < 500; x += 32) {
    for (const y of [14, 244, 268, 498]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let y = 16; y < 500; y += 32) {
    for (const x of [14, 244, 268, 498]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural 512x512 Quilted Apollo Beta-Cloth Thermal-Acoustic Blanket Texture.
 * Eliminates blown-out overhead hotspots: warm off-white/slate quilted fabric (#3A4048 base),
 * square/diamond quilt stitching (#2E333A), and metallic button snaps every 64px.
 */
function createBetaClothTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3A4048';
  ctx.fillRect(0, 0, 512, 512);

  // Quilted diamond/square grid
  const step = 64;
  ctx.strokeStyle = '#2E333A';
  ctx.lineWidth = 2.5;

  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Quilt puff depth (inset shadow in each quilt pocket)
  for (let x = 0; x < 512; x += step) {
    for (let y = 0; y < 512; y += step) {
      ctx.fillStyle = 'rgba(32, 37, 43, 0.22)';
      ctx.fillRect(x + 2, y + 2, step - 4, step - 4);

      ctx.fillStyle = 'rgba(74, 82, 92, 0.15)';
      ctx.fillRect(x + 8, y + 8, step - 16, step - 16);
    }
  }

  // Metallic button snaps every 64px at quilt intersections
  for (let x = 0; x <= 512; x += step) {
    for (let y = 0; y <= 512; y += step) {
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1E232A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Subtle Beta-cloth woven silica texture grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let i = 0; i < 2400; i++) {
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.2, 1.2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Silkscreened instruction placard for Left Aft ECS & Bio-Bay Bulkhead Backing Panel.
 */
function createMailboxPlacardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E2228';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#4B525C';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 500);

  // Corner rivets
  ctx.fillStyle = '#64748B';
  [
    [16, 16],
    [496, 16],
    [16, 496],
    [496, 496],
  ].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#F4F4F0';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('APOLLO 13 CONTINGENCY LiOH "MAILBOX" RIG', 256, 42);
  ctx.fillText('& VEGGIE-LM BIO-RACK', 256, 66);

  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 82);
  ctx.lineTo(480, 82);
  ctx.stroke();

  // Schematic line art
  ctx.fillStyle = '#14171D';
  ctx.fillRect(32, 98, 448, 170);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 98, 448, 170);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CM SQ LiOH CANISTER  ==>  LM ROUND PLENUM PORT', 48, 126);
  ctx.fillText('ADAPTER: FLIGHT PLAN CARDBOARD + GREY DUCT TAPE', 48, 150);
  ctx.fillText('FLOW: RED SUIT HOSE -> SUIT CIRCUIT FAN', 48, 174);
  ctx.fillText('ECLSS BUS: 28V DC // AIRFLOW BOOST >= 90%', 48, 198);

  // Handwritten note on parchment tan paper with silver tape tabs
  ctx.save();
  ctx.translate(40, 300);
  ctx.rotate(-0.02);

  ctx.fillStyle = '#E8D8B8';
  ctx.fillRect(0, 0, 430, 160);
  ctx.strokeStyle = '#B8A888';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 430, 160);

  // Silver duct tape tabs at top corners
  ctx.fillStyle = '#9CA3AF';
  ctx.fillRect(16, -12, 60, 24);
  ctx.fillRect(354, -12, 60, 24);

  ctx.fillStyle = '#1E1B18';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HOUSTON CAPCOM PROC:', 20, 36);
  ctx.font = '13px sans-serif';
  ctx.fillText('Keep duct-tape seal tight on CM canister adapter!', 20, 64);
  ctx.fillText('Inspect suit hose collar every 4 hours for bypass leakage.', 20, 92);
  ctx.fillText('If CO2 > 4.0 mmHg: activate high-flow boost immediately.', 20, 120);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Apollo Landing Point Designator (LPD) reticle texture for Commander's triangular window.
 */
function createLpdReticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 512);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;

  // Vertical degree scale line
  const cx = 110;
  ctx.beginPath();
  ctx.moveTo(cx, 40);
  ctx.lineTo(cx, 470);
  ctx.stroke();

  // Degree tick marks and numerals
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const degSteps = [60, 50, 40, 30, 20, 10, 0];
  degSteps.forEach((deg, idx) => {
    const y = 60 + idx * 60;
    ctx.beginPath();
    ctx.moveTo(cx - 18, y);
    ctx.lineTo(cx + 18, y);
    ctx.stroke();

    ctx.fillText(`${deg}°`, cx - 24, y);

    // Intermediate ticks
    if (idx < degSteps.length - 1) {
      for (let s = 1; s <= 2; s++) {
        const subY = y + s * 20;
        ctx.beginPath();
        ctx.moveTo(cx - 8, subY);
        ctx.lineTo(cx + 8, subY);
        ctx.stroke();
      }
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural yellow/black hazard diagonal stripe texture for shelter latch lever.
 */
function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#111827';
  const stripeW = 24;
  for (let x = -64; x < 320; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 32, 64);
    ctx.lineTo(x - 32, 64);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural handwritten radiation dose instruction card above shelter latch.
 */
function createDoseCardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FDF6E2';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = '#B8A888';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 124);

  // Silver duct tape strips at top & bottom
  ctx.fillStyle = '#9CA3AF';
  ctx.fillRect(20, 0, 48, 12);
  ctx.fillRect(188, 0, 48, 12);

  ctx.fillStyle = '#991B1B';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('SPE RADIATION LOCKDOWN', 16, 32);

  ctx.fillStyle = '#1F2937';
  ctx.font = '10px sans-serif';
  ctx.fillText('1. Pull T-1 Dump (450L) into water wall', 16, 52);
  ctx.fillText('2. Close & latch radiation storm shelter', 16, 70);
  ctx.fillText('3. All 4 crew huddle in water trench', 16, 88);
  ctx.fillText('ATTENUATION: 94% SPE DOSE REDUCTION', 16, 108);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural stencil decal for the potable/shield water bladders.
 */
function createBladderDecalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POTABLE / SHIELD H2O BLADDER', 128, 26);
  ctx.font = '10px monospace';
  ctx.fillText('75L CAPACITY // DACRON RESTRAINED', 128, 44);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const AquariusHabitat3D: React.FC<AquariusHabitat3DProps> = ({
  state,
  env,
  cameraStation,
  onStationChange,
  onHoverTarget,
  onUpdateControls,
  onInspectCitation,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Latest props in refs for animation loop & event handlers
  const stateRef = useRef(state);
  const envRef = useRef(env);
  const stationRef = useRef(cameraStation);
  const onStationChangeRef = useRef(onStationChange);
  const onHoverTargetRef = useRef(onHoverTarget);
  const onUpdateControlsRef = useRef(onUpdateControls);
  const onInspectCitationRef = useRef(onInspectCitation);

  stateRef.current = state;
  envRef.current = env;
  stationRef.current = cameraStation;
  onStationChangeRef.current = onStationChange;
  onHoverTargetRef.current = onHoverTarget;
  onUpdateControlsRef.current = onUpdateControls;
  onInspectCitationRef.current = onInspectCitation;

  // Dynamic texture canvases & Three textures
  const textureUpdateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    textureUpdateRef.current?.();
  }, [state, env]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030508');
    scene.fog = new THREE.FogExp2('#030508', 0.012);

    const camera = new THREE.PerspectiveCamera(
      62,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.05,
      120
    );
    const camPos = new THREE.Vector3(0, 1.42, -0.45);
    let camYaw = 0;
    let camPitch = -0.08;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 2. Balanced Cockpit Lighting (Zero Blown-Out Overhead Hotspot)
    const hemiLight = new THREE.HemisphereLight(0xe5e7eb, 0x262a32, 1.45);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0x9ca3af, 0.65);
    scene.add(ambientLight);

    // Two gentle mid-height diffused fill lights at y = 1.32 (evenly illuminating all 5 stations)
    const forwardFillLight = new THREE.PointLight(0xf8fafc, 0.75, 6.5, 1.2);
    forwardFillLight.position.set(0, 1.32, -0.75);
    scene.add(forwardFillLight);

    const aftFillLight = new THREE.PointLight(0xf8fafc, 0.75, 6.5, 1.2);
    aftFillLight.position.set(0, 1.32, 0.95);
    scene.add(aftFillLight);

    const alarmLight = new THREE.PointLight(0xef4444, 0, 5);
    alarmLight.position.set(0, 2.1, -1.8);
    scene.add(alarmLight);

    // Grazing lunar sunlight shining through the forward triangular windows
    const sunLight = new THREE.DirectionalLight('#FFFBEB', 2.4);
    sunLight.position.set(12, 3, -30);
    scene.add(sunLight);

    // 3. Dynamic High-Resolution 2D Canvases & CanvasTextures
    const forwardCanvas = document.createElement('canvas');
    forwardCanvas.width = 2048;
    forwardCanvas.height = 1024;
    const forwardTex = new THREE.CanvasTexture(forwardCanvas);
    forwardTex.colorSpace = THREE.SRGBColorSpace;
    forwardTex.anisotropy = maxAniso;

    const panel11Canvas = document.createElement('canvas');
    panel11Canvas.width = 1024;
    panel11Canvas.height = 1024;
    const panel11Tex = new THREE.CanvasTexture(panel11Canvas);
    panel11Tex.colorSpace = THREE.SRGBColorSpace;
    panel11Tex.anisotropy = maxAniso;

    const aftCanvas = document.createElement('canvas');
    aftCanvas.width = 2048;
    aftCanvas.height = 1024;
    const aftTex = new THREE.CanvasTexture(aftCanvas);
    aftTex.colorSpace = THREE.SRGBColorSpace;
    aftTex.anisotropy = maxAniso;

    const refreshTextures = () => {
      renderForwardPanels1And2Canvas(forwardCanvas, stateRef.current, envRef.current);
      forwardTex.needsUpdate = true;
      renderPanel11BreakerPlateCanvas(panel11Canvas, stateRef.current);
      panel11Tex.needsUpdate = true;
      renderAftManifoldAndMailboxCanvas(aftCanvas, stateRef.current, envRef.current);
      aftTex.needsUpdate = true;
    };
    textureUpdateRef.current = refreshTextures;
    refreshTextures();

    // 4. Procedural Materials & Textures (No Generic AI Grid, Zero Blown-Out Oval)
    const deckFloorTex = createDeckFloorTexture();
    deckFloorTex.anisotropy = Math.min(8, maxAniso);

    const betaClothTex = createBetaClothTexture();
    betaClothTex.anisotropy = Math.min(8, maxAniso);

    const floorMat = new THREE.MeshStandardMaterial({
      map: deckFloorTex,
      roughness: 0.8,
      metalness: 0.35,
    });

    const betaClothMat = new THREE.MeshStandardMaterial({
      map: betaClothTex,
      roughness: 0.92,
      metalness: 0.06,
    });

    const cabinetMat = new THREE.MeshStandardMaterial({
      color: '#242930',
      roughness: 0.65,
      metalness: 0.5,
    });

    const archMat = new THREE.MeshStandardMaterial({
      color: '#3A414B',
      roughness: 0.55,
      metalness: 0.6,
    });

    const kaptonMat = new THREE.MeshStandardMaterial({
      color: '#A16207',
      roughness: 0.45,
      metalness: 0.65,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      roughness: 0.22,
      metalness: 0.92,
    });

    const bezelMat = new THREE.MeshStandardMaterial({
      color: '#181C22',
      roughness: 0.45,
      metalness: 0.75,
    });

    const bracketMat = new THREE.MeshStandardMaterial({
      color: '#4B525C',
      roughness: 0.5,
      metalness: 0.7,
    });

    const cableLoomMat = new THREE.MeshStandardMaterial({
      color: '#CBD5E1',
      roughness: 0.7,
      metalness: 0.2,
    });

    const tieBandMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.8,
    });

    // 5. Exterior Shackleton Crater Rim + Grazing Solar Disk + Stars + SPE Streaks
    const starCount = 650;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 90;
      starPositions[i * 3 + 1] = 2 + Math.random() * 45;
      starPositions[i * 3 + 2] = -12 - Math.random() * 65;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: '#F8FAFC', size: 0.16 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Lunar terrain mesh outside forward windows (Shackleton Rim z = -18 to -55)
    const terrainGeo = new THREE.PlaneGeometry(80, 44, 52, 36);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i);
      const vz = tPos.getZ(i);
      const ridge = clamp((-vz + 22) / 44, 0, 1) * 3.8 + Math.sin(vx * 0.22) * 0.55;
      const micro = Math.cos(vx * 0.85 + vz * 0.65) * 0.2;
      tPos.setY(i, -1.2 + ridge + micro);
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      color: '#64748B',
      roughness: 0.92,
      metalness: 0.08,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set(0, 0, -39);
    scene.add(terrainMesh);

    // Grazing Sun disk + halo on the Shackleton horizon
    const sunDiskMat = new THREE.MeshBasicMaterial({ color: '#FEF3C7' });
    const sunDisk = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), sunDiskMat);
    sunDisk.position.set(5.5, 2.2, -55);
    scene.add(sunDisk);

    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      transparent: true,
      opacity: 0.35,
    });
    const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), sunHaloMat);
    sunHalo.position.set(5.5, 2.2, -55.2);
    scene.add(sunHalo);

    // SPE proton storm particle streaks
    const protonCount = 90;
    const protonPositions = new Float32Array(protonCount * 6);
    for (let i = 0; i < protonCount; i++) {
      const px = (Math.random() - 0.5) * 18;
      const py = 0.5 + Math.random() * 6;
      const pz = -4 - Math.random() * 20;
      protonPositions[i * 6] = px;
      protonPositions[i * 6 + 1] = py;
      protonPositions[i * 6 + 2] = pz;
      protonPositions[i * 6 + 3] = px - 0.35;
      protonPositions[i * 6 + 4] = py - 0.55;
      protonPositions[i * 6 + 5] = pz + 1.2;
    }
    const protonGeo = new THREE.BufferGeometry();
    protonGeo.setAttribute('position', new THREE.BufferAttribute(protonPositions, 3));
    const protonMat = new THREE.LineBasicMaterial({
      color: '#EF4444',
      transparent: true,
      opacity: 0,
    });
    const protonStreaks = new THREE.LineSegments(protonGeo, protonMat);
    scene.add(protonStreaks);

    // 6. Compact, Enclosed Grumman LM-7 Cabin Geometry (Zero Floating Panels, Zero Black Void)
    // Proportions: x in [-1.45, +1.45], z in [-2.05, +2.25], ceiling arch y = 2.22

    // Machined floor deck
    const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.1, 4.34), floorMat);
    deckMesh.position.set(0, -0.05, 0.1);
    scene.add(deckMesh);

    // Lower sheet-metal walls
    const leftLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 4.34), cabinetMat);
    leftLowerWall.position.set(-1.46, 0.9, 0.1);
    scene.add(leftLowerWall);

    const rightLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 4.34), cabinetMat);
    rightLowerWall.position.set(1.46, 0.9, 0.1);
    scene.add(rightLowerWall);

    // Upper quilted Beta-cloth curved ceiling arch and bulkhead transitions
    const leftUpperCloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 4.34), betaClothMat);
    leftUpperCloth.position.set(-1.42, 1.95, 0.1);
    leftUpperCloth.rotation.z = -0.35;
    scene.add(leftUpperCloth);

    const rightUpperCloth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 4.34), betaClothMat);
    rightUpperCloth.position.set(1.42, 1.95, 0.1);
    rightUpperCloth.rotation.z = 0.35;
    scene.add(rightUpperCloth);

    const ceilingArch = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.08, 4.34), betaClothMat);
    ceilingArch.position.set(0, 2.22, 0.1);
    scene.add(ceilingArch);

    // Overhead Docking Hatch Ring (LM top tunnel)
    const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 12, 28), archMat);
    hatchRing.rotation.x = Math.PI / 2;
    hatchRing.position.set(0, 2.2, -0.6);
    scene.add(hatchRing);

    // Mid-Cabin Structural Ring Frame at z = 0.05 with overhead cable tray & Kapton foil cavities
    const midArchLeft = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.22, 0.16), archMat);
    midArchLeft.position.set(-1.28, 1.11, 0.05);
    scene.add(midArchLeft);

    const midArchRight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.22, 0.16), archMat);
    midArchRight.position.set(1.28, 1.11, 0.05);
    scene.add(midArchRight);

    const midArchTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.28, 0.16), archMat);
    midArchTop.position.set(0, 2.12, 0.05);
    scene.add(midArchTop);

    // Overhead wire harness tray along top arch
    const cableTray = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.22), bracketMat);
    cableTray.position.set(0, 2.0, 0.05);
    scene.add(cableTray);

    // Gold Kapton foil recessed backing behind equipment cavities
    const kaptonRecessLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), kaptonMat);
    kaptonRecessLeft.position.set(-1.39, 1.85, 0.05);
    kaptonRecessLeft.rotation.y = Math.PI / 2;
    scene.add(kaptonRecessLeft);

    const kaptonRecessRight = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), kaptonMat);
    kaptonRecessRight.position.set(1.39, 1.85, 0.05);
    kaptonRecessRight.rotation.y = -Math.PI / 2;
    scene.add(kaptonRecessRight);

    // Solid Aft Bulkhead Wall (z = 2.25)
    const aftBulkhead = new THREE.Mesh(new THREE.BoxGeometry(2.94, 2.3, 0.14), cabinetMat);
    aftBulkhead.position.set(0, 1.15, 2.25);
    scene.add(aftBulkhead);

    // Vertical braided wire looms running from floor to ceiling
    const addWireLoom = (x: number, z: number) => {
      const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.18, 10), cableLoomMat);
      loom.position.set(x, 1.1, z);
      scene.add(loom);

      for (let y = 0.2; y <= 2.0; y += 0.28) {
        const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 10), tieBandMat);
        tie.position.set(x, y, z);
        scene.add(tie);
      }
    };
    addWireLoom(-1.38, -1.35);
    addWireLoom(-1.38, 0.15);
    addWireLoom(1.38, 0.15);
    addWireLoom(1.38, 1.55);

    // Interactive target registry
    const interactiveMeshes: THREE.Object3D[] = [];
    const registerInteractive = (mesh: THREE.Object3D, targetId: string) => {
      mesh.userData.targetId = targetId;
      interactiveMeshes.push(mesh);
    };

    const hitboxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    // ================= SHOT 1: TWO CANTED TRIANGULAR WINDOWS + FULL FORWARD CONSOLE =================
    // Forward Main Console Group at (0, 0.82, -1.78), tilted -0.28 rad
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 0.82, -1.78);
    consoleGroup.rotation.x = -0.28;
    scene.add(consoleGroup);

    // Solid cabinet base
    const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(2.48, 1.26, 0.36), cabinetMat);
    consoleGroup.add(consoleBase);

    // Lower Center Panel 3 / Panel 4 Pedestal reaching all the way to floor deck
    const consolePedestal = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.65, 0.45), cabinetMat);
    consolePedestal.position.set(0, -0.65, 0.04);
    consoleGroup.add(consolePedestal);

    // Left/right side shroud cheeks connecting flush into the side walls
    const leftShroud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.48), cabinetMat);
    leftShroud.position.set(-1.32, -0.05, 0.04);
    consoleGroup.add(leftShroud);

    const rightShroud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, 0.48), cabinetMat);
    rightShroud.position.set(1.32, -0.05, 0.04);
    consoleGroup.add(rightShroud);

    // Forward 2048x1024 Faceplate Mesh (2.40m x 1.20m)
    const forwardFaceplate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshBasicMaterial({ map: forwardTex })
    );
    forwardFaceplate.position.set(0, 0, 0.181);
    consoleGroup.add(forwardFaceplate);

    // Master Alarm Pushbutton at top-right (localX = +1.02, localY = +0.48, localZ = 0.19)
    const masterAlarmMat = new THREE.MeshStandardMaterial({
      color: '#EF4444',
      emissive: '#EF4444',
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const masterAlarmBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.06, 0.03),
      masterAlarmMat
    );
    masterAlarmBtn.position.set(1.02, 0.48, 0.19);
    consoleGroup.add(masterAlarmBtn);
    registerInteractive(masterAlarmBtn, 'master_alarm_btn');

    // 6 3D Gauge Bezels with EXACT coordinates calculated from 2048x1024 canvas dial centers:
    // cx = [250, 700, 1150], cy = [370, 730], r = 112
    // Exact local X: [-0.907, -0.380, +0.148]
    // Exact local Y: [+0.166, -0.255]
    // Exact bezel radius: (112 / 2048) * 2.40 = 0.131m
    const gaugeConfigs: { id: string; x: number; y: number }[] = [
      { id: 'gauge_solar_batt', x: -0.907, y: 0.166 },
      { id: 'gauge_water_wall', x: -0.38, y: 0.166 },
      { id: 'gauge_o2_co2', x: 0.148, y: 0.166 },
      { id: 'gauge_radiation', x: -0.907, y: -0.255 },
      { id: 'gauge_hydroponics', x: -0.38, y: -0.255 },
      { id: 'gauge_thermal_bleed', x: 0.148, y: -0.255 },
    ];

    gaugeConfigs.forEach((g) => {
      const bezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.131, 0.006, 12, 32),
        bezelMat
      );
      bezel.position.set(g.x, g.y, 0.185);
      consoleGroup.add(bezel);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.04), hitboxMat);
      hit.position.set(g.x, g.y, 0.195);
      consoleGroup.add(hit);
      registerInteractive(hit, g.id);
    });

    // Two Canted Triangular Windows Above Forward Console (y = 1.40..2.22, z = -1.94)
    // Left Commander window centered around x = -0.68, y = 1.72
    // Right LM Pilot window centered around x = +0.68, y = 1.72
    const forwardUpperBulkhead = new THREE.Mesh(
      new THREE.BoxGeometry(2.94, 0.42, 0.12),
      cabinetMat
    );
    forwardUpperBulkhead.position.set(0, 1.48, -1.96);
    scene.add(forwardUpperBulkhead);

    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#93C5FD',
      transparent: true,
      opacity: 0.12,
      roughness: 0.1,
      metalness: 0.1,
    });

    // Triangle frame bar constructor helper
    const createWindowTriangle = (isLeft: boolean) => {
      const sign = isLeft ? -1 : 1;
      const g = new THREE.Group();

      // Triangle vertices in world coordinates
      const vTopInner = new THREE.Vector3(sign * 0.15, 2.02, -1.88);
      const vTopOuter = new THREE.Vector3(sign * 1.22, 1.94, -1.9);
      const vBottomInner = new THREE.Vector3(sign * 0.15, 1.44, -1.86);

      // Frame bars (top bar, inner vertical post, diagonal sill)
      const makeBar = (p1: THREE.Vector3, p2: THREE.Vector3) => {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const len = dir.length();
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, len), bracketMat);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        bar.position.copy(mid);
        bar.lookAt(p2);
        g.add(bar);
      };

      makeBar(vTopInner, vTopOuter);
      makeBar(vTopInner, vBottomInner);
      makeBar(vTopOuter, vBottomInner);

      // Recessed triangular glass pane
      const glassGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array(
        isLeft
          ? [
              vTopInner.x,
              vTopInner.y,
              vTopInner.z,
              vTopOuter.x,
              vTopOuter.y,
              vTopOuter.z,
              vBottomInner.x,
              vBottomInner.y,
              vBottomInner.z,
            ]
          : [
              vTopInner.x,
              vTopInner.y,
              vTopInner.z,
              vBottomInner.x,
              vBottomInner.y,
              vBottomInner.z,
              vTopOuter.x,
              vTopOuter.y,
              vTopOuter.z,
            ]
      );
      glassGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      glassGeo.computeVertexNormals();

      const glassMesh = new THREE.Mesh(glassGeo, windowGlassMat);
      g.add(glassMesh);

      // Commander left window: Landing Point Designator (LPD) degree reticle
      if (isLeft) {
        const lpdTex = createLpdReticleTexture();
        const lpdPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, 0.48),
          new THREE.MeshBasicMaterial({
            map: lpdTex,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
          })
        );
        lpdPlane.position.set(-0.58, 1.72, -1.87);
        g.add(lpdPlane);
      }

      scene.add(g);
    };

    createWindowTriangle(true); // Left Commander window
    createWindowTriangle(false); // Right LM Pilot window

    // Center Alignment Optical Telescope (AOT) housing & sun-shield guard (x = 0, y = 1.76, z = -1.86)
    const aotGroup = new THREE.Group();
    aotGroup.position.set(0, 1.76, -1.86);

    const aotCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.68, 16),
      new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.45, metalness: 0.7 })
    );
    aotGroup.add(aotCylinder);

    const aotSunShield = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 20), chromeMat);
    aotSunShield.position.y = 0.26;
    aotSunShield.rotation.x = Math.PI / 2;
    aotGroup.add(aotSunShield);

    // Eyepiece angled toward Commander
    const aotEyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), bezelMat);
    aotEyepiece.position.set(-0.06, -0.15, 0.08);
    aotEyepiece.rotation.z = 0.65;
    aotEyepiece.rotation.x = 0.35;
    aotGroup.add(aotEyepiece);

    scene.add(aotGroup);

    // Angled Overhead Brow Panel (Panel 5/14) above the windows (y = 2.08, z = -1.82)
    const browPanel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.22, 0.12), cabinetMat);
    browPanel.position.set(0, 2.08, -1.82);
    browPanel.rotation.x = 0.32;
    scene.add(browPanel);

    // ================= SHOT 2: LEFT BULKHEAD PANEL 11 EPS (x = -1.38, y = 1.36, z = -0.68) =================
    const panel11Group = new THREE.Group();
    panel11Group.position.set(-1.38, 1.36, -0.68);
    panel11Group.rotation.y = Math.PI / 2; // faces +x
    scene.add(panel11Group);

    // Recessed sheet-metal equipment rack cabinet
    const p11Rack = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.22, 0.16), cabinetMat);
    panel11Group.add(p11Rack);

    // 1.12m x 1.12m Faceplate Plate
    const p11Plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 1.12),
      new THREE.MeshBasicMaterial({ map: panel11Tex })
    );
    p11Plate.position.set(0, 0, 0.082);
    panel11Group.add(p11Plate);

    // Braided vertical cable looms on both sides
    [-0.56, 0.56].forEach((lx) => {
      const loom = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.2, 8), cableLoomMat);
      loom.position.set(lx, 0, 0.09);
      panel11Group.add(loom);
    });

    // 3 Push-Pull Circuit Breakers (Row 1 on 1.12m plate: y = +0.221, x = [-0.341, 0.0, +0.341])
    const createBreaker = (id: string, x: number, y: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0.085);

      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.02, 16), bezelMat);
      bezel.rotation.x = Math.PI / 2;
      g.add(bezel);

      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16),
        new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.35 })
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.z = 0.015;
      g.add(collar);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.018, 16),
        new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.25 })
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.03;
      g.add(cap);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), hitboxMat);
      hit.position.z = 0.04;
      g.add(hit);
      registerInteractive(hit, id);

      panel11Group.add(g);
      return { collar, cap };
    };

    const cbOga = createBreaker('breaker_oga', -0.341, 0.221);
    const cbPar = createBreaker('breaker_par_lamps', 0.0, 0.221);
    const cbTherm = createBreaker('breaker_thermal', 0.341, 0.221);

    // 3 Bat-Handle Toggle Switches with U-shaped Chrome Wickets (Row 2 on 1.12m plate: y = -0.217, x = [-0.341, 0.0, +0.341])
    const createToggleSwitch = (id: string, x: number, y: number) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0.085);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.02, 12), bezelMat);
      base.rotation.x = Math.PI / 2;
      g.add(base);

      // U-shaped chrome toggle guard wicket flanking the switch
      const wicket = new THREE.Mesh(
        new THREE.TorusGeometry(0.042, 0.004, 8, 16, Math.PI),
        chromeMat
      );
      wicket.position.z = 0.02;
      g.add(wicket);

      const pivot = new THREE.Group();
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.006, 0.07, 10), chromeMat);
      lever.rotation.x = Math.PI / 2;
      lever.position.z = 0.035;
      pivot.add(lever);
      g.add(pivot);

      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), hitboxMat);
      hit.position.z = 0.04;
      g.add(hit);
      registerInteractive(hit, id);

      panel11Group.add(g);
      return pivot;
    };

    const swSabatier = createToggleSwitch('switch_sabatier', -0.341, -0.217);
    const swPyrolysis = createToggleSwitch('switch_pyrolysis', 0.0, -0.217);
    const swLoadShed = createToggleSwitch('switch_load_shed', 0.341, -0.217);

    // ================= SHOT 3: RIGHT AFT PANEL 8 ECS MANIFOLD (x = +1.38, y = 1.38, z = +0.85) =================
    const aftManifoldGroup = new THREE.Group();
    aftManifoldGroup.position.set(1.38, 1.38, 0.85);
    aftManifoldGroup.rotation.y = -Math.PI / 2; // faces -x
    scene.add(aftManifoldGroup);

    // Deep ECS equipment cabinet
    const aftCabinet = new THREE.Mesh(new THREE.BoxGeometry(1.94, 1.02, 0.18), cabinetMat);
    aftManifoldGroup.add(aftCabinet);

    // 1.85m x 0.925m Plate
    const aftPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.85, 0.925),
      new THREE.MeshBasicMaterial({ map: aftTex })
    );
    aftPlate.position.set(0, 0, 0.092);
    aftManifoldGroup.add(aftPlate);

    // 3D Active Water Tank Sight-Glass Cylinder at localX = -0.80, localY = +0.10, localZ = 0.08
    // (height = 0.48m, radius = 0.065m, alongside calibration scale px = 40..420, sits cleanly left of text scale)
    const sightGlassOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.48, 18),
      new THREE.MeshPhysicalMaterial({
        color: '#E0F2FE',
        transparent: true,
        opacity: 0.28,
        roughness: 0.1,
      })
    );
    sightGlassOuter.position.set(-0.80, 0.10, 0.08);
    aftManifoldGroup.add(sightGlassOuter);

    const sightWaterMat = new THREE.MeshStandardMaterial({
      color: '#06B6D4',
      emissive: '#0891B2',
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
    });
    const sightWaterColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.46, 16),
      sightWaterMat
    );
    sightWaterColumn.position.set(-0.80, 0.10, 0.08);
    aftManifoldGroup.add(sightWaterColumn);

    // Horizontal 3D ECS manifold pipes ONLY in the bottom manifold strip (localY = -0.26 and -0.36)
    const pipeH2O = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.35, metalness: 0.65 })
    );
    pipeH2O.rotation.z = Math.PI / 2;
    pipeH2O.position.set(0, -0.26, 0.12);
    aftManifoldGroup.add(pipeH2O);

    const pipeGas = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: '#4B5563', roughness: 0.45, metalness: 0.7 })
    );
    pipeGas.rotation.z = Math.PI / 2;
    pipeGas.position.set(0, -0.36, 0.12);
    aftManifoldGroup.add(pipeGas);

    // 3D Spoked Rotary Handwheels & Emergency T-Handle along localY = -0.31
    const createRotaryValve = (id: string, x: number, color: string) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, -0.31, 0.15);

      const wheelMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.55,
      });

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 10, 24), wheelMat);
      wheelGroup.add(rim);

      const spoke1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), wheelMat);
      wheelGroup.add(spoke1);

      const spoke2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), wheelMat);
      spoke2.rotation.z = Math.PI / 2;
      wheelGroup.add(spoke2);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), chromeMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = -0.03;
      wheelGroup.add(hub);

      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), hitboxMat);
      hit.rotation.x = Math.PI / 2;
      wheelGroup.add(hit);
      registerInteractive(hit, id);

      aftManifoldGroup.add(wheelGroup);
      return wheelGroup;
    };

    // V-1: Matte sky-blue #0284C7 spoked aluminum handwheel
    const valveWaterWall = createRotaryValve('valve_water_wall', -0.22, '#0284C7');

    // T-1: Red/yellow emergency T-handle at localX = +0.08, localY = -0.31
    const tHandleGroup = new THREE.Group();
    tHandleGroup.position.set(0.08, -0.31, 0.13);

    const tBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: '#EF4444', roughness: 0.35, metalness: 0.4 })
    );
    tBar.rotation.z = Math.PI / 2;
    tHandleGroup.add(tBar);

    const tStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 8), chromeMat);
    tStem.rotation.x = Math.PI / 2;
    tStem.position.z = -0.045;
    tHandleGroup.add(tStem);

    const tHit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.12), hitboxMat);
    tHandleGroup.add(tHit);
    registerInteractive(tHit, 'valve_water_dump_max');
    aftManifoldGroup.add(tHandleGroup);

    // V-2: Matte amber-brass #D97706 spoked handwheel (NO neon purple!) at localX = +0.39, localY = -0.31
    const valveCh4Diverter = createRotaryValve('valve_ch4_diverter', 0.39, '#D97706');

    // ================= SHOT 4: JURY-RIGGED "MAILBOX" SCRUBBER & VEGGIE-LM BIO-RACK =================
    // Left Aft ECS & Bio-Bay Bulkhead Backing Panel (x = -1.38, y = 1.24, z = 1.06)
    const bioBackingGroup = new THREE.Group();
    bioBackingGroup.position.set(-1.38, 1.24, 1.06);
    bioBackingGroup.rotation.y = Math.PI / 2;
    scene.add(bioBackingGroup);

    const bioBackingCabinet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 0.12), cabinetMat);
    bioBackingGroup.add(bioBackingCabinet);

    // Silkscreened + taped-note instruction placard sitting cleanly in upper-center space
    const mailboxPlacardTex = createMailboxPlacardTexture();
    const mailboxPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.65, 0.65),
      new THREE.MeshBasicMaterial({ map: mailboxPlacardTex })
    );
    mailboxPlacard.position.set(0, 0.42, 0.062);
    bioBackingGroup.add(mailboxPlacard);

    // Physical Apollo 13 "Mailbox" Scrubber Rig (mailboxGroup at x = -1.14, y = 1.12, z = 0.62)
    const mailboxGroup = new THREE.Group();
    mailboxGroup.position.set(-1.14, 1.12, 0.62);
    scene.add(mailboxGroup);

    // Green-grey LM LiOH plenum stand (#3F4A3C)
    const plenumStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.36),
      new THREE.MeshStandardMaterial({ color: '#3F4A3C', roughness: 0.75 })
    );
    plenumStand.position.y = -0.18;
    mailboxGroup.add(plenumStand);

    // Cardboard flight-plan box (#C29B61 with visible dark seam lines)
    const cardboardBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.28, 0.32),
      new THREE.MeshStandardMaterial({ color: '#C29B61', roughness: 0.88 })
    );
    mailboxGroup.add(cardboardBox);

    // 6 narrow diagonal/criss-crossing strips of silver-grey Apollo duct tape (0.032m wide, 0.008m thick)
    // wrapping over the clearly visible tan cardboard flight-plan box (#C29B61)
    const tapeMat = new THREE.MeshStandardMaterial({
      color: '#9CA3AF',
      roughness: 0.45,
      metalness: 0.5,
    });

    // Front face diagonal tape 1 (criss-cross X)
    const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.38), tapeMat);
    tape1.rotation.x = 0.72;
    tape1.position.set(0.124, 0, 0);
    mailboxGroup.add(tape1);

    // Front face diagonal tape 2 (criss-cross X)
    const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.38), tapeMat);
    tape2.rotation.x = -0.72;
    tape2.position.set(0.125, 0, 0);
    mailboxGroup.add(tape2);

    // Upper narrow perimeter wrap band
    const tape3 = new THREE.Mesh(new THREE.BoxGeometry(0.248, 0.032, 0.328), tapeMat);
    tape3.position.set(0, 0.06, 0);
    mailboxGroup.add(tape3);

    // Lower narrow perimeter wrap band
    const tape4 = new THREE.Mesh(new THREE.BoxGeometry(0.248, 0.032, 0.328), tapeMat);
    tape4.position.set(0, -0.06, 0);
    mailboxGroup.add(tape4);

    // Top face diagonal tape 1 (criss-cross X on top)
    const tape5 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.34), tapeMat);
    tape5.rotation.y = 0.65;
    tape5.position.set(0, 0.144, 0);
    mailboxGroup.add(tape5);

    // Top face diagonal tape 2 (criss-cross X on top)
    const tape6 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.34), tapeMat);
    tape6.rotation.y = -0.65;
    tape6.position.set(0, 0.145, 0);
    mailboxGroup.add(tape6);

    // Two white/grey Command Module LiOH cylindrical cartridges
    [-0.08, 0.08].forEach((cz) => {
      const cmCartridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: '#E5E7EB', roughness: 0.4, metalness: 0.3 })
      );
      cmCartridge.rotation.z = Math.PI / 2;
      cmCartridge.position.set(-0.16, -0.12, cz);
      mailboxGroup.add(cmCartridge);
    });

    // 16-Segment Curved Corrugated EVA Suit Hose following 3D spline arc into bulkhead port
    const hoseCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.15, 0),
      new THREE.Vector3(-0.08, 0.46, 0),
      new THREE.Vector3(-0.21, 0.38, 0)
    );
    const hosePts = hoseCurve.getPoints(16);

    for (let i = 0; i < 16; i++) {
      const p1 = hosePts[i];
      const p2 = hosePts[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      const isRubber = i % 2 === 0;
      const segMat = new THREE.MeshStandardMaterial({
        color: isRubber ? '#1F2937' : '#9CA3AF',
        roughness: isRubber ? 0.75 : 0.4,
        metalness: isRubber ? 0.1 : 0.6,
      });

      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(isRubber ? 0.026 : 0.03, isRubber ? 0.026 : 0.03, len, 12),
        segMat
      );
      seg.position.copy(mid);
      seg.lookAt(p2);
      mailboxGroup.add(seg);
    }

    // Red bungee tie-down cords with metal hooks
    const bungeeMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.6 });
    [-0.12, 0.12].forEach((bz) => {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.38, 8), bungeeMat);
      cord.position.set(0.13, 0.02, bz);
      mailboxGroup.add(cord);
    });

    // Interactive Mailbox Suit-Fan Boost Switch
    const mailboxSwitch = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.08),
      new THREE.MeshStandardMaterial({
        color: '#10B981',
        emissive: '#059669',
        emissiveIntensity: 0.5,
      })
    );
    mailboxSwitch.position.set(0.14, 0.12, 0.1);
    mailboxGroup.add(mailboxSwitch);
    registerInteractive(mailboxSwitch, 'switch_mailbox_boost');

    // Apollo/Skylab Brushed-Aluminum Bioreactor Rack (VEGGIE-LM at x = -1.16, y = 1.18, z = 1.56)
    const veggieGroup = new THREE.Group();
    veggieGroup.position.set(-1.16, 1.18, 1.56);
    scene.add(veggieGroup);

    // Aluminum frame with clear polycarbonate viewing window
    const veggieTopCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), bracketMat);
    veggieTopCap.position.y = 0.45;
    veggieGroup.add(veggieTopCap);

    const veggieBottomCap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16), bracketMat);
    veggieBottomCap.position.y = -0.45;
    veggieGroup.add(veggieBottomCap);

    const veggieGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.84, 16, 1, true, -Math.PI / 2, Math.PI),
      new THREE.MeshPhysicalMaterial({
        color: '#E0F2FE',
        transparent: true,
        opacity: 0.22,
        roughness: 0.15,
      })
    );
    veggieGroup.add(veggieGlass);

    // 4 Tiered hydroponic dwarf-wheat/lettuce trays
    const cropMat = new THREE.MeshStandardMaterial({
      color: '#10B981',
      emissive: '#065F46',
      emissiveIntensity: 0.35,
      roughness: 0.8,
    });
    const cropRows: THREE.Mesh[] = [];
    for (let r = 0; r < 4; r++) {
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), bracketMat);
      tray.position.y = -0.32 + r * 0.21;
      veggieGroup.add(tray);

      const row = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.18), cropMat);
      row.position.y = -0.28 + r * 0.21;
      row.rotation.y = r * 0.45;
      veggieGroup.add(row);
      cropRows.push(row);
    }

    // Warm-white / amber agricultural PAR light bars (NO neon magenta/pink!)
    const parLightBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.72, 0.04),
      new THREE.MeshStandardMaterial({
        color: '#FDE68A',
        emissive: '#F59E0B',
        emissiveIntensity: 0.8,
      })
    );
    parLightBar.position.set(0.18, 0, 0);
    veggieGroup.add(parLightBar);

    const parLight = new THREE.PointLight('#FEF3C7', 1.1, 2.8);
    parLight.position.set(0.12, 0.2, 0);
    veggieGroup.add(parLight);

    // ================= SHOT 5: AFT MID-DECK WATER-WALL STORM SHELTER ALCOVE (z = +1.95) =================
    const shelterGroup = new THREE.Group();
    shelterGroup.position.set(0, 1.22, 1.98);
    scene.add(shelterGroup);

    // Gold Kapton foil backing in recessed water alcove
    const kaptonAlcoveBack = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), kaptonMat);
    kaptonAlcoveBack.position.set(0, 0, 0.22);
    shelterGroup.add(kaptonAlcoveBack);

    // Braided stainless-steel water manifold header pipes
    const shelterHeaderPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 2.1, 12),
      new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.35, metalness: 0.65 })
    );
    shelterHeaderPipe.rotation.z = Math.PI / 2;
    shelterHeaderPipe.position.set(0, 0.76, 0.14);
    shelterGroup.add(shelterHeaderPipe);

    // 6 Contoured translucent blue stowage water bladders (#0284C7)
    // with olive-drab DACRON restraint straps and stencil decals
    const bladderMat = new THREE.MeshPhysicalMaterial({
      color: '#0284C7',
      emissive: '#0369A1',
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.78,
      roughness: 0.78,
      metalness: 0.05,
    });

    const dacronStrapMat = new THREE.MeshStandardMaterial({
      color: '#4D5643',
      roughness: 0.75,
    });

    const bladderDecalTex = createBladderDecalTexture();
    const bladders: THREE.Mesh[] = [];

    const bladderCoords: [number, number, number][] = [
      [-0.68, 0.32, 0.14],
      [0.0, 0.32, 0.16],
      [0.68, 0.32, 0.14],
      [-0.68, -0.26, 0.14],
      [0.0, -0.26, 0.16],
      [0.68, -0.26, 0.14],
    ];

    bladderCoords.forEach(([bx, by, bz]) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bx, by, bz);

      const bMesh = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.14), bladderMat);
      bGroup.add(bMesh);
      bladders.push(bMesh);

      // Olive-drab DACRON restraint straps across each bladder
      const strapH = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.04, 0.15), dacronStrapMat);
      bGroup.add(strapH);

      // Silkscreened decal
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.12),
        new THREE.MeshBasicMaterial({
          map: bladderDecalTex,
          transparent: true,
          depthWrite: false,
        })
      );
      decal.position.set(0, 0.12, 0.076);
      bGroup.add(decal);

      shelterGroup.add(bGroup);
    });

    // Right Bulkhead Stanchion at world x = 0.72, y = 1.36, z = 1.62
    const latchStanchion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), bracketMat);
    latchStanchion.position.set(0.72, 0.14, -0.36);
    shelterGroup.add(latchStanchion);

    // Interactive yellow/black striped STORM SHELTER RADIATION BULKHEAD LATCH
    const hazardTex = createHazardStripeTexture();
    const shelterLatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.1),
      new THREE.MeshStandardMaterial({
        map: hazardTex,
        roughness: 0.35,
        metalness: 0.3,
      })
    );
    shelterLatch.position.set(0.72, 0.14, -0.36);
    shelterGroup.add(shelterLatch);
    registerInteractive(shelterLatch, 'shelter_latch');

    // 3D Taped Handwritten Radiation Dose Card right above shelter latch
    const doseCardTex = createDoseCardTexture();
    const doseCard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.12),
      new THREE.MeshBasicMaterial({ map: doseCardTex })
    );
    doseCard.position.set(0.72, 0.32, -0.34);
    shelterGroup.add(doseCard);

    // 7. Input Handling, Gesture Audio & Raycasting
    const keys = new Set<string>();
    let isDragging = false;
    let dragDistance = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    const mouseNDC = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    let lastHoveredId: string | null = null;

    const actuateControl = (targetId: string, stepDirection: 1 | -1 = 1) => {
      const s = stateRef.current;
      const c = s.controls;
      const update = onUpdateControlsRef.current;

      switch (targetId) {
        case 'master_alarm_btn':
          playCockpitSound('master_alarm');
          onInspectCitationRef.current('nasa_std_3001');
          break;
        case 'gauge_solar_batt':
        case 'gauge_water_wall':
        case 'gauge_o2_co2':
        case 'gauge_radiation':
        case 'gauge_hydroponics':
        case 'gauge_thermal_bleed': {
          const meta = getTargetMetadata(targetId, s, envRef.current);
          onInspectCitationRef.current(meta.citationId);
          break;
        }
        case 'breaker_oga': {
          const steps = [100, 75, 40, 0];
          const idx = steps.findIndex((v) => Math.abs(v - c.electrolysisThrottlePct) <= 12);
          const next = steps[(idx + 1) % steps.length];
          playCockpitSound(next < c.electrolysisThrottlePct ? 'breaker_pull' : 'breaker_push');
          update({ electrolysisThrottlePct: next });
          break;
        }
        case 'breaker_par_lamps': {
          const steps = [80, 35, 0];
          const idx = steps.findIndex((v) => Math.abs(v - c.hydroponicsThrottlePct) <= 15);
          const next = steps[(idx + 1) % steps.length];
          playCockpitSound(next < c.hydroponicsThrottlePct ? 'breaker_pull' : 'breaker_push');
          update({ hydroponicsThrottlePct: next });
          break;
        }
        case 'breaker_thermal': {
          const steps = [100, 60, 25];
          const idx = steps.findIndex((v) => Math.abs(v - c.thermalLoopPct) <= 15);
          const next = steps[(idx + 1) % steps.length];
          playCockpitSound(next < c.thermalLoopPct ? 'breaker_pull' : 'breaker_push');
          update({ thermalLoopPct: next });
          break;
        }
        case 'switch_sabatier':
          playCockpitSound('toggle_switch');
          update({ sabatierActive: !c.sabatierActive });
          break;
        case 'switch_pyrolysis':
          playCockpitSound('toggle_switch');
          update({ methanePyrolysisActive: !c.methanePyrolysisActive });
          break;
        case 'switch_load_shed': {
          const isShed = c.hydroponicsThrottlePct <= 25 && c.thermalLoopPct <= 50;
          playCockpitSound(isShed ? 'breaker_push' : 'breaker_pull');
          update(
            isShed
              ? { hydroponicsThrottlePct: 80, thermalLoopPct: 100 }
              : { hydroponicsThrottlePct: 20, thermalLoopPct: 45 }
          );
          break;
        }
        case 'valve_water_wall': {
          const steps = [70, 200, 350, 450];
          const idx = steps.reduce(
            (best, v, i) =>
              Math.abs(v - c.shelterWallWaterLiters) < Math.abs(steps[best] - c.shelterWallWaterLiters)
                ? i
                : best,
            0
          );
          const nextIdx = (idx + stepDirection + steps.length) % steps.length;
          playCockpitSound('valve_turn');
          update({ shelterWallWaterLiters: steps[nextIdx] });
          break;
        }
        case 'valve_water_dump_max': {
          const isDumped = c.shelterWallWaterLiters >= 400;
          playCockpitSound(isDumped ? 'breaker_push' : 'breaker_pull');
          update({
            shelterWallWaterLiters: isDumped ? 70 : 450,
            crewInStormShelter: !isDumped,
          });
          break;
        }
        case 'valve_ch4_diverter':
          playCockpitSound('valve_turn');
          update({ methanePyrolysisActive: !c.methanePyrolysisActive });
          break;
        case 'switch_mailbox_boost':
          playCockpitSound('toggle_switch');
          update({
            electrolysisThrottlePct: c.electrolysisThrottlePct >= 90 ? 75 : 100,
          });
          break;
        case 'shelter_latch':
          playCockpitSound('toggle_switch');
          update({ crewInStormShelter: !c.crewInStormShelter });
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Start subtle WebAudio suit fan on first user gesture
      ensureAmbientFanStarted();

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();
      keys.add(k);

      if (['w', 'a', 's', 'd'].includes(k)) {
        if (stationRef.current !== 'free_walk') {
          onStationChangeRef.current('free_walk');
        }
      }

      if (k === 'e' && lastHoveredId) {
        actuateControl(lastHoveredId, 1);
      } else if (k === 'q' && lastHoveredId) {
        actuateControl(lastHoveredId, -1);
      } else if (k === 'c' && lastHoveredId) {
        const meta = getTargetMetadata(lastHoveredId, stateRef.current, envRef.current);
        onInspectCitationRef.current(meta.citationId);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    const onPointerDown = (e: PointerEvent) => {
      // Start subtle WebAudio suit fan on first user gesture
      ensureAmbientFanStarted();

      isDragging = true;
      dragDistance = 0;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        if (dragDistance > 4) {
          if (stationRef.current !== 'free_walk') {
            onStationChangeRef.current('free_walk');
          }
          camYaw = normalizeAngle(camYaw - dx * 0.0042);
          camPitch = clamp(camPitch - dy * 0.0038, -1.1, 1.1);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasClick = dragDistance < 6;
      isDragging = false;
      if (wasClick) {
        const rect = renderer.domElement.getBoundingClientRect();
        const clickNDC = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(clickNDC, camera);
        const hits = raycaster.intersectObjects(interactiveMeshes, false);
        if (hits.length > 0 && hits[0].distance < 4.5) {
          const id = hits[0].object.userData.targetId as string | undefined;
          if (id) actuateControl(id, 1);
        }
      }
    };

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 8. Animation Loop
    let rafId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = stateRef.current;
      const e = envRef.current;
      const c = s.controls;

      // Camera station snap or WASD free walk (clamped to authentic LM cabin bounds)
      const station = stationRef.current;
      if (station !== 'free_walk') {
        const pose = STATION_POSES[station];
        camPos.lerp(pose.pos, 1 - Math.exp(-8 * dt));
        const yawDiff = normalizeAngle(pose.yaw - camYaw);
        camYaw = normalizeAngle(camYaw + yawDiff * (1 - Math.exp(-8 * dt)));
        camPitch += (pose.pitch - camPitch) * (1 - Math.exp(-8 * dt));
      } else {
        const lookSpeed = 1.9 * dt;
        if (keys.has('arrowleft') || keys.has('j')) camYaw = normalizeAngle(camYaw + lookSpeed);
        if (keys.has('arrowright') || keys.has('l')) camYaw = normalizeAngle(camYaw - lookSpeed);
        if (keys.has('arrowup') || keys.has('i')) camPitch = clamp(camPitch + lookSpeed * 0.8, -1.1, 1.1);
        if (keys.has('arrowdown') || keys.has('k')) camPitch = clamp(camPitch - lookSpeed * 0.8, -1.1, 1.1);

        const moveSpeed = 2.4 * dt;
        const forward = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
        const delta = new THREE.Vector3();
        if (keys.has('w')) delta.add(forward);
        if (keys.has('s')) delta.sub(forward);
        if (keys.has('d')) delta.add(right);
        if (keys.has('a')) delta.sub(right);
        if (delta.lengthSq() > 0) {
          delta.normalize().multiplyScalar(moveSpeed);
          camPos.add(delta);
          camPos.x = clamp(camPos.x, -1.15, 1.15);
          camPos.z = clamp(camPos.z, -1.55, 1.75);
          camPos.y = 1.44; // LM-7 eye standing height
        }
      }

      camera.position.copy(camPos);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = camYaw;
      camera.rotation.x = camPitch;

      // Exterior solar & SPE particle updates
      sunLight.intensity = 0.25 + e.solarIlluminationFactor * 2.6;
      sunLight.position.y = 0.5 + e.sunElevationAboveRidgeDeg * 2.0;
      const sunY = 2.2 + e.sunElevationAboveRidgeDeg * 1.4;
      sunDisk.position.y = sunY;
      sunHalo.position.y = sunY;
      sunDisk.visible = e.solarIlluminationFactor > 0.05;
      sunHaloMat.opacity = 0.05 + e.solarIlluminationFactor * 0.35;

      const stormActive = e.protonFluxPfu >= 50 || e.unshieldedDoseRateMsvPerHr >= 2;
      protonMat.opacity = stormActive ? 0.75 : 0;
      if (stormActive) {
        const posArr = protonGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < protonCount; i++) {
          posArr[i * 6 + 1] -= dt * 14;
          posArr[i * 6 + 4] -= dt * 14;
          if (posArr[i * 6 + 1] < -1) {
            const ny = 5 + Math.random() * 4;
            posArr[i * 6 + 1] = ny;
            posArr[i * 6 + 4] = ny - 0.55;
          }
        }
        protonGeo.attributes.position.needsUpdate = true;
      }

      // Master Alarm & Cabin Lighting
      const hasAlarm =
        e.alertLevel === 'critical' ||
        s.activeTankWaterLiters < 200 ||
        s.cabinCo2MmHg > 4.0;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
      masterAlarmMat.emissiveIntensity = hasAlarm ? 0.5 + pulse * 1.4 : 0.15;
      alarmLight.intensity = hasAlarm ? pulse * 1.1 : 0;

      // Physical 3D Circuit Breakers (Collar & Cap position)
      const updateBreaker = (b: { collar: THREE.Mesh; cap: THREE.Mesh }, pulled: boolean) => {
        const targetZ = pulled ? 0.035 : 0.0;
        b.collar.position.z = 0.015 + targetZ;
        b.cap.position.z = 0.03 + targetZ;
      };
      updateBreaker(cbOga, c.electrolysisThrottlePct < 100);
      updateBreaker(cbPar, c.hydroponicsThrottlePct < 50);
      updateBreaker(cbTherm, c.thermalLoopPct < 100);

      // Physical 3D Toggle Switches
      swSabatier.rotation.x = c.sabatierActive ? -0.52 : 0.52;
      swPyrolysis.rotation.x = c.methanePyrolysisActive ? -0.52 : 0.52;
      const isShed = c.hydroponicsThrottlePct <= 25 && c.thermalLoopPct <= 50;
      swLoadShed.rotation.x = isShed ? -0.52 : 0.52;

      // Physical 3D Rotary Valves & T-Handle
      valveWaterWall.rotation.z = -(c.shelterWallWaterLiters / 450) * Math.PI * 1.5;
      valveCh4Diverter.rotation.z = c.methanePyrolysisActive ? Math.PI / 2 : 0;
      tHandleGroup.position.z = c.shelterWallWaterLiters >= 400 ? 0.18 : 0.13;

      // Active Water Tank Sight-Glass level
      const tankFrac = clamp(s.activeTankWaterLiters / 520, 0.03, 1);
      sightWaterColumn.scale.y = tankFrac;
      sightWaterColumn.position.y = 0.10 - 0.23 * (1 - tankFrac);
      sightWaterMat.color.set(s.activeTankWaterLiters < 200 ? '#F59E0B' : '#06B6D4');

      // Veggie Bio-Rack crops & lighting
      parLight.intensity = (c.hydroponicsThrottlePct / 100) * 1.8;
      if (s.activeTankWaterLiters < 200 || s.cropHealthPct < 60) {
        cropMat.color.set('#D97706');
        cropMat.emissive.set('#78350F');
      } else {
        cropMat.color.set('#10B981');
        cropMat.emissive.set('#065F46');
      }

      // Water-Wall Bladders Inflation (thickness expands as shelterWallWaterLiters rises 70L -> 450L)
      const bladderScaleZ = 0.45 + (clamp(c.shelterWallWaterLiters, 0, 500) / 500) * 1.9;
      bladders.forEach((b) => {
        b.scale.z = bladderScaleZ;
      });

      shelterLatch.rotation.z = c.crewInStormShelter ? 0.45 : -0.45;

      // Raycasting from mouseNDC
      raycaster.setFromCamera(mouseNDC, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      const hitId =
        hits.length > 0 && hits[0].distance < 4.5
          ? (hits[0].object.userData.targetId as string)
          : null;

      if (hitId !== lastHoveredId) {
        lastHoveredId = hitId;
        onHoverTargetRef.current(
          hitId ? getTargetMetadata(hitId, s, e) : null
        );
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.dispose();
      deckFloorTex.dispose();
      betaClothTex.dispose();
      forwardTex.dispose();
      panel11Tex.dispose();
      aftTex.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full cursor-crosshair overflow-hidden bg-[#030508]"
    />
  );
};

export default AquariusHabitat3D;
