"use client";

// Hash router ligero para la SPA (única ruta visible del sandbox).
// Solo los hashes con "#/" son rutas; los anclas simples (#seccion) no tocan
// la navegación (los links del nav usan scrollIntoView programático).
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function parseHash(hash: string): string[] {
  if (!hash.startsWith("#/")) return [];
  return hash.replace(/^#\//, "").replace(/\/+$/, "").split("/").filter(Boolean);
}

export function useHashRoute(): [string[], (path: string) => void] {
  // El estado inicial es SIEMPRE vacío (idéntico al render del servidor).
  // El hash real se lee al montar, antes del primer paint: así abrir un enlace
  // directo tipo .../#/reservar no rompe la hidratación (el servidor no puede
  // conocer el hash, que vive solo en el navegador).
  const [segments, setSegments] = useState<string[]>([]);

  useIsomorphicLayoutEffect(() => {
    const initial = parseHash(window.location.hash);
    if (initial.length > 0) setSegments(initial);

    const onChange = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#" || hash === "#/") {
        setSegments([]);
        window.scrollTo(0, 0);
        return;
      }
      if (!hash.startsWith("#/")) return; // ancla interna: sin cambio de ruta
      setSegments(parseHash(hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const target = path === "" || path === "/" ? "#/" : `#/${path.replace(/^[#/]+/, "").replace(/\/+$/, "")}`;
    if (window.location.hash === target) {
      setSegments(parseHash(target));
      window.scrollTo(0, 0);
    } else {
      window.location.hash = target;
    }
  }, []);

  return [segments, navigate];
}

/** Navega a inicio y hace scroll suave a una sección (con espera al render). */
export function useScrollToSection(navigate: (path: string) => void, isHome: boolean) {
  return useCallback(
    (id: string) => {
      if (!isHome) navigate("");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, isHome ? 0 : 80);
    },
    [navigate, isHome]
  );
}
