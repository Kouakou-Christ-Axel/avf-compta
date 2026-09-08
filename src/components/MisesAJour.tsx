import { useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";

type Etat =
  | "idle"
  | "verif"
  | "aucune"
  | "dispo"
  | "avertissement"
  | "install"
  | "erreur";

/** Octets reçus / total, pour la barre de progression du téléchargement. */
interface Progression {
  recus: number;
  total: number | null;
}

function pourcentage({ recus, total }: Progression): number | null {
  if (total === null || total <= 0) return null;
  return Math.min(100, Math.round((recus / total) * 100));
}

export function MisesAJour() {
  const [etat, setEtat] = useState<Etat>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("");
  const [progression, setProgression] = useState<Progression>({
    recus: 0,
    total: null,
  });

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
    setProgression({ recus: 0, total: null });
    try {
      // L'installateur n'est pas signé : Windows affiche « Éditeur inconnu »
      // et l'application se ferme pour lui laisser la main. Sans la
      // progression, cette fermeture passait pour un plantage.
      await update.downloadAndInstall((evenement) => {
        if (evenement.event === "Started") {
          setProgression({
            recus: 0,
            total: evenement.data.contentLength ?? null,
          });
        } else if (evenement.event === "Progress") {
          setProgression((p) => ({
            recus: p.recus + evenement.data.chunkLength,
            total: p.total,
          }));
        }
      });
      // Pas de `relaunch()` ici : sous Windows, l'application est déjà arrêtée
      // pour que l'installateur remplace ses fichiers, et c'est lui qui la
      // relance. L'appel n'était jamais atteint.
    } catch (e) {
      setMessage(String(e));
      setEtat("erreur");
    }
  }

  const pct = pourcentage(progression);

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
          <button
            className="btn-primary"
            onClick={() => setEtat("avertissement")}
          >
            Télécharger et installer
          </button>
        </>
      ) : etat === "avertissement" ? (
        <>
          <p className="avertissement-maj">
            <strong>Avant de continuer, à lire :</strong> Windows va afficher un
            écran bleu « Windows a protégé votre ordinateur ». C'est normal,
            l'application n'est pas signée par un éditeur reconnu.
          </p>
          <ol className="aide">
            <li>
              Cliquez sur <strong>Informations complémentaires</strong>, puis
              sur <strong>Exécuter quand même</strong>.
            </li>
            <li>
              L'application va <strong>se fermer</strong> le temps de
              l'installation, puis se rouvrira.
            </li>
            <li>
              <strong>N'interrompez pas l'installation</strong> : si vous
              l'annulez, il faudra réinstaller l'application à la main.
            </li>
          </ol>
          <div className="modal-actions">
            <button className="btn-primary" onClick={installer}>
              J'ai compris, installer
            </button>
            <button onClick={() => setEtat("dispo")}>Plus tard</button>
          </div>
        </>
      ) : etat === "install" ? (
        <>
          <p className="aide">
            {pct === null
              ? "Téléchargement en cours…"
              : `Téléchargement… ${pct} %`}
          </p>
          {pct !== null && (
            <progress
              className="maj-progression"
              value={pct}
              max={100}
              aria-label="Progression du téléchargement"
            />
          )}
          <p className="aide">
            L'application va se fermer pour installer la mise à jour. Pensez à
            autoriser l'installateur si Windows le demande.
          </p>
        </>
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

      {etat === "erreur" && (
        <>
          <p className="erreur">{message}</p>
          <p className="aide">
            L'installation n'a pas abouti. Votre version actuelle reste en place
            ; vous pouvez réessayer, ou installer la dernière version à la main
            depuis la page des versions du projet.
          </p>
        </>
      )}
    </div>
  );
}
