import { useToast } from "./toast-context";

/** Texte cliquable qui copie sa valeur dans le presse-papiers + toast. */
export function CopyText({ value, label }: { value: string; label?: string }) {
  const { showToast } = useToast();

  async function copier() {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`Copié : ${value}`);
    } catch {
      showToast("Copie impossible");
    }
  }

  return (
    <button
      type="button"
      className="copie"
      title="Cliquer pour copier"
      onClick={copier}
    >
      {label ?? value}
      <span className="copie-icone" aria-hidden>
        ⧉
      </span>
    </button>
  );
}
