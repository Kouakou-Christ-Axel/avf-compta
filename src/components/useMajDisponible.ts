import { useEffect, useState } from "react";

/**
 * Vérifie une seule fois au lancement s'il existe une version plus récente.
 *
 * La vérification était uniquement manuelle, enfouie dans les Paramètres : les
 * utilisateurs restaient sur une version ancienne sans le savoir. L'échec est
 * volontairement silencieux — être hors ligne est un cas normal, pas une
 * erreur à signaler.
 */
export function useMajDisponible(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const maj = await check();
        if (!annule && maj) setVersion(maj.version);
      } catch {
        // Hors ligne, ou hors application de bureau : on n'affiche rien.
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  return version;
}
