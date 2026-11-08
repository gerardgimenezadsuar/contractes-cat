"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExampleProfile } from "@/lib/home-examples";

const ROTATE_MS = 8000;

function Slide({ profile }: { profile: ExampleProfile }) {
  const max = Math.max(...profile.years.map((y) => y.total), 1);
  const sections = [
    { label: "Resum", hash: "" },
    { label: "Contractes", hash: "#contractes" },
    { label: "Administradors", hash: "#administradors" },
    { label: "Empreses relacionades", hash: "#relacionades" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 sm:px-5">
        <Link href={profile.href} className="block font-display text-lg font-semibold leading-snug text-gray-900 hover:underline">
          {profile.name}
        </Link>
        <p className="font-mono text-xs text-gray-500">{profile.nif}</p>
        <nav aria-label="Seccions de la fitxa" className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 text-[13px] text-gray-500 sm:-mx-5 sm:px-5">
          {sections.map((s, i) => (
            <Link
              key={s.label}
              href={`${profile.href}${s.hash}`}
              className={`shrink-0 pb-2 hover:text-gray-900 ${i === 0 ? "border-b-2 border-accent font-medium text-accent" : ""}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="border-b border-gray-200 px-4 py-3 sm:border-r sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Adjudicat</p>
          <p className="font-display text-2xl font-semibold text-gray-900 tabular-nums">{profile.totalLabel}</p>
          <p className="text-xs text-gray-500">{profile.contractsLabel}</p>
        </div>
        <div className="border-b border-gray-200 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Per any · {profile.firstYear}–{profile.lastYear}
          </p>
          <svg
            viewBox={`0 0 ${profile.years.length * 20} 48`}
            className="mt-1 h-12 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Import adjudicat per any"
          >
            {profile.years.map((y, i) => {
              const h = y.total > 0 ? Math.max(2, (y.total / max) * 44) : 1;
              return (
                <rect
                  key={y.year}
                  x={i * 20 + 3}
                  y={48 - h}
                  width={14}
                  height={h}
                  rx={2}
                  className={y.total > 0 ? "fill-accent" : "fill-gray-200"}
                  opacity={i === profile.years.length - 1 ? 1 : 0.55}
                >
                  <title>{y.label}</title>
                </rect>
              );
            })}
          </svg>
        </div>
        <div className={`px-4 py-3 sm:col-span-2 sm:px-5 ${profile.group ? "border-b border-gray-200" : ""}`}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Qui la controla · BORME</p>
          <ul className="mt-1 space-y-1 text-[13px]">
            {profile.people.map((p) => (
              <li key={p.key} className="flex items-baseline justify-between gap-2">
                {p.href ? (
                  <Link href={p.href} className="min-w-0 truncate text-gray-900 hover:underline">
                    {p.label}
                  </Link>
                ) : (
                  <span className="min-w-0 truncate text-gray-900">{p.label}</span>
                )}
                <span className="shrink-0 text-xs text-gray-500">{p.role}</span>
              </li>
            ))}
          </ul>
        </div>
        {profile.group ? (
          <div className="px-4 py-3 sm:col-span-2 sm:px-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Grup empresarial</p>
            <Link href={profile.group.href} className="mt-1 block truncate text-[13px] text-gray-900 hover:underline">
              {profile.group.name}
            </Link>
            <p className="text-xs text-gray-500">{profile.group.detail}</p>
          </div>
        ) : null}
      </div>

      <Link
        href={profile.href}
        className="mt-auto flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent-soft sm:px-5"
      >
        Veure la fitxa completa
        <span aria-hidden>&rarr;</span>
      </Link>
    </div>
  );
}

/**
 * A few real company profiles shown one at a time. Rotates every few seconds,
 * pauses while hovered or focused, and never auto-rotates for people who ask
 * for reduced motion. All slides share one grid cell, so the card keeps the
 * height of the tallest and nothing below it jumps.
 */
export default function ExampleProfiles({ profiles }: { profiles: ExampleProfile[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = profiles.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <article
      aria-roledescription="carrusel"
      aria-label="Exemples de fitxa d'empresa"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_12px_32px_-12px_rgb(15_94_99/0.25)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-accent">Exemple de fitxa d&apos;empresa</p>
        {count > 1 ? (
          <div className="flex items-center gap-1">
            {profiles.map((p, i) => (
              <button
                key={p.nif}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Exemple ${i + 1} de ${count}: ${p.name}`}
                aria-current={i === index}
                className="flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className={`block h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1.5 bg-gray-300"}`} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="grid">
        {profiles.map((profile, i) => (
          <div
            key={profile.nif}
            aria-hidden={i !== index}
            inert={i !== index}
            className={`[grid-area:1/1] transition-opacity duration-500 motion-reduce:transition-none ${
              i === index ? "opacity-100" : "invisible opacity-0"
            }`}
          >
            <Slide profile={profile} />
          </div>
        ))}
      </div>
    </article>
  );
}
