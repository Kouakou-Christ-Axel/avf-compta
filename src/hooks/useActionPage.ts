import { useCallback } from "react";
import { useToast } from "../components/toast-context";

/** Options d'une action : confirmation préalable et message de succès. */
export interface OptionsAction {
  /** Question posée avant d'agir. L'action est abandonnée si l'utilisateur refuse. */
  confirmation?: string;
  /** Toast affiché quand l'action a réussi. */
  succes?: string;
}

/**
 * Exécute une action de page en gérant ce qui l'entourait à l'identique dans
 * chaque page : la confirmation, l'effacement de l'erreur précédente, le
 * `try/catch` qui affiche l'échec sous le formulaire, et le toast de succès.
 *
 * Ce qui reste propre à chaque page — l'ordre des rechargements, la remise à
 * zéro d'un formulaire — vit dans l'action elle-même, où il se lit.
 *
 * Une action qui renvoie `false` est considérée comme abandonnée et ne
 * déclenche pas de toast : c'est le cas des exports, où l'utilisateur peut
 * fermer la boîte « Enregistrer sous ».
 *
 * Renvoie `true` si l'action est allée au bout.
 */
export function useActionPage(setErreur: (message: string | null) => void) {
  const { showToast } = useToast();

  return useCallback(
    async (
      action: () => Promise<unknown>,
      { confirmation, succes }: OptionsAction = {},
    ): Promise<boolean> => {
      if (confirmation !== undefined && !confirm(confirmation)) return false;
      setErreur(null);
      try {
        const resultat = await action();
        if (succes !== undefined && resultat !== false) showToast(succes);
        return resultat !== false;
      } catch (err) {
        setErreur(String(err));
        return false;
      }
    },
    [setErreur, showToast],
  );
}
