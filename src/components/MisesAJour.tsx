import { useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type Etat = "idle" | "verif" | "aucune" | "dispo" | "install" | "erreur";

export function MisesAJour() {
  const [etat, setEtat] = useState<Etat>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("");

  async function verifier() {
    setEtat("verif");
    setMessage("");
    try {
      const maj = await check();
      if (maj) {
        setUpdate(maj);
        setEtat("dispo");
      } else {
        setEtat("aucune");
      }
    } catch (e) {
      setMessage(String(e));
      setEtat("erreur");
    }
  }

  async function installer() {
    if (!update) return;
    setEtat("install");
    setMessage("");
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setMessage(String(e));
      setEtat("erreur");
    }
  }

  return (
    <div className="carte-form">
      <h3 className="form-titre">Mises à jour</h3>

      {etat === "dispo" && update ? (
        <>
          <p>
            Nouvelle version <strong>{update.version}</strong> disponible
            {update.currentVersion && ` (actuelle : ${update.currentVersion})`}.
          </p>
          {update.body && <p className="maj-notes">{update.body}</p>}
          <button className="btn-primary" onClick={installer}>
            Télécharger et installer
          </button>
        </>
      ) : etat === "install" ? (
        <p className="aide">
          Téléchargement et installation en cours… l'application redémarrera
          automatiquement.
        </p>
      ) : (
        <>
          <p className="aide">
            {etat === "aucune"
              ? "Vous utilisez déjà la dernière version."
              : "Vérifiez si une nouvelle version est disponible."}
          </p>
          <button onClick={verifier} disabled={etat === "verif"}>
            {etat === "verif" ? "Vérification…" : "Vérifier les mises à jour"}
          </button>
        </>
      )}

      {etat === "erreur" && <p className="erreur">{message}</p>}
    </div>
  );
}
