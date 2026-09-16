# CALPI — Plan de tests métier V0.2.0

## Régression V0.1.2
- 8 familles de matériaux.
- 5 formats rapides par famille.
- saisie manuelle conservée.
- pose 1/2 : `1380 / 690 / 1380 / 690 ...`.
- pose 1/3 : `1380 / 920 / 460 / 1380 ...`.
- anti-double-usage des chutes.

## Rectangle
- 5000 × 4000 = 20 m² exacts.

## L
- extérieur 5000 × 4000.
- décroché 2000 × 1500.
- surface attendue : 17 m².
- rotation 90° : surface identique et boîte englobante inversée.

## U
- extérieur 5000 × 4000.
- ouverture 2000 × 1500, décalage 1500.
- surface attendue : 17 m².
- une ouverture qui touche un bord latéral est BLOQUANTE car elle ne constitue plus un U valide.

## T
- extérieur 5000 × 4000.
- barre 1200.
- pied 1800, décalage 1600.
- surface attendue : 11,04 m².

## Forme libre orthogonale
- minimum 4 points.
- contour fermé automatiquement.
- tous les segments horizontaux ou verticaux.
- aucun auto-croisement.
- surface calculée par polygone exact.
- diagonale => `CALPI-009 BLOQUANT`.
- auto-croisement => `CALPI-008 BLOQUANT`.

## Calepinage des formes complexes
- la zone est découpée selon les vrais décrochements du polygone.
- aucune approximation par rectangle englobant.
- `CALPI-036` signale lorsque l'optimisation 2D des chutes d'encoche reste à développer.
