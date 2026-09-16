# SpeedArti — CALPI V0.3.0 — Optimisation 2D des chutes

Démonstration autonome du module métier de calepinage SpeedArti.

## Nouveauté V0.3.0

Cette version remplace la gestion conservatrice des chutes complexes par une vraie optimisation 2D orthogonale.

Le moteur sait désormais :
- construire une pièce avec encoche à partir de plusieurs fragments géométriques connectés ;
- conserver la forme exacte d'une chute en L ou d'une autre forme orthogonale ;
- stocker cette chute comme une région 2D réelle et non comme son simple rectangle englobant ;
- vérifier qu'une future pièce tient réellement dans la matière encore disponible ;
- tester une rotation de 90° lorsque l'utilisateur l'autorise ;
- recalculer le reliquat exact après chaque réemploi ;
- séparer automatiquement deux reliquats physiquement distincts en deux chutes différentes ;
- conserver la filiation d'une chute vers les chutes produites après réemploi ;
- interdire tout double usage d'un même identifiant de chute.

## Fonctionnalités conservées

- Rectangle, L, U, T et forme libre orthogonale ;
- rotations de la pièce 0 / 90 / 180 / 270° ;
- 8 familles de matériaux ;
- 5 formats rapides par famille + dimensions manuelles ;
- pose droite ;
- pose 1/2 avec cycle strict sur 2 rangées ;
- pose 1/3 avec cycle strict sur 3 rangées ;
- orientation X / Y ;
- équilibrage des rives ;
- plan de pose ;
- ordre de pose ;
- stock virtuel des chutes ;
- contrôles et balises CALPI.

## Architecture

- `engine.js` : moteur métier pur V0.3.0 ;
- `formats.js` : formats de démonstration ;
- `app.js` : interface ;
- `styles.css` : styles ;
- `tests.js` : tests métier ;
- `FIELDS.md` : contrat des champs ;
- `BALISES.md` : registre des contrôles ;
- `TESTS.md` : plan de tests ;
- `DEPLOY_GITHUB_PAGES.md` : publication ;
- `COMMIT_V0_3_0.txt` : message de commit proposé.

## Important

La rotation 90° des chutes est un réglage utilisateur. Elle doit rester désactivée pour les matériaux directionnels lorsque l'artisan veut conserver le fil, le décor ou le sens de lame.

Aucun prix n'est calculé dans CALPI.

## Test

Exécuter :

`node tests.js`

Résultat attendu :

`CALPI tests V0.3.0: OK`
