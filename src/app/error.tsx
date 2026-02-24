"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        S'ha produït un error
      </h2>
      <p className="text-gray-600 mb-6">
        No s'han pogut carregar les dades. Pot ser un problema temporal amb
        l'API de dades obertes.
      </p>
      <p className="text-sm text-gray-400 mb-6 font-mono">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        Tornar a intentar
      </button>
    </div>
  );
}
