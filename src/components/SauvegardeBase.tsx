import { useEffect, useState } from "react";
import { cheminBase, restaurerBase, sauvegarderBase } from "../api/client";
import { useToast } from "./toast-context";

type Etat = "idle" | "travail" | "a-redemarrer";

/**
 * Sauvegarde et restauration du fichier de comptabilité.
 *
 * La restauration ne prend effet qu'au redémarrage : le fichier de base ne
 * peut pas être remplacé tant que l'application le tient ouvert.
 */
export function SauvegardeBase() {
  const { showToast } = useToast();
  const [chemin, setChemin] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>("idle");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    cheminBase()
      .then(setChemin)
      .catch(() => setChemin(null));
  }, []);

  // La boîte « Enregistrer sous »/« Ouvrir » s'ouvre côté Rust (voir
  // commands::sauvegarde) : le chemin ne transite jamais par le JS, pour
  // qu'un renderer compromis ne puisse pas le falsifier.
  async function sauvegarder() {
    setErreur(null);
    setEtat("travail");
    try {
      const fait = await sauvegarderBase();
      if (fait) showToast("Sauvegarde enregistrée");
    } catch (e) {
      setErreur(String(e));
    } finally {
      setEtat("idle");
    }
  }

  async function restaurer() {
    setErreur(null);
    if (
      !confirm(
        "Restaurer une sauvegarde ? Toutes les données actuelles seront " +
          "remplacées au redémarrage. La base actuelle est conservée à côté " +
          "sous « .avant-restauration ». Le fichier sera choisi dans la " +
          "boîte de dialogue qui va s'ouvrir.",
      )
    )
      return;
    setEtat("travail");
    try {
      const fait = await restaurerBase();
      if (fait) setEtat("a-redemarrer");
      else setEtat("idle");
    } catch (e) {
      setErreur(String(e));
      setEtat("idle");
    }
  }

  async function redemarrer() {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  }

  return (
    <div className="carte-form">
      <h3 className="form-titre">Sauvegarde des données</h3>

      {etat === "a-redemarrer" ? (
        <>
          <p className="aide">
            La sauvegarde sera appliquée au redémarrage de l'application.
          </p>
          <button className="btn-primary" onClick={redemarrer}>
            Redémarrer maintenant
          </button>
        </>
      ) : (
        <>
          <p className="aide">
            Toute la comptabilité tient dans un seul fichier. Enregistrez-en une
            copie régulièrement, sur une clé USB ou un disque externe.
          </p>
          {chemin && <p className="aide chemin-base">{chemin}</p>}
          <div className="form-pied">
            <button
              className="btn-primary"
              onClick={sauvegarder}
              disabled={etat === "travail"}
            >
              Enregistrer une sauvegarde
            </button>
            <button onClick={restaurer} disabled={etat === "travail"}>
              Restaurer une sauvegarde…
            </button>
          </div>
        </>
      )}

      {erreur && <p className="erreur">{erreur}</p>}
    </div>
  );
}
