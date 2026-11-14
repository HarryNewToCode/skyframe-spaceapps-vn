// src/components/NasaSourceModal.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  ShieldCheck,
  Sigma,
  Terminal,
  X,
  AlertTriangle,
  Cpu,
  Network,
} from "lucide-react";
import type { CitationId, NasaCitation } from "../contracts/types";

export interface NasaSourceModalProps {
  isOpen: boolean;
  activeCitationId: CitationId | null;
  onSelectCitation: (id: CitationId) => void;
  onClose: () => void;
  citations: Record<CitationId, NasaCitation>;
}

type InspectorTab = "citations" | "disclosure";

/** Canonical rail order — mirrors the CitationId union so the rail never
 *  re-shuffles with object-key insertion order. */
const CITATION_ORDER: CitationId[] = [
  "bvad_metabolism",
  "bvad_electrolysis_sabatier",
  "aug1972_spe_flux",
  "crater_oltaris_waterwall",
  "lola_shackleton_eclipse",
  "veggie_hydroponics",
  "nasa_std_3001",
];

interface AgentAttribution {
  role: string;
  model: string;
  runtime: string;
  scope: string;
  accent: string;
}

const AGENT_SWARM: AgentAttribution[] = [
  {
    role: "Orchestrator / Systems Architect",
    model: "Gemini 4 Argon",
    runtime: "Antigravity agent harness",
    scope:
      "Task decomposition, file-ownership contracts, cross-component interface enforcement, final TypeScript gate review.",
    accent: "#F59E0B",
  },
  {
    role: "Flight Deck UI Swarm Node",
    model: "Gemini 4 Hydrogen",
    runtime: "Antigravity (parallel quota lane)",
    scope:
      "Tactical flight-deck layout, valve-and-breaker interaction states, gauge typography and telemetry legibility.",
    accent: "#06B6D4",
  },
  {
    role: "Schematic & Flow Render Node",
    model: "Gemini 3.8 Flash",
    runtime: "Antigravity (parallel quota lane)",
    scope:
      "Sabatier mass-flow schematic geometry, Sankey ribbon routing, hourly animation timing curves.",
    accent: "#10B981",
  },
  {
    role: "Simulation Math & Test Node",
    model: "GLM-5.3 Flash",
    runtime: "Hermes agent / OpenRouter",
    scope:
      "Conserved-water bookkeeping, OGA electrolysis stoichiometry, unit-test coverage of hourly sim deltas.",
    accent: "#A855F7",
  },
  {
    role: "Citation Integrity & Audit Node",
    model: "DeepSeek V4.1 Flash",
    runtime: "Hermes agent / OpenRouter",
    scope:
      "Verbatim NASA source transcription, formula/table cross-checking, disclosure copy and code review.",
    accent: "#EF4444",
  },
];

const LIMITATIONS: string[] = [
  "Radiation shielding is modelled as a 1-D exponential attenuation of areal density (LRO CRaTER / NASA OLTARIS water-wall fit). It does not resolve 3-D particle transport, secondary neutron build-up, or anisotropic spectral hardening behind the water jacket.",
  "Dose values are boundary-of-shield estimates for a Carrington-class August 1972 proton spectrum; the real shelter geometry, hull mass distribution, and crew body self-shielding are collapsed into a single transmission factor.",
  "Hydroponic yield, Sabatier conversion efficiency, and thermal loop behaviour are first-order lumped-parameter approximations calibrated to BVAD reference values, not physical-chemical equilibrium solvers.",
  "Hourly resolution is 1 hour; sub-hour transient spikes (SPE onset, breaker trips) are integrated rather than resolved.",
  "All model output is a training/education artefact for the NASA Space Apps Challenge. It is not a flight-qualified analysis and must not be used for mission-critical design decisions.",
];

function formatIndex(n: number): string {
  return String(n).padStart(2, "0");
}

export function NasaSourceModal({
  isOpen,
  activeCitationId,
  onSelectCitation,
  onClose,
  citations,
}: NasaSourceModalProps): React.ReactElement | null {
  const [tab, setTab] = useState<InspectorTab>("citations");
  const [copied, setCopied] = useState<"formula" | "url" | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const orderedCitations = useMemo<NasaCitation[]>(() => {
    const ordered = CITATION_ORDER.map((id) => citations[id]).filter(
      (citation): citation is NasaCitation => Boolean(citation),
    );
    const known = new Set(ordered.map((citation) => citation.id));
    const extras = (Object.values(citations) as NasaCitation[]).filter(
      (citation) => citation && !known.has(citation.id),
    );
    return [...ordered, ...extras];
  }, [citations]);

  const selected: NasaCitation | null = useMemo(() => {
    if (!activeCitationId) return orderedCitations[0] ?? null;
    return citations[activeCitationId] ?? orderedCitations[0] ?? null;
  }, [activeCitationId, citations, orderedCitations]);

  const handleCopy = useCallback(
    async (value: string, kind: "formula" | "url") => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(value);
          setCopied(kind);
          window.setTimeout(() => setCopied(null), 1600);
        }
      } catch {
        setCopied(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <div
        className="absolute inset-0 bg-[#050810]/80 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nasa-source-modal-title"
        aria-describedby="nasa-source-modal-description"
        className="relative flex h-full w-full max-w-6xl flex-col border-l border-[#1E293B] bg-[#090D16] shadow-[0_0_60px_rgba(0,0,0,0.65)]"
      >
        {/* Header */}
        <header className="shrink-0 border-b border-[#1E293B] bg-[#111827]">
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center border border-[#1E293B] bg-[#090D16]">
                <BookOpen size={16} className="text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <div>
                <h2
                  id="nasa-source-modal-title"
                  className="font-mono text-[13px] font-semibold uppercase tracking-[0.16em] text-[#E2E8F0]"
                >
                  NASA Source Inspector
                </h2>
                <p
                  id="nasa-source-modal-description"
                  className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#64748B]"
                >
                  Traceable citations &middot; verbatim equations &middot; agency attribution
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden border border-[#1E293B] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] tabular-nums text-[#10B981] sm:inline">
                {formatIndex(orderedCitations.length)} sources verified
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close NASA source inspector"
                className="flex h-8 w-8 items-center justify-center border border-[#1E293B] bg-[#090D16] text-[#94A3B8] transition-colors hover:border-[#EF4444] hover:text-[#EF4444] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div role="tablist" aria-label="Inspector panels" className="flex gap-px border-t border-[#1E293B]">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "citations"}
              aria-controls="panel-citations"
              id="tab-citations"
              onClick={() => setTab("citations")}
              className={[
                "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#06B6D4]",
                tab === "citations"
                  ? "border-b-2 border-[#F59E0B] bg-[#090D16] text-[#F59E0B]"
                  : "border-b-2 border-transparent bg-[#0C1220] text-[#64748B] hover:text-[#94A3B8]",
              ].join(" ")}
            >
              <FileText size={12} strokeWidth={1.75} />
              NASA Citation &amp; Equation Inspector
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "disclosure"}
              aria-controls="panel-disclosure"
              id="tab-disclosure"
              onClick={() => setTab("disclosure")}
              className={[
                "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#06B6D4]",
                tab === "disclosure"
                  ? "border-b-2 border-[#A855F7] bg-[#090D16] text-[#A855F7]"
                  : "border-b-2 border-transparent bg-[#0C1220] text-[#64748B] hover:text-[#94A3B8]",
              ].join(" ")}
            >
              <ShieldCheck size={12} strokeWidth={1.75} />
              SI / AI Swarm Disclosure (Space Apps Compliance)
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "citations" ? (
            <div
              id="panel-citations"
              role="tabpanel"
              aria-labelledby="tab-citations"
              className="grid h-full grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
            >
              {/* Left rail */}
              <nav
                aria-label="Citation index"
                className="min-h-0 overflow-y-auto border-b border-[#1E293B] bg-[#0C1220] md:border-b-0 md:border-r"
              >
                <div className="sticky top-0 z-10 border-b border-[#1E293B] bg-[#0C1220] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[#475569]">
                  Citation register &middot; {formatIndex(orderedCitations.length)} entries
                </div>
                <ul className="divide-y divide-[#1E293B]/70">
                  {orderedCitations.map((citation, index) => {
                    const isActive = selected?.id === citation.id;
                    return (
                      <li key={citation.id}>
                        <button
                          type="button"
                          onClick={() => onSelectCitation(citation.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={[
                            "group relative flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#06B6D4]",
                            isActive
                              ? "bg-[#111827]"
                              : "bg-transparent hover:bg-[#111827]/60",
                          ].join(" ")}
                        >
                          <span
                            aria-hidden="true"
                            className={[
                              "absolute inset-y-0 left-0 w-[2px] transition-colors",
                              isActive ? "bg-[#F59E0B]" : "bg-transparent group-hover:bg-[#1E293B]",
                            ].join(" ")}
                          />
                          <span className="flex items-baseline gap-2">
                            <span
                              className={[
                                "font-mono text-[10px] tabular-nums",
                                isActive ? "text-[#F59E0B]" : "text-[#475569]",
                              ].join(" ")}
                            >
                              {formatIndex(index + 1)}
                            </span>
                            <span
                              className={[
                                "font-mono text-[10px] uppercase tracking-[0.12em]",
                                isActive ? "text-[#06B6D4]" : "text-[#64748B]",
                              ].join(" ")}
                            >
                              {citation.code}
                            </span>
                          </span>
                          <span
                            className={[
                              "line-clamp-2 font-mono text-[11px] leading-snug",
                              isActive ? "text-[#E2E8F0]" : "text-[#94A3B8]",
                            ].join(" ")}
                          >
                            {citation.title}
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#475569]">
                            {citation.agency}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Detail */}
              <div className="min-h-0 overflow-y-auto px-5 py-5">
                {selected ? (
                  <article aria-live="polite" className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1E293B] pb-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#F59E0B]">
                            {selected.code}
                          </span>
                          <span className="border border-[#1E293B] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] tabular-nums text-[#64748B]">
                            {selected.documentNumber}
                          </span>
                        </div>
                        <h3 className="mt-2 font-mono text-[15px] leading-snug text-[#E2E8F0]">
                          {selected.title}
                        </h3>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#06B6D4]">
                          {selected.agency}
                        </p>
                      </div>
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 border border-[#1E293B] bg-[#111827] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#10B981] transition-colors hover:border-[#10B981] hover:bg-[#10B981]/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
                      >
                        <ExternalLink size={11} strokeWidth={2} />
                        Open source
                      </a>
                    </div>

                    {/* Parameter summary */}
                    <section>
                      <SectionHeading icon={<Layers size={11} strokeWidth={2} />} label="Parameter summary" />
                      <p className="mt-2 border-l-2 border-[#1E293B] pl-3 font-mono text-[11.5px] leading-relaxed text-[#CBD5E1]">
                        {selected.parameterSummary}
                      </p>
                    </section>

                    {/* Formula */}
                    <section>
                      <div className="flex items-center justify-between gap-2">
                        <SectionHeading icon={<Sigma size={11} strokeWidth={2} />} label="Formula used (verbatim)" />
                        <button
                          type="button"
                          onClick={() => void handleCopy(selected.formulaUsed, "formula")}
                          className="inline-flex items-center gap-1 border border-[#1E293B] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#64748B] transition-colors hover:border-[#06B6D4] hover:text-[#06B6D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
                        >
                          {copied === "formula" ? (
                            <Check size={10} strokeWidth={2.5} />
                          ) : (
                            <Copy size={10} strokeWidth={2} />
                          )}
                          {copied === "formula" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <pre
                        tabIndex={0}
                        className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border border-[#1E293B] bg-[#050810] px-3 py-2.5 font-mono text-[11.5px] leading-relaxed tabular-nums text-[#F59E0B] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
                      >
                        <code>{selected.formulaUsed}</code>
                      </pre>
                    </section>

                    {/* Table / page */}
                    <section>
                      <SectionHeading icon={<Terminal size={11} strokeWidth={2} />} label="Table / page reference" />
                      <p className="mt-2 font-mono text-[11px] tabular-nums leading-relaxed text-[#94A3B8]">
                        {selected.tableOrPage}
                      </p>
                    </section>

                    {/* URL */}
                    <section>
                      <SectionHeading icon={<ExternalLink size={11} strokeWidth={2} />} label="External reference URL" />
                      <div className="mt-2 flex items-stretch gap-2">
                        <a
                          href={selected.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate border border-[#1E293B] bg-[#111827] px-3 py-2 font-mono text-[10.5px] text-[#06B6D4] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
                          title={selected.url}
                        >
                          {selected.url}
                        </a>
                        <button
                          type="button"
                          onClick={() => void handleCopy(selected.url, "url")}
                          aria-label="Copy reference URL"
                          className="flex w-9 items-center justify-center border border-[#1E293B] bg-[#111827] text-[#64748B] transition-colors hover:border-[#06B6D4] hover:text-[#06B6D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
                        >
                          {copied === "url" ? (
                            <Check size={12} strokeWidth={2.5} />
                          ) : (
                            <Copy size={12} strokeWidth={2} />
                          )}
                        </button>
                      </div>
                    </section>
                  </article>
                ) : (
                  <div className="flex h-full items-center justify-center border border-dashed border-[#1E293B]">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#475569]">
                      No citation selected
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              id="panel-disclosure"
              role="tabpanel"
              aria-labelledby="tab-disclosure"
              className="h-full overflow-y-auto px-5 py-5"
            >
              <div className="mx-auto max-w-4xl space-y-6">
                <div className="border border-[#A855F7]/40 bg-[#A855F7]/5 px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <Network size={14} className="mt-0.5 shrink-0 text-[#A855F7]" strokeWidth={2} />
                    <div>
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#A855F7]">
                        2026 NASA Space Apps Challenge &middot; Super Intelligence (SI) disclosure
                      </h3>
                      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-[#CBD5E1]">
                        Every artefact in this flight deck was authored by a hybrid agent swarm under human
                        direction. This panel is the mandatory disclosure of model provenance, runtime quota
                        lanes, and the engineering-model limits of the delivered simulation.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Attribution table */}
                <section>
                  <SectionHeading icon={<Cpu size={11} strokeWidth={2} />} label="Hybrid agent swarm attribution" />
                  <div className="mt-2 overflow-x-auto border border-[#1E293B]">
                    <table className="w-full border-collapse text-left">
                      <caption className="sr-only">
                        AI agent swarm attribution table: role, model, runtime, and authorship scope
                      </caption>
                      <thead>
                        <tr className="bg-[#111827] font-mono text-[9px] uppercase tracking-[0.16em] text-[#64748B]">
                          <th scope="col" className="border-b border-[#1E293B] px-3 py-2 font-medium">
                            #
                          </th>
                          <th scope="col" className="border-b border-[#1E293B] px-3 py-2 font-medium">
                            Role
                          </th>
                          <th scope="col" className="border-b border-[#1E293B] px-3 py-2 font-medium">
                            Model
                          </th>
                          <th scope="col" className="border-b border-[#1E293B] px-3 py-2 font-medium">
                            Runtime / quota lane
                          </th>
                          <th scope="col" className="border-b border-[#1E293B] px-3 py-2 font-medium">
                            Authorship scope
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {AGENT_SWARM.map((agent, index) => (
                          <tr key={agent.model} className="align-top hover:bg-[#111827]/60">
                            <td className="border-b border-[#1E293B]/70 px-3 py-2.5 font-mono text-[10px] tabular-nums text-[#475569]">
                              {formatIndex(index + 1)}
                            </td>
                            <td className="border-b border-[#1E293B]/70 px-3 py-2.5 font-mono text-[10.5px] leading-snug text-[#E2E8F0]">
                              {agent.role}
                            </td>
                            <td className="border-b border-[#1E293B]/70 px-3 py-2.5 font-mono text-[10.5px] leading-snug">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className="inline-block h-1.5 w-1.5"
                                  style={{ backgroundColor: agent.accent }}
                                />
                                <span style={{ color: agent.accent }}>{agent.model}</span>
                              </span>
                            </td>
                            <td className="border-b border-[#1E293B]/70 px-3 py-2.5 font-mono text-[10px] leading-snug text-[#94A3B8]">
                              {agent.runtime}
                            </td>
                            <td className="border-b border-[#1E293B]/70 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-[#94A3B8]">
                              {agent.scope}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#475569]">
                    Human direction: 5-member student team &middot; all model output reviewed, corrected, and
                    accepted by the crew &middot; no NASA endorsement implied.
                  </p>
                </section>

                {/* Engineering limitations */}
                <section>
                  <div className="flex items-center gap-2">
                    <SectionHeading icon={<AlertTriangle size={11} strokeWidth={2} />} label="Engineering model limitations" />
                  </div>
                  <div className="mt-2 border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#EF4444]">
                      Radiation: 1-D exponential water-wall attenuation approximation
                    </p>
                    <ul className="mt-2 space-y-2">
                      {LIMITATIONS.map((limitation, index) => (
                        <li key={limitation} className="flex gap-2.5">
                          <span className="mt-[3px] shrink-0 font-mono text-[9px] tabular-nums text-[#EF4444]/80">
                            {formatIndex(index + 1)}
                          </span>
                          <span className="font-mono text-[10.5px] leading-relaxed text-[#CBD5E1]">
                            {limitation}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <p className="border-t border-[#1E293B] pt-3 font-mono text-[9.5px] leading-relaxed uppercase tracking-[0.1em] text-[#475569]">
                  Sources: NASA BVAD (NASA/TP-2015-218570/REV2), LRO LOLA Shackleton Connecting Ridge horizon
                  mask, August 4 1972 Solar Particle Event reconstruction (GOES / King 1974), LRO CRaTER &amp;
                  NASA OLTARIS water-wall attenuation, NASA-STD-3001. Figures shown are reconstructions for
                  challenge demonstration, not flight data.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-[#1E293B] bg-[#111827] px-5 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[#475569]">
            <span className="tabular-nums">
              {tab === "citations" && selected
                ? `Active: ${selected.code} / ${selected.documentNumber}`
                : "Disclosure: SI swarm + model limits"}
            </span>
            <span className="flex items-center gap-3">
              <span className="hidden sm:inline">Esc close &middot; Tab cycles</span>
              <button
                type="button"
                onClick={onClose}
                className="border border-[#1E293B] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#94A3B8] transition-colors hover:border-[#06B6D4] hover:text-[#06B6D4] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#06B6D4]"
              >
                Return to flight deck
              </button>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <h4 className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#64748B]">
      <span className="text-[#F59E0B]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </h4>
  );
}

export default NasaSourceModal;