import { useEffect, useState } from "react";
import { getParametres, saveParametres } from "../api/client";
import type { Parametres } from "../api/types";
import { useToast } from "../components/toast-context";
import { MisesAJour } from "../components/MisesAJour";

const VIDE: Parametres = {
  cabinet_nom: null,
  email: null,
  telephone: null,
  coordonnees_paiement: null,
  logo: null,
};

export function ParametresPage() {
  const { showToast } = useToast();
  const [p, setP] = useState<Parametres>(VIDE);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getParametres()
      .then((v) => setP({ ...VIDE, ...v }))
      .catch((e) => setErreur(String(e)));
  }, []);

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

      <MisesAJour />
    </section>
  );
}
