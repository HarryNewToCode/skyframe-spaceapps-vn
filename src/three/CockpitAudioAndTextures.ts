// src/three/CockpitAudioAndTextures.ts
// Procedural Apollo LM-7 Aquarius cockpit audio synthesis & high-res 2D canvas panel textures.

import type { CrisisGameState, CrisisHourEnvironment } from '../contracts/types';

export type CockpitSoundKind =
  | 'breaker_pull'
  | 'breaker_push'
  | 'toggle_switch'
  | 'valve_turn'
  | 'master_alarm';

let sharedAudioCtx: AudioContext | null = null;
let fanGainNode: GainNode | null = null;
let humGainNode: GainNode | null = null;
let ambientStarted = false;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtor();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function isCockpitAudioMuted(): boolean {
  return isMuted;
}

export function setCockpitAudioMuted(muted: boolean): boolean {
  isMuted = muted;
  if (sharedAudioCtx && fanGainNode && humGainNode) {
    try {
      const now = sharedAudioCtx.currentTime;
      const targetFan = isMuted ? 0 : 0.02;
      const targetHum = isMuted ? 0 : 0.006;
      fanGainNode.gain.cancelScheduledValues(now);
      fanGainNode.gain.setValueAtTime(fanGainNode.gain.value, now);
      fanGainNode.gain.linearRampToValueAtTime(targetFan, now + 0.08);

      humGainNode.gain.cancelScheduledValues(now);
      humGainNode.gain.setValueAtTime(humGainNode.gain.value, now);
      humGainNode.gain.linearRampToValueAtTime(targetHum, now + 0.08);
    } catch {
      // Audio operation safe in restricted/headless contexts
    }
  }
  if (!isMuted && !ambientStarted) {
    ensureAmbientFanStarted();
  }
  return isMuted;
}

export function ensureAmbientFanStarted(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ambientStarted) return;

    // 2-second looping AudioBuffer filled with 3-stage Paul Kellet pink noise
    const sampleRate = ctx.sampleRate || 44100;
    const bufferSize = sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const fanFilter = ctx.createBiquadFilter();
    fanFilter.type = 'bandpass';
    fanFilter.frequency.setValueAtTime(380, ctx.currentTime);
    fanFilter.Q.setValueAtTime(1.6, ctx.currentTime);

    fanGainNode = ctx.createGain();
    fanGainNode.gain.setValueAtTime(isMuted ? 0 : 0.02, ctx.currentTime);

    noiseSource.connect(fanFilter);
    fanFilter.connect(fanGainNode);
    fanGainNode.connect(ctx.destination);
    noiseSource.start(0);

    // Subtle 115 Hz triangle-wave inverter hum
    const humOsc = ctx.createOscillator();
    humOsc.type = 'triangle';
    humOsc.frequency.setValueAtTime(115, ctx.currentTime);

    humGainNode = ctx.createGain();
    humGainNode.gain.setValueAtTime(isMuted ? 0 : 0.006, ctx.currentTime);

    humOsc.connect(humGainNode);
    humGainNode.connect(ctx.destination);
    humOsc.start(0);

    ambientStarted = true;
  } catch {
    // Headless or restricted audio environment: ignore silently.
  }
}

function playTransientNoise(
  ctx: AudioContext,
  startTime: number,
  durationSec: number,
  highpassHz: number,
  peakGain: number,
): void {
  try {
    const sampleRate = ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * durationSec));
    const noiseBuf = ctx.createBuffer(1, frameCount, sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpassHz, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start(startTime);
    src.stop(startTime + durationSec);
  } catch {
    // Ignore audio transient failure
  }
}

export function playCockpitSound(kind: CockpitSoundKind): void {
  if (isCockpitAudioMuted()) return;
  ensureAmbientFanStarted();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (kind === 'breaker_pull' || kind === 'breaker_push') {
      // 12ms contact snap (highpass 1400 Hz)
      playTransientNoise(ctx, now, 0.012, 1400, 0.16);

      // Stage-1 triangle metallic thud (0.045s)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      const startFreq = kind === 'breaker_pull' ? 240 : 160;
      const endFreq = kind === 'breaker_pull' ? 90 : 60;
      osc1.frequency.setValueAtTime(startFreq, now);
      osc1.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.048);

      // Stage-2 spring latch click 28ms later (620 -> 210 Hz, 0.025s)
      const t2 = now + 0.028;
      playTransientNoise(ctx, t2, 0.008, 2200, 0.09);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(620, t2);
      osc2.frequency.exponentialRampToValueAtTime(210, t2 + 0.025);
      gain2.gain.setValueAtTime(0.14, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.025);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.027);
    } else if (kind === 'toggle_switch') {
      // 10ms highpass snap (2200 Hz)
      playTransientNoise(ctx, now, 0.01, 2200, 0.14);

      // Crisp dual-stage metallic toggle: 1100 -> 380 Hz (0.020s)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(1100, now);
      osc1.frequency.exponentialRampToValueAtTime(380, now + 0.02);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.022);

      // Stage-2 latch 18ms later: 1450 -> 500 Hz (0.022s)
      const t2 = now + 0.018;
      playTransientNoise(ctx, t2, 0.008, 2800, 0.08);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1450, t2);
      osc2.frequency.exponentialRampToValueAtTime(500, t2 + 0.022);
      gain2.gain.setValueAtTime(0.1, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.022);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.024);
    } else if (kind === 'valve_turn') {
      // 2 metallic brass detent clicks separated by 45ms
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.045;
        playTransientNoise(ctx, t, 0.01, 1800, 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(460 - i * 60, t);
        osc.frequency.exponentialRampToValueAtTime(190, t + 0.035);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.037);
      }
    } else if (kind === 'master_alarm') {
      // Authentic dual-tone Apollo C&W klaxon burst (960 Hz, 1340 Hz, 960 Hz)
      const freqs = [960, 1340, 960];
      freqs.forEach((f, idx) => {
        const t = now + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
      });
    }
  } catch {
    // Headless or restricted audio environment: ignore silently.
  }
}

function drawRivets(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const margin = 18;
  const pts: [number, number][] = [
    [margin, margin],
    [w - margin, margin],
    [margin, h - margin],
    [w - margin, h - margin],
    [w / 2, margin],
    [w / 2, h - margin],
    [margin, h / 2],
    [w - margin, h / 2],
  ];
  for (const [rx, ry] of pts) {
    ctx.fillStyle = '#3A414D';
    ctx.beginPath();
    ctx.arc(rx, ry, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14171C';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.arc(rx - 1.5, ry - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialPx: number,
  weight = '600',
  family = "'JetBrains Mono', monospace",
  minPx = 11,
): void {
  let size = initialPx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  let renderedText = text;
  if (ctx.measureText(renderedText).width > maxWidth) {
    while (renderedText.length > 1 && ctx.measureText(renderedText + '…').width > maxWidth) {
      renderedText = renderedText.slice(0, -1);
    }
    renderedText += '…';
  }
  ctx.fillText(renderedText, x, y);
}

function drawTapedNote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleRad: number,
  heading: string,
  lines: string[],
): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angleRad);

  // Subtle drop shadow for paper
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // Weathered cream Apollo checklist paper
  ctx.fillStyle = '#E8DFC5';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#B5AA8C';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();

  // Two translucent beige masking tape strips angled across corners
  // Top-left tape
  ctx.save();
  ctx.translate(-w / 2 + 18, -h / 2 + 12);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = 'rgba(214, 199, 156, 0.85)';
  ctx.fillRect(-28, -10, 56, 20);
  ctx.strokeStyle = 'rgba(180, 160, 120, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-28, -10, 56, 20);
  ctx.restore();

  // Bottom-right tape
  ctx.save();
  ctx.translate(w / 2 - 18, h / 2 - 12);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = 'rgba(214, 199, 156, 0.85)';
  ctx.fillRect(-28, -10, 56, 20);
  ctx.strokeStyle = 'rgba(180, 160, 120, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-28, -10, 56, 20);
  ctx.restore();

  // Heading & lines in dark ink #1E293B
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const headingPx = Math.min(18, Math.max(12, Math.floor(h * 0.16)));
  fitText(
    ctx,
    heading,
    -w / 2 + 20,
    -h / 2 + 14,
    w - 40,
    headingPx,
    'bold',
    "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive, sans-serif",
    10,
  );

  // Underline below heading
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 20, -h / 2 + 16 + headingPx);
  ctx.lineTo(w / 2 - 20, -h / 2 + 16 + headingPx);
  ctx.stroke();

  // Lines
  const startY = -h / 2 + 22 + headingPx;
  const availableH = h / 2 - 10 - startY;
  const lineSpacing = availableH / Math.max(lines.length, 1);
  const linePx = Math.min(15, Math.max(10, Math.floor(lineSpacing * 0.75)));

  lines.forEach((line, idx) => {
    fitText(
      ctx,
      line,
      -w / 2 + 20,
      startY + idx * lineSpacing,
      w - 40,
      linePx,
      '500',
      "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive, sans-serif",
      9,
    );
  });

  ctx.restore();
}

function drawAnalogDial(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  title: string,
  valueText: string,
  subText: string,
  fraction: number,
  accentColor: string,
): void {
  // 1. Above dial: silkscreened nameplate bar (width 240, height 30, #14171C fill, #4B525C border)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(cx - 120, cy - r - 34, 240, 30);
  ctx.strokeStyle = '#4B525C';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 120, cy - r - 34, 240, 30);

  ctx.fillStyle = '#F4F4F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, title, cx, cy - r - 19, 224, 17, 'bold', "'Space Grotesk', sans-serif", 11);

  // 2. Dial face (outer dark face #111418, border #2E3440)
  ctx.fillStyle = '#111418';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2E3440';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Arc track #2E3440
  const startA = (Math.PI * 150) / 180;
  const endA = (Math.PI * 390) / 180;
  ctx.strokeStyle = '#2E3440';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 16, startA, endA);
  ctx.stroke();

  // Active arc
  const clamped = Math.max(0, Math.min(1, fraction));
  const valA = startA + (endA - startA) * clamped;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 16, startA, valA);
  ctx.stroke();

  // Tick marks
  for (let i = 0; i <= 8; i++) {
    const a = startA + ((endA - startA) * i) / 8;
    ctx.strokeStyle = i % 2 === 0 ? '#9CA3AF' : '#6B7280';
    ctx.lineWidth = i % 2 === 0 ? 2.5 : 1.5;
    const innerR = i % 2 === 0 ? r - 28 : r - 24;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
    ctx.stroke();
  }

  // Crisp white needle
  ctx.strokeStyle = '#F4F4F0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(valA) * (r - 20), cy + Math.sin(valA) * (r - 20));
  ctx.stroke();

  // Center needle hub
  ctx.fillStyle = '#9CA3AF';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2E3440';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Inside lower half of dial face: dark recessed digital drum window
  // width 156, height 42 at cy + 38, strictly inside r - 24
  ctx.fillStyle = '#0B0E12';
  ctx.fillRect(cx - 78, cy + 38 - 21, 156, 42);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - 78, cy + 38 - 21, 156, 42);

  ctx.fillStyle = accentColor === '#EF4444' || accentColor === '#F59E0B' ? accentColor : '#F4F4F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, valueText, cx, cy + 38, 144, 30, 'bold', "'JetBrains Mono', monospace", 14);

  // 4. Below dial: secondary sub-label at cy + r + 38
  ctx.fillStyle = '#D1D5DB';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, subText, cx, cy + r + 38, 230, 20, '600', "'JetBrains Mono', monospace", 12);
}

export function renderForwardPanels1And2Canvas(
  canvas: HTMLCanvasElement,
  state: CrisisGameState,
  env: CrisisHourEnvironment,
): void {
  if (canvas.width !== 2048) canvas.width = 2048;
  if (canvas.height !== 1024) canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Base Apollo matte gunmetal faceplate
  ctx.fillStyle = '#1E2228';
  ctx.fillRect(0, 0, 2048, 1024);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 2042, 1018);
  drawRivets(ctx, 2048, 1024);

  // Header stencil (leave x = 1780..2020 clear for 3D Master Alarm housing)
  ctx.fillStyle = '#F4F4F0';
  ctx.font = "bold 20px 'Space Grotesk', 'JetBrains Mono', monospace";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LM-7 AQUARIUS // PANELS 1-2 MAIN DISPLAY & C/W', 34, 38);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "18px 'JetBrains Mono', monospace";
  ctx.textAlign = 'right';
  ctx.fillText(`${env.phaseLabel} | SHACKLETON 89.47°S`, 1750, 38);

  // 8 Recessed Dark-Glass Caution & Warning Lamps (y = 66..140, x = 34 step 216, lampW = 204, lampH = 74)
  const lamps: { label: string; level: 'off' | 'amber' | 'red' }[] = [
    {
      label: 'O2 FLOW',
      level:
        state.cabinO2Kg < 5 || state.lastFlows.o2GeneratedKgPerHr < state.lastFlows.o2ConsumedKgPerHr
          ? 'red'
          : 'off',
    },
    {
      label: 'CO2 >4.0',
      level: state.cabinCo2MmHg >= 4.0 ? 'red' : state.cabinCo2MmHg >= 2.5 ? 'amber' : 'off',
    },
    {
      label: 'H2O <200L',
      level:
        state.activeTankWaterLiters < 120
          ? 'red'
          : state.activeTankWaterLiters < 200
            ? 'amber'
            : 'off',
    },
    {
      label: 'CABIN TEMP',
      level: state.cabinTempC < 15 || state.cabinTempC > 30 ? 'red' : 'off',
    },
    {
      label: 'BATT DRAIN',
      level: state.batteryKwh < 40 ? 'red' : state.lastFlows.netBatteryKw < -5 ? 'amber' : 'off',
    },
    {
      label: 'SPE PROTON',
      level:
        env.unshieldedDoseRateMsvPerHr >= 20
          ? 'red'
          : env.unshieldedDoseRateMsvPerHr >= 4
            ? 'amber'
            : 'off',
    },
    {
      label: 'CH4 BLEED',
      level: state.lastFlows.sabatierWaterBleedEquivLPerHr > 0.5 ? 'amber' : 'off',
    },
    {
      label: 'SHELTER OPEN',
      level:
        env.unshieldedDoseRateMsvPerHr >= 20 && !state.controls.crewInStormShelter
          ? 'red'
          : !state.controls.crewInStormShelter
            ? 'amber'
            : 'off',
    },
  ];

  const lampW = 204;
  const lampH = 74;
  lamps.forEach((lamp, i) => {
    const lx = 34 + i * 216;
    const ly = 66;

    if (lamp.level === 'red') {
      ctx.fillStyle = '#991B1B';
      ctx.strokeStyle = '#EF4444';
    } else if (lamp.level === 'amber') {
      ctx.fillStyle = '#92400E';
      ctx.strokeStyle = '#F59E0B';
    } else {
      ctx.fillStyle = '#14171A';
      ctx.strokeStyle = '#2A3038';
    }

    ctx.fillRect(lx, ly, lampW, lampH);
    ctx.lineWidth = 2;
    ctx.strokeRect(lx, ly, lampW, lampH);

    ctx.fillStyle =
      lamp.level === 'red' ? '#FFFFFF' : lamp.level === 'amber' ? '#FEF3C7' : '#4B525C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(
      ctx,
      lamp.label,
      lx + lampW / 2,
      ly + lampH / 2,
      lampW - 16,
      20,
      'bold',
      "'Space Grotesk', 'JetBrains Mono', monospace",
      12,
    );
  });

  // Left/Center 6 Analog Dials (cx = [250, 700, 1150], cy = [370, 730], r = 112)
  const f = state.lastFlows;

  // Row 1: cy = 370
  drawAnalogDial(
    ctx,
    250,
    370,
    112,
    'DC BUS & RFC BATT',
    `${state.batteryKwh.toFixed(0)} kWh`,
    `NET ${f.netBatteryKw >= 0 ? '+' : ''}${f.netBatteryKw.toFixed(1)} kW`,
    state.batteryKwh / state.maxBatteryKwh,
    state.batteryKwh < 40 ? '#EF4444' : state.batteryKwh < 70 ? '#F59E0B' : '#F4F4F0',
  );

  drawAnalogDial(
    ctx,
    700,
    370,
    112,
    'SHIELD / TANK H2O',
    `${Math.round(state.controls.shelterWallWaterLiters)}L / ${Math.round(state.activeTankWaterLiters)}L`,
    `ATTEN ${f.shieldAttenuationPct.toFixed(0)}%`,
    state.controls.shelterWallWaterLiters / 500,
    state.activeTankWaterLiters < 200 ? '#F59E0B' : '#F4F4F0',
  );

  drawAnalogDial(
    ctx,
    1150,
    370,
    112,
    'CABIN O2 & CO2',
    `${state.cabinCo2MmHg.toFixed(2)} mmHg`,
    `O2 ${state.cabinO2Kg.toFixed(1)} kg`,
    Math.min(1, state.cabinCo2MmHg / 7.5),
    state.cabinCo2MmHg >= 4.0 ? '#EF4444' : state.cabinCo2MmHg >= 2.5 ? '#F59E0B' : '#F4F4F0',
  );

  // Row 2: cy = 730
  drawAnalogDial(
    ctx,
    250,
    730,
    112,
    'CRaTER DOSIMETER',
    `${f.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h`,
    `CUM ${state.cumulativeRadiationMsv.toFixed(1)}/75 mSv`,
    Math.min(1, state.cumulativeRadiationMsv / 75),
    f.shieldedDoseRateMsvPerHr >= 5 || state.cumulativeRadiationMsv >= 50
      ? '#EF4444'
      : f.shieldedDoseRateMsvPerHr >= 2
        ? '#F59E0B'
        : '#F4F4F0',
  );

  drawAnalogDial(
    ctx,
    700,
    730,
    112,
    'VEGGIE-LM BIOMASS',
    `${state.cropHealthPct.toFixed(0)}%`,
    `${Math.round(state.foodBufferKcal)} kcal`,
    state.cropHealthPct / 100,
    state.cropHealthPct < 40 ? '#EF4444' : state.cropHealthPct < 70 ? '#F59E0B' : '#F4F4F0',
  );

  drawAnalogDial(
    ctx,
    1150,
    730,
    112,
    'CABIN TEMP & BLEED',
    `${state.cabinTempC.toFixed(1)} °C`,
    `BLEED ${f.sabatierWaterBleedEquivLPerHr.toFixed(2)} L/h`,
    (state.cabinTempC - 5) / 33,
    state.cabinTempC < 15 || state.cabinTempC > 30
      ? '#EF4444'
      : f.sabatierWaterBleedEquivLPerHr > 0.5
        ? '#F59E0B'
        : '#F4F4F0',
  );

  // Right side: Apollo AGC DSKY (x = 1420..2000, y = 175..980)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(1420, 175, 580, 805);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 3;
  ctx.strokeRect(1420, 175, 580, 805);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "bold 18px 'Space Grotesk', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('APOLLO AGC DSKY // PANEL 3', 1710, 202);

  // Electroluminescent green display window (y = 225..560)
  ctx.fillStyle = '#071710';
  ctx.fillRect(1445, 225, 530, 335);
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1445, 225, 530, 335);

  ctx.fillStyle = '#34D399';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = "bold 26px 'JetBrains Mono', monospace";
  ctx.fillText('PROG  72', 1475, 265);
  ctx.fillText('VERB  16', 1475, 310);

  ctx.textAlign = 'right';
  ctx.fillText('NOUN  44', 1945, 310);

  ctx.font = "bold 38px 'JetBrains Mono', monospace";
  ctx.fillText(`T+${String(state.hour).padStart(2, '0')}:00 HR`, 1945, 375);

  ctx.font = "bold 34px 'JetBrains Mono', monospace";
  ctx.fillText(
    `SUN ${env.sunElevationAboveRidgeDeg >= 0 ? '+' : ''}${env.sunElevationAboveRidgeDeg.toFixed(2)}°`,
    1945,
    440,
  );

  ctx.fillStyle = env.protonFluxPfu > 1000 ? '#F87171' : '#34D399';
  ctx.font = "bold 38px 'JetBrains Mono', monospace";
  ctx.fillText(`${Math.round(env.protonFluxPfu).toString().padStart(5, '0')} PFU`, 1945, 510);

  // Keypad buttons (y = 580..770)
  const dskyKeys = [
    'VERB',
    'NOUN',
    '+',
    '7',
    '8',
    '9',
    '-',
    '4',
    '5',
    '6',
    'CLR',
    '1',
    '2',
    '3',
    'ENTR',
  ];
  dskyKeys.forEach((k, idx) => {
    const col = idx % 5;
    const row = Math.floor(idx / 5);
    const kx = 1450 + col * 106;
    const ky = 582 + row * 64;
    ctx.fillStyle = '#232830';
    ctx.fillRect(kx, ky, 94, 52);
    ctx.strokeStyle = '#4B525C';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(kx, ky, 94, 52);

    ctx.fillStyle = '#F4F4F0';
    ctx.font = "bold 17px 'Space Grotesk', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(k, kx + 47, ky + 26);
  });

  // Taped Crew Note below keypad (x = 1435, y = 805, w = 545, h = 155, angle = -0.025)
  drawTapedNote(ctx, 1435, 805, 545, 155, -0.025, 'CREW NOTE — F. HAISE', [
    '1. Keep Cabin CO2 < 4.0 mmHg (STD-3001)',
    '2. Pull CB-2 PAR Lamps before T+12h shadow',
    '3. SPE Storm: dump 450L water wall + lock shelter',
  ]);
}

export function renderPanel11BreakerPlateCanvas(
  canvas: HTMLCanvasElement,
  state: CrisisGameState,
): void {
  if (canvas.width !== 1024) canvas.width = 1024;
  if (canvas.height !== 1024) canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Matte dark gunmetal #1E2228, warm-white border #4B525C, corner rivets
  ctx.fillStyle = '#1E2228';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#4B525C';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 1018);
  drawRivets(ctx, 1024, 1024);

  // Title: 'PANEL 11 // EPS CIRCUIT BREAKERS'
  ctx.fillStyle = '#F4F4F0';
  ctx.font = "bold 28px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PANEL 11 // EPS CIRCUIT BREAKERS', 512, 58);

  // Silkscreened white bus lines (#E5E7EB, lineWidth = 3)
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 135);
  ctx.lineTo(964, 135);
  ctx.moveTo(60, 530);
  ctx.lineTo(964, 530);
  ctx.stroke();

  ctx.fillStyle = '#F59E0B';
  ctx.font = "bold 18px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('ECA MAIN DC BUS A / B', 512, 126);

  ctx.fillStyle = '#9CA3AF';
  ctx.textAlign = 'left';
  ctx.fillText('ESSENTIAL LIFE SUPPORT & ECLSS BUS', 65, 521);

  // 6 Breaker/Switch boxes at x = [200, 512, 824], y = [310, 710], frame 240 x 260 (x - 120, y - 130)
  const items = [
    {
      x: 200,
      y: 310,
      code: 'CB-1 OGA O2',
      val: `${state.controls.electrolysisThrottlePct}%`,
      isOff: state.controls.electrolysisThrottlePct === 0,
    },
    {
      x: 512,
      y: 310,
      code: 'CB-2 PAR LAMPS',
      val: `${state.controls.hydroponicsThrottlePct}%`,
      isOff: state.controls.hydroponicsThrottlePct === 0,
    },
    {
      x: 824,
      y: 310,
      code: 'CB-3 GLYCOL HTR',
      val: `${state.controls.thermalLoopPct}%`,
      isOff: state.controls.thermalLoopPct === 0,
    },
    {
      x: 200,
      y: 710,
      code: 'SW-1 SABATIER',
      val: state.controls.sabatierActive ? 'CLOSED' : 'OPEN',
      isOff: !state.controls.sabatierActive,
    },
    {
      x: 512,
      y: 710,
      code: 'SW-2 PYROLYSIS',
      val: state.controls.methanePyrolysisActive ? 'CLOSED' : 'OPEN',
      isOff: !state.controls.methanePyrolysisActive,
    },
    {
      x: 824,
      y: 710,
      code: 'SW-3 LOAD SHED',
      val: state.controls.hydroponicsThrottlePct <= 25 ? 'SHED' : 'NORM',
      isOff: state.controls.hydroponicsThrottlePct <= 25,
    },
  ];

  items.forEach((item) => {
    // Frame 240 x 260
    ctx.fillStyle = '#16191F';
    ctx.fillRect(item.x - 120, item.y - 130, 240, 260);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x - 120, item.y - 130, 240, 260);

    // Top label at item.y - 96
    ctx.fillStyle = '#E5E7EB';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(
      ctx,
      item.code,
      item.x,
      item.y - 96,
      218,
      19,
      'bold',
      "'Space Grotesk', sans-serif",
      13,
    );

    // Center [item.y - 55 .. item.y + 55]: completely blank dark recessed well
    ctx.fillStyle = '#12151A';
    ctx.fillRect(item.x - 70, item.y - 55, 140, 110);
    ctx.strokeStyle = '#252A32';
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x - 70, item.y - 55, 140, 110);

    // Bottom readout at item.y + 98
    ctx.fillStyle = item.isOff ? '#F59E0B' : '#F4F4F0';
    fitText(
      ctx,
      item.val,
      item.x,
      item.y + 98,
      218,
      28,
      'bold',
      "'JetBrains Mono', monospace",
      16,
    );
  });

  // Taped note in clear center-right strip (x = 585, y = 472, w = 400, h = 84, angle = 0.02)
  drawTapedNote(
    ctx,
    585,
    472,
    400,
    84,
    0.02,
    'ECLIPSE POWER NOTE',
    [
      'Pull CB-2 PAR (-11.2kW) at shadow onset.',
      'Close SW-2 Pyrolysis to stop -1.85 L/h H2 bleed.',
    ],
  );
}

export function renderAftManifoldAndMailboxCanvas(
  canvas: HTMLCanvasElement,
  state: CrisisGameState,
  env: CrisisHourEnvironment,
): void {
  if (canvas.width !== 2048) canvas.width = 2048;
  if (canvas.height !== 1024) canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Base Apollo matte gunmetal faceplate
  ctx.fillStyle = '#1E2228';
  ctx.fillRect(0, 0, 2048, 1024);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 2042, 1018);
  drawRivets(ctx, 2048, 1024);

  // Title: 'AFT BAY // PANEL 8 ECS MANIFOLD & APOLLO 13 "MAILBOX" PLACARD'
  ctx.fillStyle = '#F4F4F0';
  ctx.font = "bold 24px 'Space Grotesk', sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('AFT BAY // PANEL 8 ECS MANIFOLD & APOLLO 13 "MAILBOX" PLACARD', 56, 58);

  // Top 3 Telemetry Blocks + Sight Glass Scale (y = 88..630)

  // 1. Sight-Glass Scale (x = 40..420, y = 90..630) - 3D sight glass sits at localX = -0.80 (x_px ≈ 140)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(40, 90, 380, 540);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 90, 380, 540);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "bold 18px 'Space Grotesk', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, 'ACTIVE H2O SIGHT GLASS', 230, 125, 360, 18, 'bold', "'Space Grotesk', monospace", 13);

  // Vertical tick scale from 520 L down to 0 L, with tick line at x = 240
  const scaleTopY = 170;
  const scaleBottomY = 520;
  const scaleH = scaleBottomY - scaleTopY;
  const tickLineX = 240;

  ctx.strokeStyle = '#4B525C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tickLineX, scaleTopY);
  ctx.lineTo(tickLineX, scaleBottomY);
  ctx.stroke();

  // Tick marks every 50 L, labels sit cleanly to the right of x_px = 230 (from x_px = 240..420)
  for (let lit = 0; lit <= 520; lit += 50) {
    const yPos = scaleBottomY - (lit / 520) * scaleH;
    const isMajor = lit % 100 === 0 || lit === 520;
    ctx.strokeStyle = isMajor ? '#9CA3AF' : '#4B525C';
    ctx.lineWidth = isMajor ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(isMajor ? tickLineX - 12 : tickLineX - 7, yPos);
    ctx.lineTo(tickLineX, yPos);
    ctx.stroke();

    if (isMajor) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = "bold 15px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${lit}L`, tickLineX + 12, yPos);
    }
  }

  // 200 L STARVE LINE (dashed amber across scale)
  const y200 = scaleBottomY - (200 / 520) * scaleH;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tickLineX - 15, y200);
  ctx.lineTo(410, y200);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#F59E0B';
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('< 200L STARVE LINE', tickLineX + 12, y200 - 4);

  // Large active tank readout at bottom: placed cleanly in right half (x = 240..415)
  ctx.fillStyle = state.activeTankWaterLiters < 200 ? '#F59E0B' : '#F4F4F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(
    ctx,
    `ACTIVE TANK: ${Math.round(state.activeTankWaterLiters)} L`,
    325,
    580,
    170,
    22,
    'bold',
    "'JetBrains Mono', monospace",
    13,
  );

  // 2. Block 1: SABATIER LOOP (x = 450..950, y = 90..630)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(450, 90, 500, 540);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.strokeRect(450, 90, 500, 540);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "bold 20px 'Space Grotesk', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SABATIER MASS-FLOW LOOP', 700, 130);

  ctx.fillStyle = '#D1D5DB';
  ctx.font = "17px 'JetBrains Mono', monospace";
  ctx.textAlign = 'left';
  ctx.fillText('CO2 + 4H2 -> CH4(v) + 2H2O', 480, 180);
  ctx.fillText('PYROLYSIS: CH4 -> C + 2H2', 480, 215);

  // Large status box
  ctx.fillStyle = '#0B0E12';
  ctx.fillRect(480, 250, 440, 90);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(480, 250, 440, 90);

  if (state.controls.methanePyrolysisActive) {
    ctx.fillStyle = '#34D399';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(
      ctx,
      'LOOP: CLOSED (+1.2 L/h PSR)',
      700,
      285,
      420,
      22,
      'bold',
      "'JetBrains Mono', monospace",
      15,
    );
    ctx.fillStyle = '#D1D5DB';
    fitText(
      ctx,
      'H2 RECOVERED — NO LOSS',
      700,
      318,
      420,
      16,
      '600',
      "'JetBrains Mono', monospace",
      12,
    );
  } else {
    ctx.fillStyle = '#EF4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(
      ctx,
      'VENTING CH4: -1.85 L/h!',
      700,
      285,
      420,
      22,
      'bold',
      "'JetBrains Mono', monospace",
      15,
    );
    ctx.fillStyle = '#F59E0B';
    fitText(
      ctx,
      'PERMANENT H2 MASS LOSS',
      700,
      318,
      420,
      16,
      '600',
      "'JetBrains Mono', monospace",
      12,
    );
  }

  // Telemetry items
  ctx.fillStyle = '#F4F4F0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = "19px 'JetBrains Mono', monospace";
  ctx.fillText(`TOTAL H2O: ${state.totalSystemWaterLiters.toFixed(1)} L`, 480, 380);

  ctx.fillStyle = state.cumulativeWaterBleedLiters > 5 ? '#F59E0B' : '#9CA3AF';
  ctx.fillText(`CUM BLEED: ${state.cumulativeWaterBleedLiters.toFixed(1)} L`, 480, 425);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "17px 'JetBrains Mono', monospace";
  ctx.fillText(`OGA O2 PROD: ${state.lastFlows.o2GeneratedKgPerHr.toFixed(3)} kg/h`, 480, 470);
  ctx.fillText(`H2O CONSUME: ${state.lastFlows.waterConsumedLPerHr.toFixed(2)} L/h`, 480, 515);
  ctx.fillText(`H2O RECOVER: ${state.lastFlows.waterRecoveredLPerHr.toFixed(2)} L/h`, 480, 560);

  // 3. Block 2: OLTARIS H2O ATTENUATION (x = 975..1485, y = 90..630)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(975, 90, 510, 540);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.strokeRect(975, 90, 510, 540);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "bold 20px 'Space Grotesk', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OLTARIS H2O ATTENUATION', 1230, 130);

  // Curve axes
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(1030, 360);
  ctx.lineTo(1440, 360);
  ctx.moveTo(1030, 175);
  ctx.lineTo(1030, 360);
  ctx.stroke();

  ctx.fillStyle = '#6B7280';
  ctx.font = "12px 'JetBrains Mono', monospace";
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('0', 1025, 362);
  ctx.fillText('100%', 1025, 175);
  ctx.textAlign = 'right';
  ctx.fillText('20 g/cm²', 1440, 368);

  // Exponential curve exp(-0.115 * d)
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const d = (i / 40) * 20;
    const atten = Math.exp(-0.115 * d);
    const px = 1030 + (i / 40) * 410;
    const py = 360 - atten * 170;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Live marker
  const dLive = state.lastFlows.waterWallArealDensityGPerCm2;
  const mx = 1030 + (Math.min(20, dLive) / 20) * 410;
  const my = 360 - Math.exp(-0.115 * Math.min(20, dLive)) * 170;
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.arc(mx, my, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F4F4F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Telemetry below curve
  ctx.fillStyle = '#F4F4F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(
    ctx,
    `ATTENUATION: ${state.lastFlows.shieldAttenuationPct.toFixed(1)}%`,
    1230,
    430,
    460,
    26,
    'bold',
    "'JetBrains Mono', monospace",
    18,
  );

  ctx.fillStyle = '#D1D5DB';
  fitText(
    ctx,
    `WALL: ${Math.round(state.controls.shelterWallWaterLiters)} L  (${dLive.toFixed(1)} g/cm²)`,
    1230,
    480,
    460,
    20,
    '600',
    "'JetBrains Mono', monospace",
    14,
  );

  ctx.fillStyle = state.activeTankWaterLiters < 200 ? '#F59E0B' : '#9CA3AF';
  fitText(
    ctx,
    `ACTIVE TANK: ${Math.round(state.activeTankWaterLiters)} L (<200L STARVES)`,
    1230,
    525,
    460,
    20,
    '600',
    "'JetBrains Mono', monospace",
    14,
  );

  ctx.fillStyle = '#9CA3AF';
  fitText(
    ctx,
    `SHIELD: ${state.controls.shelterWallWaterLiters >= 400 ? 'HEAVY WATER JACKET' : state.controls.shelterWallWaterLiters > 0 ? 'PARTIAL SHIELD' : 'UNSHIELDED'}`,
    1230,
    570,
    460,
    17,
    '500',
    "'JetBrains Mono', monospace",
    13,
  );

  // 4. Block 3: MAILBOX LiOH & RADIATION (x = 1510..2000, y = 90..630)
  ctx.fillStyle = '#14171C';
  ctx.fillRect(1510, 90, 490, 540);
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.strokeRect(1510, 90, 490, 540);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "bold 20px 'Space Grotesk', monospace";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('APOLLO 13 MAILBOX // LiOH', 1755, 130);

  ctx.fillStyle =
    state.cabinCo2MmHg >= 4.0 ? '#EF4444' : state.cabinCo2MmHg >= 2.5 ? '#F59E0B' : '#F4F4F0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitText(
    ctx,
    `CO2: ${state.cabinCo2MmHg.toFixed(2)} mmHg (LIM 7.5)`,
    1540,
    175,
    430,
    22,
    'bold',
    "'JetBrains Mono', monospace",
    16,
  );

  ctx.fillStyle = '#9CA3AF';
  ctx.font = "17px 'JetBrains Mono', monospace";
  ctx.fillText(`EXHALE: ${state.lastFlows.co2ProducedKgPerHr.toFixed(3)} kg/h`, 1540, 215);
  ctx.fillText(`SCRUB : ${state.lastFlows.co2ScrubbedKgPerHr.toFixed(3)} kg/h`, 1540, 250);

  ctx.fillStyle =
    env.unshieldedDoseRateMsvPerHr >= 20
      ? '#EF4444'
      : env.unshieldedDoseRateMsvPerHr >= 4
        ? '#F59E0B'
        : '#9CA3AF';
  ctx.font = "18px 'JetBrains Mono', monospace";
  ctx.fillText(`EXT SPE: ${env.unshieldedDoseRateMsvPerHr.toFixed(1)} mSv/h`, 1540, 295);

  ctx.fillStyle = state.lastFlows.shieldedDoseRateMsvPerHr >= 5 ? '#EF4444' : '#F4F4F0';
  ctx.fillText(`IN-CABIN: ${state.lastFlows.shieldedDoseRateMsvPerHr.toFixed(2)} mSv/h`, 1540, 330);

  ctx.fillStyle = state.controls.crewInStormShelter ? '#F4F4F0' : '#F59E0B';
  ctx.font = "bold 18px 'JetBrains Mono', monospace";
  ctx.fillText(
    `CREW: ${state.controls.crewInStormShelter ? 'SHELTER LOCKDOWN' : 'OPEN CABIN'}`,
    1540,
    370,
  );

  // Compact taped note in Block 3
  drawTapedNote(ctx, 1530, 455, 445, 150, -0.02, 'MAILBOX LiOH PROCEDURE', [
    'Verify duct-tape plenum seal before fan boost.',
    '450L in wall = 70L active tank (<200L starves).',
  ]);

  // Bottom Manifold Collar Strip (y = 650..1000)
  // Clear silkscreened collar plates at the exact 3D lower valve positions:
  // V-1 around x_px = 780, T-1 around x_px = 1200, V-2 around x_px = 1600
  const valvePlates = [
    {
      x: 780,
      title: 'V-1 WATER-WALL CROSS-FEED',
      titleColor: '#F4F4F0',
      stateText: `${Math.round(state.controls.shelterWallWaterLiters)} L TRANSFER`,
      stateColor: '#F4F4F0',
    },
    {
      x: 1200,
      title: 'T-1 EMERG 450L DUMP',
      titleColor: '#EF4444',
      stateText: state.controls.shelterWallWaterLiters >= 400 ? 'DUMP ARMED' : 'STOWED / LATCHED',
      stateColor: state.controls.shelterWallWaterLiters >= 400 ? '#F59E0B' : '#9CA3AF',
    },
    {
      x: 1600,
      title: 'V-2 CH4 PYROLYSIS DIVERTER',
      titleColor: '#F4F4F0',
      stateText: state.controls.methanePyrolysisActive ? 'RECYCLE H2' : 'VENT CH4',
      stateColor: state.controls.methanePyrolysisActive ? '#F4F4F0' : '#EF4444',
    },
  ];

  valvePlates.forEach((vp) => {
    // Housing frame spanning y = 650..985
    ctx.fillStyle = '#16191F';
    ctx.fillRect(vp.x - 130, 650, 260, 335);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(vp.x - 130, 650, 260, 335);

    // Title label cleanly ABOVE handwheel zone at y = 668px
    ctx.fillStyle = vp.titleColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, vp.title, vp.x, 668, 240, 18, 'bold', "'Space Grotesk', sans-serif", 12);

    // Live state value at y = 702px (20px mono fitted via fitText), cleanly ABOVE handwheel zone
    ctx.fillStyle = vp.stateColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, vp.stateText, vp.x, 702, 240, 20, 'bold', "'JetBrains Mono', monospace", 13);

    // Recessed circular well for 3D handwheel at y = 855 (center zone y = 735..985 completely free of text)
    ctx.fillStyle = '#12151A';
    ctx.beginPath();
    ctx.arc(vp.x, 855, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#252A32';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
