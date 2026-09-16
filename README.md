# SpeedArti — CALPI V0.1.2 — Module complet

Démonstration autonome du module métier de calepinage SpeedArti.

## Contenu de cette version

- moteur métier pur séparé de l'interface (`engine.js`)
- catalogue de formats de démonstration séparé (`formats.js`)
- interface multi-étapes (`app.js`)
- 8 familles visibles :
  - Parquet massif
  - Parquet contrecollé
  - Stratifié
  - Carrelage
  - Lame PVC
  - Dalle PVC
  - Dalle terrasse
  - Lame terrasse bois/composite
- 5 formats rapides par famille
- option `Dimensions manuelles` pour saisir les dimensions exactes
- pose droite
- pose décalée 1/2 avec cycle strict sur 2 rangées
- pose décalée 1/3 avec cycle strict sur 3 rangées
- orientation longueur / largeur
- équilibrage première / dernière rive
- stock virtuel des chutes
- priorité au réemploi d'une chute compatible avant ouverture d'un élément neuf
- traçabilité des chutes et interdiction du double usage
- plan de pose
- ordre de pose
- contrôles et balises CALPI
- tests automatiques

## Architecture

- `index.html` : entrée de la démo GitHub Pages
- `app.js` : interface utilisateur
- `styles.css` : styles de démonstration
- `engine.js` : moteur métier pur — source à préserver lors de l'intégration SpeedArti
- `formats.js` : formats de démonstration sélectionnables
- `tests.js` : tests automatiques
- `FIELDS.md` : contrat des champs
- `BALISES.md` : registre des contrôles
- `TESTS.md` : plan de tests métier
- `DEPLOY_GITHUB_PAGES.md` : procédure de publication
- `VERSION.txt` : version du pack

## Règles importantes

Les formats proposés sont des formats de démonstration et non une base fabricant contractuelle.
L'utilisateur peut toujours sélectionner `Dimensions manuelles`.

Aucun prix n'est calculé dans CALPI.

Le moteur ne doit jamais approximer silencieusement une donnée technique manquante.

## Test

Exécuter :

`node tests.js`

Résultat attendu :

`CALPI tests V0.1.2: OK`

## GitHub Pages

Le dépôt prévu est :

`thibaultmourlane7/speedarti-calepinage-demo`

La publication doit utiliser la branche `main` et le dossier racine `/`.
