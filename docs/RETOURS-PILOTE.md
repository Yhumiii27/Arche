# Retours du pilote

> Journal des retours des utilisateurs du pilote ([`PILOTE.md`](PILOTE.md) §5). Gravité : **bloquant** (empêche le travail),
> **gênant** (contournable), **suggestion**. Une ligne par retour ; l'état renvoie au commit ou à la PR qui le traite.

| N° | Date | Rôle | Page | Constat | Gravité | État |
|---|---|---|---|---|---|---|
| 1 | 24/10/2026 | responsable produit | Accueil, Registre | Il manque comment ouvrir un CAPEX : un bouton qui guide à travers les étapes et pose toutes les questions de l'ouverture et du cadrage dès le début, le reste pouvant être complété ensuite | gênant | fait : assistant « Ouvrir un CAPEX » (`/open`), bouton sur l'Accueil, le Registre et la carte |
| 2 | 24/10/2026 | responsable produit | Carte des CAPEX | La carte est vide, les CAPEX ouverts n'y apparaissent pas | gênant | fait : base locale antérieure au jeu de démo actuel (`npm run db:reset-demo`) ; un CAPEX sans site localisé est placé au site de sa filiale (« Site à préciser ») ou listé « Hors de la carte » ; étiquette de phase courte |
| 3 | 24/10/2026 | responsable produit | COPIL GPI | Page vide : créer des données fictives | gênant | fait : CPX-SAI-2026-02 (G1 devant le comité depuis le 15/10) et CPX-SAI-2026-03 (G1 décidé le 24/09) |
| 4 | 24/10/2026 | responsable produit | Bibliothèque REX | Page vide : créer des données fictives | gênant | fait : cinq REX publiés de plus (SAI), plusieurs phases et catégories |
| 5 | 24/10/2026 | responsable produit | Menus | Catégories à réorganiser : Portefeuille Groupe, Portefeuille Filiale (avec sélecteur de filiale), Pilotage (pages du seul CAPEX sélectionné) | gênant | fait : sections Portefeuille groupe, Portefeuille filiale (sélecteur de filiale, registre et portefeuille de la filiale, ouverture), Pilotage |
| 6 | 24/10/2026 | responsable produit | En-tête | Remettre le choix de langue en haut à droite, comme dans Keystone | gênant | fait : sélecteur FR / EN de l'en-tête de page |
| 7 | 24/10/2026 | responsable produit | Toutes les pages | Un bouton d'ouverture des actions sur presque toutes les pages (plan d'actions du CAPEX) | gênant | fait : plan d'actions du CAPEX (`/capex/[code]/actions`), « Nouvelle action » en haut de chaque page du CAPEX, « Mes actions » à l'Accueil |
| 8 | 24/10/2026 | responsable produit | CAPEX | Un WBS et un Gantt de tout le CAPEX ; aux niveaux filiale et groupe, une barre de synthèse par CAPEX, sans le détail EPC2i | gênant | fait : page WBS et Gantt du CAPEX (`/capex/[code]/schedule`), « Planning des CAPEX » dans les portefeuilles groupe et filiale (une barre de synthèse par CAPEX) |
| 9 | 24/10/2026 | responsable produit | Toutes les pages | Les boutons de création des actions manquent | gênant | fait : « Nouvelle action » aussi en haut des pages hors CAPEX (Accueil, portefeuilles, carte, registre, COPIL…), avec le choix du CAPEX (le dernier utilisé d'abord) parmi ceux où le profil peut ouvrir une action |
| 10 | 24/10/2026 | responsable produit | Carte des CAPEX | La carte n'affiche toujours rien | gênant | fait : la base locale avait des sites sans coordonnées (jeu de démo antérieur à la livraison 4b) ; un CAPEX sans site localisé dans sa filiale est désormais placé au centre de son pays (« Site à préciser ») ; `npm run db:reset-demo` essaie aussi le compte macOS sans mot de passe (PostgreSQL de Homebrew) |
