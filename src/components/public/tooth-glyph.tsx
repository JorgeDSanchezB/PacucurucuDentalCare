"use client";

// Glifo de molar: firma gráfica lineal (trazo 1.5, terminales redondeados).
// Sustituye a las iniciales-monograma: identidad dental propia, no placeholder.
export function ToothGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 3.2 C8.6 3.2 6.1 5 6.6 8 C6.9 9.7 7.5 10.9 7.5 13 C7.5 16 8 20.2 9.4 20.2 C10.7 20.2 10.7 16.4 12 16.4 C13.3 16.4 13.3 20.2 14.6 20.2 C16 20.2 16.5 16 16.5 13 C16.5 10.9 17.1 9.7 17.4 8 C17.9 5 15.4 3.2 12 3.2 Z" />
    </svg>
  );
}
