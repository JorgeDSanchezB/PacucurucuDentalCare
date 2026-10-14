"use client";

// Igual que useReducedMotion() de framer-motion, pero seguro para la hidratación.
// El hook original lee window.matchMedia(...) durante el primer render del
// navegador, así que cuando el visitante tiene "reducir movimiento" activado en
// su sistema devuelve true en el cliente mientras el servidor devolvió false:
// el HTML inicial y el primer render del navegador ya no coinciden y React
// lanza el error "A tree hydrated but some attributes... didn't match".
//
// Esta variante siempre devuelve false en el primer render (igual que el
// servidor) y detecta la preferencia real justo antes del primer paint,
// así el HTML y la hidratación coinciden y los usuarios con movimiento
// reducido siguen viendo el contenido sin animaciones.
import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
