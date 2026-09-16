# SpeedArti — CALPI V0.2.0 — Formes

Cette version développe l'étape **Forme** du module de calepinage.

## Formes disponibles
- Rectangle
- L
- U
- T
- Forme libre orthogonale

`Importer un plan` reste volontairement hors V0.2.

## Forme libre
La forme libre utilise un contour de points exacts en millimètres :
- minimum 4 points ;
- dernier point relié automatiquement au premier ;
- segments horizontaux ou verticaux uniquement ;
- auto-croisement interdit ;
- aperçu SVG et surface exacte ;
- coordonnées modifiables point par point.

Des bases Rectangle / L / U / T sont proposées dans l'éditeur pour accélérer la saisie, mais elles restent modifiables.

## Moteur
Le moteur reste pur et indépendant de l'interface.

La géométrie des formes complexes n'est jamais remplacée par un rectangle approximatif. Le moteur calcule un polygone exact puis génère les bandes de pose correspondant réellement à la forme.

### Limitation explicitement tracée
En V0.2, les chutes créées par une **encoche complexe** sont encore optimisées de manière conservatrice comme fragments rectangulaires. La géométrie du plan reste exacte ; cette limite d'optimisation matière est signalée par `CALPI-036`.

## Fichiers
- `engine.js` : moteur métier V0.2.0
- `formats.js` : formats matière
- `app.js` : interface de démonstration
- `styles.css`
- `index.html`
- `tests.js`
- `FIELDS.md`
- `BALISES.md`
- `TESTS.md`

## Tests

`node tests.js`

Résultat attendu :

`CALPI tests V0.2.0: OK`
