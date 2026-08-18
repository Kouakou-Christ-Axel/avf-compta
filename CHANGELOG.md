# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Corrigé (audit production)

- **Un seul reçu par paiement.** Prévisualiser un reçu en créait un nouveau à
  chaque fois : plusieurs numéros pour un même encaissement, et un montant
  compté plusieurs fois dans la liste des reçus. La génération est désormais
  idempotente et le bouton propose « Voir RECU-XXXX » quand le reçu existe
  déjà. La mise à jour dédoublonne automatiquement les reçus existants (le plus
  ancien, celui remis au client, est conservé).
- **Montants « 5.000 » et « 5,000 » acceptés.** Ces saisies étaient rejetées et
  le message d'erreur s'affichait hors écran, en haut de la fenêtre : la
  dépense semblait enregistrée alors qu'elle ne l'était nulle part. L'erreur
  s'affiche maintenant sous le formulaire concerné.
- **Annulation d'un paiement** saisi par erreur, avec ou sans reçu (le reçu
  éventuel est annulé du même coup). Il n'existait aucun moyen de corriger un
  encaissement erroné.
- **Annulation d'une facture refusée tant qu'elle porte des paiements.**
  L'annulation faisait disparaître l'argent réellement encaissé du total
  encaissé et du solde client.
- **Statut recalculé** après annulation d'un reçu, au lieu d'être remis en
  « émise » en dur : une facture soldée par un autre paiement ne se rouvre plus
  à tort. L'opération est désormais transactionnelle.
- **Facture annulée verrouillée** : plus de paiement, de dépense ni de reçu
  possible dessus (un paiement la faisait silencieusement repasser en
  « émise »).
- **Le reçu fige le total et le reste à payer** au moment de l'encaissement.
  Un reçu réimprimé affichait auparavant le solde du jour.
- **Message clair** au lieu de l'erreur SQLite « FOREIGN KEY constraint
  failed » quand on supprime une prestation déjà facturée.
- La dernière dépense saisie apparaît en tête de liste, et une confirmation est
  demandée avant suppression.

### Corrigé (lot 3 : dette technique)

- **Numérotation des factures et des reçus dérivée du dernier numéro attribué**
  et non plus d'un décompte : un trou dans la série faisait reculer la séquence
  et deux documents pouvaient porter la même référence.
- **Suppression définitive d'une facture retirée.** La commande existait, sans
  garde-fou, et effaçait en cascade les lignes et les dépenses associées.
  L'annulation reste la voie normale : elle conserve la pièce.
- **Enregistrement d'un paiement transactionnel** : séparées, l'insertion et la
  mise à jour du statut pouvaient laisser un encaissement sur une facture
  restée « émise ».
- **Enregistrement des paramètres fiable** même si la ligne de profil manque
  (base ancienne restaurée) : c'était un échec silencieux, avec un message de
  succès.
- **Montant trop élevé refusé à la saisie.** Un total qui dépasse les limites
  de calcul basculait silencieusement en flottant côté base et provoquait plus
  tard une erreur incompréhensible.
- **Messages « introuvable » nommant la pièce** (paiement, reçu) au lieu de
  « aucune ligne ».
- **Index de lecture ajoutés** sur les colonnes utilisées par les listes et les
  cumuls, qui balayaient les tables entières.
- **Vérification des mises à jour au démarrage** avec un bandeau discret : elle
  n'existait qu'enfouie dans les Paramètres, et les utilisateurs restaient sur
  une version ancienne sans le savoir.
- Retrait de l'export PDF interne (inaccessible depuis l'interface depuis le
  passage à l'impression) et de la dépendance `pdfmake` qu'il portait.

### Ajouté (lot 2 : ergonomie et correction de saisie)

- **Modification d'un client, d'une prestation et d'une facture.** Une erreur
  de saisie ne se corrigeait pas : il fallait supprimer et recommencer. Une
  facture reste modifiable tant qu'aucun paiement n'y est enregistré ; elle se
  verrouille ensuite, parce qu'un reçu déjà remis atteste d'un montant. Le
  nouveau prix d'une prestation ne s'applique qu'aux factures suivantes.
- **Date d'émission choisissable** à la création d'une facture (reprise
  d'historique) et **quantité saisissable** directement, au lieu d'un clic par
  unité.
- **Dépenses sans facture** : loyer, carburant et autres charges du cabinet
  peuvent enfin être enregistrés. Elles comptent dans les dépenses du tableau
  de bord, sans entrer dans la marge d'un client.
- **Sauvegarde et restauration de la base** depuis les Paramètres. La
  restauration prend effet au redémarrage et conserve la base précédente sous
  « .avant-restauration ».
- **Modes de paiement pré-remplis** (Espèces, Virement, Mobile Money, Chèque) :
  la liste déroulante de l'encaissement était vide à l'installation.

### Corrigé (lot 2)

- **Le filtre de période du tableau de bord s'applique aux cartes chiffrées**,
  et plus seulement aux graphiques — les deux moitiés de l'écran affichaient
  des périodes différentes sans que rien ne l'indique.
- **Impression** : le document n'est plus tronqué à la première page. La
  fenêtre modale qui le contient limitait la hauteur imprimable.
- **Message clair** au lieu de l'erreur SQLite à la suppression d'un client
  ayant des factures.
- **Confirmation** avant la suppression d'un client, d'une dépense ou d'un mode
  de paiement.
- **Logo** : re-sélectionner le même fichier après « Retirer » fonctionne.
- **Colonne « Annulé »** dans l'export CSV des reçus, et « Charge du cabinet »
  pour une dépense sans facture dans l'export des dépenses.
- **Indicateur de chargement** sur toutes les listes, qui affichaient « aucune
  donnée » pendant le chargement, et **boutons verrouillés** pendant
  l'enregistrement (double soumission possible, y compris sur les paiements).
- La date par défaut du formulaire de dépense suit le jour courant même si
  l'application reste ouverte après minuit.
- **Fenêtre agrandie** (1280×820, minimum 900×600) et mise en page adaptée aux
  écrans étroits : les tableaux débordaient à la taille par défaut.

### Ajouté

- **Remise sur facture**, globale, en francs ou en pourcentage. Elle est
  déduite du total partout de la même façon (facture, liste, fiche client,
  tableau de bord) et détaillée à l'impression.
- **Archivage d'une prestation** : elle disparaît des nouvelles factures sans
  toucher aux factures passées, où libellé et prix restent figés.
- **Filigrane « ANNULÉE »** à l'impression d'une facture annulée.

### Ajouté / Modifié (lot 9–16)

- **« Notes de frais » renommées « Factures »** dans toute l'interface.
- **Tableau de bord** : courbes mensuelles Chiffre d'affaires et Dépenses, et
  histogramme de la Marge, avec **filtre par plage de dates** (recharts).
- **Marge par client** : colonne Marge (facturé − dépenses) dans la liste clients.
- **Modes de paiement configurables** (créés dans Paramètres) + menu déroulant
  lors de l'encaissement.
- **Nom du client** ajouté à la liste des reçus (+ montant).
- **Annulation douce** d'une facture ou d'un reçu : marquée « Annulé(e) »,
  conservée mais exclue des totaux, soldes et statistiques (le reçu annulé
  rouvre la facture).

### Modifié / Ajouté

- Boutons d'export PDF remplacés par **Imprimer** (plus simple et fiable ;
  depuis la fenêtre d'impression on peut « Enregistrer en PDF », au format
  voulu). Note de frais imprimable comme les reçus.
- Nouvelle page **Dépenses** : création de dépenses (liées à une note) et
  récapitulatif global avec total, suppression et export CSV.

### Ajouté (import/export &amp; documents)

- **Import/export CSV** : import d'une liste de clients (avec modèle
  téléchargeable à remplir) et export CSV des clients, reçus, notes de frais et
  dépenses.
- **Reçu** : la liste des prestations de la note y figure désormais.
- **Profil cabinet** : champ « Fonction / sous-titre » paramétrable (remplace le
  « Cabinet comptable » figé) repris sur les reçus et les PDF.

### Corrigé / Ajouté (export PDF)

- **Export PDF réparé** : enregistrement via une vraie boîte « Enregistrer sous »
  (dialogue Tauri + écriture par le backend) au lieu d'un téléchargement bloqué
  par la WebView.
- Boutons d'export **directement dans les listes** (Reçus et Notes de frais).
- **Reçus exportables en A5** (en plus de l'A4).

### Ajouté

- **Mises à jour intégrées** : la page Paramètres permet de vérifier, télécharger
  et installer la dernière version directement depuis l'application (plugin
  updater Tauri, mises à jour signées, source = GitHub Releases). Les releases
  sont désormais publiées directement (plus de brouillon).
- **Cumuls par client** : colonnes Montant (facturé), Payé et Restant dans la
  liste des clients.
- **Échéances** sur les notes de frais : date d'échéance, badge « En retard »,
  bannière de rappel et notification système pour les notes échues impayées.
- **Module dépenses** : dépenses rattachées à une note de frais et calcul de la
  **marge** (total facturé − cumul des dépenses) dans le détail de la note.

### Corrigé

- L'export PDF ne produisait rien : les polices pdfmake (0.3) doivent être
  enregistrées via `addVirtualFileSystem` ; un toast confirme désormais la
  génération ou signale l'échec.

### Ajouté

- Saisie de la **date de paiement** lors de l'encaissement (par défaut
  aujourd'hui).

- **Référence de note auto-générée** au format `AA-MM-NNNN` (séquence remise à
  zéro chaque mois) — plus de saisie manuelle.
- **Export PDF** des notes de frais et des reçus (via pdfmake).
- **Profil du cabinet** (page Paramètres) : logo, nom, téléphone, email et
  coordonnées de paiement, repris sur les notes/reçus imprimés et les PDF.

### Modifié

- Devise passée à l'**euro → franc CFA (XOF)** : montants en francs entiers
  (pas de sous-unité), affichage « 150 000 FCFA » côté Rust et React.

### Ajouté

- **Reçu imprimable** : aperçu détaillé (cabinet, client, note, montant) et
  impression via le navigateur (commande `get_recu`, jointure dédiée).
- **Copier au clic** sur l'email et le téléphone d'un client, avec un toast
  « Copié ».
- Interface retravaillée : barre latérale, cartes du tableau de bord, badges
  de statut, fenêtres modales, notifications toast.

### Ajouté (v1 initiale)

- Domaine comptable complet (backend Rust + SQLite) : clients, prestations,
  notes de frais composées de prestations (prix figés), paiements avec refus
  des sur-paiements, reçus numérotés et statistiques agrégées.
- Interface React française : gestion des clients, prestations, notes de frais
  (création, détail, paiements, reçus) et tableau de bord.
- Développement en TDD : tests unitaires Rust (SQLite en mémoire) et tests
  frontend (Vitest + Testing Library, mock IPC Tauri).
- Intégration continue (lint, format, tests Rust + frontend) et workflow de
  release produisant les bundles Windows (`.msi`, `.exe`/NSIS) sur tag `vX.Y.Z`.
