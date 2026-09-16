# CALPI — Plan de tests métier V0.3.0

## Régression V0.1 / V0.2
- formats rapides toujours disponibles ;
- rectangle, L, U, T et forme libre toujours calculés exactement ;
- rotation de la pièce conservée ;
- forme libre diagonale bloquée ;
- forme libre auto-croisée bloquée ;
- pose 1/2 verrouillée sur 2 positions ;
- pose 1/3 verrouillée sur 3 positions ;
- anti-double-usage toujours actif.

## Optimisation 2D V0.3

### Test A — création d'une chute en L
Source : 1000 × 600 mm.
Découpe : rectangle 700 × 400 mm dans un angle.

Attendu :
- aire restante exacte = 320 000 mm² ;
- un seul reliquat physique ;
- contour en L ;
- au moins 6 sommets de contour ;
- la chute n'est pas traitée comme un rectangle plein 1000 × 600.

### Test B — réemploi dans la branche d'un L
Une pièce 300 × 600 mm doit rentrer dans la branche verticale du reliquat du test A.

Attendu : placement accepté sans rotation.

### Test C — rotation 90°
Une pièce 600 × 300 mm doit pouvoir être placée dans cette même branche uniquement lorsque la rotation 90° est autorisée.

Attendu : `rotationDeg = 90`.

### Test D — scénario CALPI réel avec encoche
Pièce en L : 1800 × 900 mm avec décroché 600 × 300 mm.
Matériau : 1000 × 600 mm.

Attendu :
- surface couverte = surface de pièce ;
- au moins une pièce posée avec encoche ;
- au moins une chute 2D complexe créée ;
- au moins une chute 2D complexe réellement réutilisée ;
- `CALPI-036 = OK` ;
- `CALPI-037 = OK` ;
- aucune chute utilisée deux fois.

## Commande

`node tests.js`

Résultat :

`CALPI tests V0.3.0: OK`
