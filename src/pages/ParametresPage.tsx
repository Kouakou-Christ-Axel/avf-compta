import { useEffect, useState } from "react";
import {
  getParametres,
  saveParametres,
  listModesPaiement,
  createModePaiement,
  deleteModePaiement,
} from "../api/client";
import type { Parametres, ModePaiement } from "../api/types";
import { useToast } from "../components/toast-context";
import { MisesAJour } from "../components/MisesAJour";

const VIDE: Parametres = {
  cabinet_nom: null,
  sous_titre: null,
  email: null,
  telephone: null,
  coordonnees_paiement: null,
  logo: null,
};

export function ParametresPage() {
  const { showToast } = useToast();
  const [p, setP] = useState<Parametres>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modes, setModes] = useState<ModePaiement[]>([]);
  const [nouveauMode, setNouveauMode] = useState("");

  useEffect(() => {
    getParametres()
      .then((v) => setP({ ...VIDE, ...v }))
      .catch((e) => setErreur(String(e)));
    chargerModes();
  }, []);

  function chargerModes() {
    listModesPaiement()
      .then(setModes)
      .catch((e) => setErreur(String(e)));
  }

  async function ajouterMode(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const libelle = nouveauMode.trim();
    if (!libelle) {
      setErreur("Le libellé du mode est obligatoire.");
      return;
    }
    try {
      await createModePaiement(libelle);
      setNouveauMode("");
      chargerModes();
      showToast("Mode ajouté");
    } catch (err) {
      setErreur(String(err));
    }
  }

  async function supprimerMode(id: number) {
    setErreur(null);
    try {
      await deleteModePaiement(id);
      chargerModes();
      showToast("Mode supprimé");
    } catch (err) {
      setErreur(String(err));
    }
  }

  function maj<K extends keyof Parametres>(cle: K, valeur: Parametres[K]) {
    setP((prev) => ({ ...prev, [cle]: valeur }));
  }

  function choisirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (fichier.size > 500_000) {
      setErreur("Logo trop volumineux (max 500 Ko).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => maj("logo", reader.result as string);
    reader.readAsDataURL(fichier);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    try {
      await saveParametres({
        cabinet_nom: p.cabinet_nom || null,
        sous_titre: p.sous_titre || null,
        email: p.email || null,
        telephone: p.telephone || null,
        coordonnees_paiement: p.coordonnees_paiement || null,
        logo: p.logo || null,
      });
      showToast("Paramètres enregistrés");
    } catch (err) {
      setErreur(String(err));
    }
  }

  return (
    <section className="page">
      <header className="page-tete">
        <div>
          <h2>Paramètres</h2>
          <p className="page-sous">
            Profil du cabinet affiché sur les notes et reçus
          </p>
        </div>
      </header>

      {erreur && <p className="erreur">{erreur}</p>}

      <form className="carte-form" onSubmit={enregistrer}>
        <div className="logo-bloc">
          <div className="logo-apercu">
            {p.logo ? (
              <img src={p.logo} alt="Logo du cabinet" />
            ) : (
              <span className="logo-vide">Aucun logo</span>
            )}
          </div>
          <div className="logo-actions">
            <label className="btn-fichier">
              Choisir un logo
              <input
                type="file"
                accept="image/*"
                onChange={choisirLogo}
                hidden
              />
            </label>
            {p.logo && (
              <button
                type="button"
                className="btn-danger"
                onClick={() => maj("logo", null)}
              >
                Retirer
              </button>
            )}
          </div>
        </div>

        <div className="champs">
          <label>
            <span>Nom du cabinet</span>
            <input
              placeholder="Ex : Cabinet AVF"
              value={p.cabinet_nom ?? ""}
              onChange={(e) => maj("cabinet_nom", e.target.value)}
            />
          </label>
          <label>
            <span>Fonction / sous-titre</span>
            <input
              placeholder="Ex : Expert-comptable"
              value={p.sous_titre ?? ""}
              onChange={(e) => maj("sous_titre", e.target.value)}
            />
          </label>
          <label>
            <span>Téléphone</span>
            <input
              placeholder="01 02 03 04 05"
              value={p.telephone ?? ""}
              onChange={(e) => maj("telephone", e.target.value)}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="cabinet@exemple.ci"
              value={p.email ?? ""}
              onChange={(e) => maj("email", e.target.value)}
            />
          </label>
        </div>

        <label className="champ-bloc">
          <span>Coordonnées de paiement</span>
          <textarea
            rows={3}
            placeholder="Ex : Wave +225 07 00 00 00 00 — Banque ATL, IBAN CI..."
            value={p.coordonnees_paiement ?? ""}
            onChange={(e) => maj("coordonnees_paiement", e.target.value)}
          />
        </label>

        <button type="submit" className="btn-primary">
          Enregistrer
        </button>
      </form>

      <div className="carte-form">
        <h3 className="form-titre">Modes de paiement</h3>

        <form className="champs" onSubmit={ajouterMode}>
          <label>
            <span>Nouveau mode (ex: Espèces, Virement, Wave…)</span>
            <input
              placeholder="Ex : Espèces, Virement, Wave…"
              value={nouveauMode}
              onChange={(e) => setNouveauMode(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary">
            Ajouter
          </button>
        </form>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mode</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {modes.length === 0 ? (
                <tr>
                  <td colSpan={2} className="vide">
                    Aucun mode défini.
                  </td>
                </tr>
              ) : (
                modes.map((m) => (
                  <tr key={m.id}>
                    <td>{m.libelle}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => supprimerMode(m.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MisesAJour />
    </section>
  );
}
