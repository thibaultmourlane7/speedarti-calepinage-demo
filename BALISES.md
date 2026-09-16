# CALPI — Registre des balises V0.3.0

Les balises existantes conservent leur signification.

## Géométrie
- `CALPI-001` — géométrie de pièce exploitable.
- `CALPI-002` — dimensions matériau valides.
- `CALPI-003` — largeur de joint valide.
- `CALPI-004` — forme reconnue.
- `CALPI-005` — orientation valide.
- `CALPI-006` — dimensions spécifiques complètes.
- `CALPI-007` — contour fermé.
- `CALPI-008` — absence d'auto-croisement.
- `CALPI-009` — orthogonalité du contour.
- `CALPI-015` — polygone exact généré.
- `CALPI-016` — surface exacte calculée.
- `CALPI-017` — zone de pose transformée en cellules orthogonales exactes.
- `CALPI-018` — rotation de forme valide.
- `CALPI-019` — nombre minimal de points pour une forme libre.

## Rangées / pose
- `CALPI-010` — nombre de rangées calculé.
- `CALPI-011` — dernière rive valide.
- `CALPI-013` — équilibrage des rives.
- `CALPI-014` — largeur minimale de rive.
- `CALPI-020` — motif pris en charge.
- `CALPI-021` — décalages de départ générés.
- `CALPI-022` — ordre de pose généré.
- `CALPI-023` — chaque pièce géométrique rentre dans le format matériau sélectionné ; BLOQUANT sinon.

Règles verrouillées :
- pose 1/2 = exactement 2 positions de départ ;
- pose 1/3 = exactement 3 positions de départ.

## Chutes / optimisation 2D
- `CALPI-030` — seuils de réutilisation valides.
- `CALPI-031` — stock 2D consulté avant ouverture d'un élément neuf.
- `CALPI-032` — traçabilité origine → réemploi.
- `CALPI-033` — anti-double-usage.
- `CALPI-034` — reliquat recalculé et reclassé après réemploi.
- `CALPI-035` — matière perdue calculée par aire géométrique réelle.
- `CALPI-036` — optimisation 2D des chutes complexes active.
- `CALPI-037` — contour réel + aire exacte de chaque chute enregistrés.
- `CALPI-038` — règle de rotation 90° appliquée selon le choix utilisateur.
- `CALPI-039` — séparation automatique des reliquats physiquement distincts.

En V0.3, `CALPI-036` doit être `OK` lorsque le calcul aboutit : les chutes complexes ne sont plus assimilées à leur rectangle englobant.

## Sortie
- `CALPI-040` — résultat complet généré.
- `CALPI-041` — sortie interdite en présence d'un contrôle BLOQUANT.

## Statuts
- `OK`
- `AVERTISSEMENT`
- `A_VALIDER`
- `BLOQUANT`
