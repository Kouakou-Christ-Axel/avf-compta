export function BarreRecherche({
  valeur,
  onChange,
  placeholder = "Rechercher…",
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="recherche-barre">
      <input
        type="search"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Rechercher"
      />
    </div>
  );
}
