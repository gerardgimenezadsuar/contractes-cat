"use client";

import { useState } from "react";

export default function Disclaimer() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="text-amber-900 text-sm">
      <div className="max-w-7xl mx-auto mt-2 mx-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-center gap-2">
        <p className="text-center flex-1">
          <strong>Avís:</strong> Aquesta no és una web oficial del govern. Les dades
          provenen del conjunt &quot;Contractació pública a Catalunya&quot; de la{" "}
          <a
            href="https://analisi.transparenciacatalunya.cat"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-700"
          >
            Plataforma de Transparència
          </a>{" "}
          i pot no incloure la totalitat dels contractes públics de Catalunya.
        </p>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
          aria-label="Tanca avís"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
