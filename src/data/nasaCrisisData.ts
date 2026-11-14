// src/data/nasaCrisisData.ts
// NASA-grounded constants, citations, and the deterministic 72-hour crisis timeline.
// Sources: NASA BVAD (NASA/TP-2015-218570/REV2), King 1974 / NASA SP-368 Aug 4 1972 SPE,
// LRO CRaTER / OLTARIS, LRO LOLA South Pole Illumination (#5027, Mazarico et al. 2011),
// NASA OSDR VEGGIE / APH, NASA-STD-3001 Vol 2 Rev D.

import type { CitationId, CrisisHourEnvironment, NasaCitation } from '../contracts/types';

// ---------------------------------------------------------------------------
// 1) NASA_CITATIONS
// ---------------------------------------------------------------------------

export const NASA_CITATIONS: Record<CitationId, NasaCitation> = {
  bvad_metabolism: {
    id: 'bvad_metabolism',
    code: 'BVAD',
    title: 'Baseline Values and Assumptions Document (NASA BVAD)',
    agency: 'NASA',
    documentNumber: 'NASA/TP-2015-218570/REV2',
    url: 'https://ntrs.nasa.gov/citations/20180001338',
    parameterSummary:
      'Table 4.1 crew metabolic rates per Crew-Member (CM): O2 = 0.84 kg/CM-day (0.035 kg/CM-hr), CO2 = 1.00 kg/CM-day (0.0417 kg/CM-hr), Potable Water = 2.50 kg/CM-day, Calories = 3035 kcal/CM-day (126.5 kcal/CM-hr).',
    formulaUsed:
      'For N crew: O2_used = 0.035 * N kg/hr; CO2_produced = 0.0417 * N kg/hr; H2O_drinking = 2.50 * N kg/day; kcal_burn = 126.5 * N kcal/hr (4 crew: O2 0.140 kg/hr, CO2 0.167 kg/hr, 506 kcal/hr).',
    tableOrPage: 'Table 4.1 (crew metabolic/consumable requirements)',
  },
  bvad_electrolysis_sabatier: {
    id: 'bvad_electrolysis_sabatier',
    code: 'BVAD-ECLSS',
    title: 'NASA BVAD Section 4.3 ECLSS Closure: OGA Electrolysis & Sabatier Reactor',
    agency: 'NASA',
    documentNumber: 'NASA/TP-2015-218570/REV2 (Section 4.3)',
    url: 'https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf',
    parameterSummary:
      'OGA Water Electrolysis: 2H2O -> 2H2 + O2 at 4.5 kWh per kg O2, consuming 1.125 L H2O per kg O2. Sabatier reaction CO2 + 4H2 -> CH4(vented) + 2H2O vents CH4 overboard, losing 0.41 kg H2O-equivalent per person-day (~0.068 L/hr for 4 crew) unless closed with Methane Pyrolysis.',
    formulaUsed:
      'Electrolysis: 2H2O -> 2H2 + O2; P = 4.5 kWh/kg-O2; H2O_rate = 1.125 L per kg O2. Sabatier: CO2 + 4H2 -> CH4 + 2H2O; H2O bleed = 0.41 kg H2O-equiv / person-day = 0.068 L/hr (4 crew) when CH4 vented; recovered fully with CH4 pyrolysis CH4 -> C + 2H2.',
    tableOrPage: 'Section 4.3 (ECLSS closure / water & oxygen recovery)',
  },
  aug1972_spe_flux: {
    id: 'aug1972_spe_flux',
    code: 'SPE-1972',
    title: 'August 4, 1972 Carrington-class Solar Particle Event (King 1974 / NASA SP-368 / GOES proton reconstruction)',
    agency: 'NASA',
    documentNumber: 'NASA SP-368 / King 1974 (J. H. King, J. Spacecraft, 1974)',
    url: 'https://ntrs.nasa.gov/citations/19750010506',
    parameterSummary:
      'Historical August 4, 1972 SPE: >100 MeV proton flux peaking at 62,000 pfu and unshielded surface BFO dose rate peaking at 142.0 mSv/hr during Hours 14-38 post-event.',
    formulaUsed:
      'Dose integration: D_total = SUM over hours of D_unshielded(t) * hullFactor * exp(-0.115 * arealDensity); flux envelope interpolated from GOES-reconstructed >100 MeV channel (12 pfu ambient -> 62,000 pfu peak at Hour 22).',
    tableOrPage: 'GOES >100 MeV proton channel reconstruction / King 1974 Tables',
  },
  crater_oltaris_waterwall: {
    id: 'crater_oltaris_waterwall',
    code: 'CRaTER-OLTARIS',
    title: 'LRO CRaTER & NASA OLTARIS Water-Wall Shielding Attenuation',
    agency: 'NASA',
    documentNumber: 'LRO CRaTER instrument / NASA OLTARIS transport code',
    url: 'https://science.nasa.gov/mission/lro/science-and-data/',
    parameterSummary:
      'Water-wall attenuation: D_shielded = D_unshielded * hullFactor * exp(-0.115 * arealDensityGPerCm2). A 500 L water jacket across 25 m^2 shelter wall provides up to 20.0 g/cm^2 H2O, reducing SPE dose by ~90%, plus 0.35 shelter core factor when crewInStormShelter is true.',
    formulaUsed:
      'arealDensity = (LitersH2O / 25 m^2) * 100 cm/m / 10 (g/cm^2 per L/m^2) -> 500 L / 25 m^2 = 20.0 g/cm^2. D_shielded = D_unshielded * hullFactor * exp(-0.115 * arealDensity); if crewInStormShelter: D *= 0.35 (shelter core factor).',
    tableOrPage: 'OLTARIS H2O areal-density attenuation curve (exponential fit)',
  },
  lola_shackleton_eclipse: {
    id: 'lola_shackleton_eclipse',
    code: 'LOLA-5027',
    title: 'LRO LOLA South Pole Illumination — Shackleton Connecting Ridge',
    agency: 'NASA',
    documentNumber: 'SVS #5027 / Mazarico et al. 2011',
    url: 'https://svs.gsfc.nasa.gov/5027/',
    parameterSummary:
      'Shackleton Connecting Ridge (89.47°S, 222.6°E) grazing solar elevation of 1.54° is clipped by Malapert/Shackleton ridge line-of-sight, producing a 46-hour terrain shadow eclipse from Hour 12 to Hour 58 where solarIlluminationFactor drops to 0.05-0.12 and surface temperature falls from 220 K to 42 K.',
    formulaUsed:
      'Illumination fraction = fraction of array footprint with sun above LOLA horizon mask at 89.47°S, 222.6°E; eclipse window Hours 12-58 (46 hr); T_surface interpolates 220 K (sunlit) <-> 42 K (deep shadow).',
    tableOrPage: 'SVS #5027 illumination maps / Mazarico et al. 2011, Geophys. Res. Lett.',
  },
  veggie_hydroponics: {
    id: 'veggie_hydroponics',
    code: 'VEGGIE-APH',
    title: 'NASA OSDR / VEGGIE & Advanced Plant Habitat (APH) — Dwarf Wheat & Lactuca sativa',
    agency: 'NASA',
    documentNumber: 'NASA OSDR Life Sciences Data Archive / VEGGIE & APH experiment records',
    url: 'https://osdr.nasa.gov/bio/repo',
    parameterSummary:
      'Full 12 m^2 bay draws 14.0 kW LED PAR lighting + 1.8 L/hr transpiration water (92% condensed back if active) to scrub 0.095 kg CO2/hr, generate +0.070 kg O2/hr, and yield 420 kcal/hr.',
    formulaUsed:
      'At throttle t [0-1]: P_LED = 14.0 * t kW; H2O = 1.8 * t L/hr (92% recovered); CO2_scrub = 0.095 * t kg/hr; O2_gen = 0.070 * t kg/hr; kcal = 420 * t kcal/hr.',
    tableOrPage: 'VEGGIE / APH biomass & gas-exchange yields (per 12 m^2 bay)',
  },
  nasa_std_3001: {
    id: 'nasa_std_3001',
    code: 'STD-3001',
    title: 'NASA-STD-3001 Vol 2 Rev D — Crew Health Standards (CO2 & Radiation Limits)',
    agency: 'NASA',
    documentNumber: 'NASA-STD-3001 Volume 2, Revision D',
    url: 'https://www.nasa.gov/ochmo/health-and-medical/nasa-standards/',
    parameterSummary:
      'Cabin CO2 partial pressure: nominal < 2.0 mmHg, cognitive impairment warning >= 4.0 mmHg, acute toxicity fail >= 7.5 mmHg. Acute BFO radiation: warning >= 25 mSv (cumulative event dose), mission abort / fail >= 75 mSv.',
    formulaUsed:
      'Co2Status: mmHg < 2.0 = nominal; 2.0 <= mmHg < 4.0 = watch; 4.0 <= mmHg < 7.5 = warning (cognitive impairment); mmHg >= 7.5 = fail (acute toxicity). RadStatus: 25 mSv <= D < 75 mSv = warning; D >= 75 mSv = mission abort.',
    tableOrPage: 'Vol 2 Rev D — atmospheric & radiation permissible outcome limits',
  },
};

// ---------------------------------------------------------------------------
// 2) CRISIS_CONSTANTS
// ---------------------------------------------------------------------------

export const CRISIS_CONSTANTS = {
  // Crew (4 astronauts, BVAD Table 4.1)
  crewCount: 4,

  // BVAD metabolism per Crew-Member
  o2KgPerCmHour: 0.035, // 0.84 kg/CM-day
  co2KgPerCmHour: 0.0417, // 1.00 kg/CM-day
  potableWaterKgPerCmDay: 2.5,
  kcalPerCmHour: 126.5, // 3035 kcal/CM-day
  o2KgPerCmDay: 0.84,
  co2KgPerCmDay: 1.0,
  kcalPerCmDay: 3035,

  // OGA Water Electrolysis (BVAD Sec 4.3): 2H2O -> 2H2 + O2
  electrolysisKwhPerKgO2: 4.5,
  electrolysisWaterLPerKgO2: 1.125,

  // Sabatier: CO2 + 4H2 -> CH4(vented) + 2H2O
  sabatierWaterBleedKgPerPersonDay: 0.41,
  sabatierWaterBleedLPerHr4Crew: 0.068,

  // Methane Pyrolysis loop closure
  methanePyrolysisKw: 2.8,

  // Radiation — Aug 1972 SPE (King 1974)
  spePeakProtonFluxPfu: 62000,
  spePeakDoseRateMsvPerHr: 142.0,
  ambientProtonFluxPfu: 12,

  // Water-wall shielding (LRO CRaTER / OLTARIS)
  shieldingAttenuationCoeff: 0.115,
  shelterWallAreaM2: 25,
  shelterWaterJacketMaxLiters: 500,
  shelterMaxArealDensityGPerCm2: 20.0, // 500 L / 25 m^2
  shelterCoreFactor: 0.35,

  // LOLA Shackleton Connecting Ridge eclipse
  ridgeLatitudeDeg: 89.47,
  ridgeLongitudeDeg: 222.6,
  grazingSunElevationDeg: 1.54,
  eclipseStartHour: 12,
  eclipseEndHour: 58, // 46-hour terrain shadow eclipse
  sunlitSurfaceTempK: 220,
  deepShadowSurfaceTempK: 42,

  // Hydroponics (VEGGIE / APH, 12 m^2 bay at 100% throttle)
  hydroponicsBayAreaM2: 12,
  hydroponicsLedKw: 14.0,
  hydroponicsTranspirationLPerHr: 1.8,
  hydroponicsCondensateReturnPct: 92,
  hydroponicsCo2ScrubKgPerHr: 0.095,
  hydroponicsO2GenKgPerHr: 0.07,
  hydroponicsFoodKcalPerHr: 420,

  // NASA-STD-3001 Vol 2 Rev D limits
  co2NominalMmHg: 2.0,
  co2CognitiveWarningMmHg: 4.0,
  co2AcuteToxicityMmHg: 7.5,
  radiationWarningMsv: 25,
  radiationAbortMsv: 75,

  // Power / battery envelope
  maxBatteryKwh: 180,
} as const;

// ---------------------------------------------------------------------------
// 3) CRISIS_TIMELINE_72H — deterministic 73-entry timeline (hours 0..72)
// ---------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Linear interpolation over a piecewise envelope of [hour, value] knots. */
function envelope(hour: number, knots: [number, number][]): number {
  if (hour <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (hour <= knots[i][0]) {
      const [h0, v0] = knots[i - 1];
      const [h1, v1] = knots[i];
      return lerp(v0, v1, (hour - h0) / (h1 - h0));
    }
  }
  return knots[knots.length - 1][1];
}

// Sun elevation above the LOLA ridge horizon (deg) — grazing sun at +1.54 max.
const SUN_ELEVATION_KNOTS: [number, number][] = [
  [0, 1.2],
  [11, 0.3],
  [12, -0.4],
  [14, -0.4],
  [15, -1.1],
  [38, -1.1],
  [39, -0.6],
  [57, -0.6],
  [58, 0.6],
  [72, 1.54],
];

// Solar array illumination fraction (LOLA horizon mask).
const ILLUMINATION_KNOTS: [number, number][] = [
  [0, 0.85],
  [11, 0.45],
  [12, 0.08],
  [14, 0.08],
  [15, 0.05],
  [38, 0.05],
  [39, 0.1],
  [57, 0.1],
  [58, 0.72],
  [72, 0.96],
];

// >100 MeV proton flux (pfu) — Aug 1972 GOES reconstruction envelope.
const PROTON_FLUX_KNOTS: [number, number][] = [
  [0, 12],
  [11, 12],
  [12, 1400],
  [14, 18500],
  [15, 26000],
  [22, 62000],
  [30, 38000],
  [38, 9500],
  [39, 4200],
  [48, 1600],
  [57, 450],
  [58, 80],
  [66, 30],
  [72, 15],
];

// Unshielded BFO dose rate (mSv/hr).
const DOSE_RATE_KNOTS: [number, number][] = [
  [0, 0.018],
  [11, 0.018],
  [12, 4.5],
  [14, 38.0],
  [15, 65.0],
  [22, 142.0],
  [30, 96.0],
  [38, 48.0],
  [39, 18.0],
  [48, 7.5],
  [57, 2.4],
  [58, 0.45],
  [66, 0.1],
  [72, 0.02],
];

// Surface temperature (K).
const TEMP_KNOTS: [number, number][] = [
  [0, 215],
  [11, 215],
  [12, 65],
  [14, 65],
  [15, 42],
  [38, 42],
  [39, 48],
  [57, 48],
  [58, 195],
  [72, 220],
];

const PHASE_LABELS = {
  prestorm: 'PRE-STORM GRAZING SUN',
  onset: 'SHACKLETON ECLIPSE ONSET + CME SHOCK ARRIVAL',
  peak: 'AUG 1972 CARRINGTON-CLASS SPE PEAK + DEEP ECLIPSE',
  decay: 'LATE ECLIPSE & SPE TAIL DECAY',
  sunrise: 'SUNRISE OVER SHACKLETON PEAK SP-1',
};

const HEADLINES = {
  prestorm:
    'Grazing sun on the Connecting Ridge: arrays at partial illumination, ambient GCR background nominal.',
  onset:
    'Malapert/Shackleton ridge clips the grazing sun; CME shock front arrives — >100 MeV proton flux climbing fast.',
  peak:
    'Carrington-class SPE in progress: 62,000 pfu proton flux, 142.0 mSv/hr unshielded BFO dose. Crew must shelter behind the water wall.',
  decay:
    'SPE tail decaying through the eclipse window; terrain shadow holds solar arrays dark, radiation still above warning limits.',
  sunrise:
    'Sun clears Shackleton Peak SP-1: arrays re-illuminate, radiation returns to GCR background, thermal soak resumes.',
};

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function hourRecord(hour: number): CrisisHourEnvironment {
  const sunElev = round3(envelope(hour, SUN_ELEVATION_KNOTS));
  const illum = round3(envelope(hour, ILLUMINATION_KNOTS));
  const flux = round3(envelope(hour, PROTON_FLUX_KNOTS));
  const dose = round3(envelope(hour, DOSE_RATE_KNOTS));
  const tempK = Math.round(envelope(hour, TEMP_KNOTS));

  let alertLevel: CrisisHourEnvironment['alertLevel'];
  let phaseLabel: string;
  let headline: string;

  if (hour <= 11) {
    alertLevel = hour <= 6 ? 'nominal' : 'watch';
    phaseLabel = PHASE_LABELS.prestorm;
    headline = HEADLINES.prestorm;
  } else if (hour <= 14) {
    alertLevel = 'warning';
    phaseLabel = PHASE_LABELS.onset;
    headline = HEADLINES.onset;
  } else if (hour <= 38) {
    alertLevel = 'critical';
    phaseLabel = PHASE_LABELS.peak;
    headline = HEADLINES.peak;
  } else if (hour <= 57) {
    alertLevel = 'warning';
    phaseLabel = PHASE_LABELS.decay;
    headline = HEADLINES.decay;
  } else {
    alertLevel = 'nominal';
    phaseLabel = PHASE_LABELS.sunrise;
    headline = HEADLINES.sunrise;
  }

  return {
    hour,
    phaseLabel,
    sunElevationAboveRidgeDeg: sunElev,
    solarIlluminationFactor: illum,
    protonFluxPfu: flux,
    unshieldedDoseRateMsvPerHr: dose,
    surfaceTempK: tempK,
    alertLevel,
    eventHeadline: headline,
  };
}

/** 73 deterministic hourly environment records (hour 0 through hour 72 inclusive). */
export const CRISIS_TIMELINE_72H: CrisisHourEnvironment[] = Array.from(
  { length: 73 },
  (_, hour) => hourRecord(hour),
);
