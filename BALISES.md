# CALPI — Registre des balises V0.2.0

Les balises existantes V0.1.x gardent leur signification. Les nouvelles balises géométriques utilisent les numéros libres afin d'éviter toute rupture de traçabilité.

## Entrées / géométrie
- `CALPI-001` — géométrie de pièce exploitable.
- `CALPI-002` — dimensions matériau valides.
- `CALPI-003` — largeur de joint valide.
- `CALPI-004` — forme reconnue et prise en charge.
- `CALPI-005` — orientation de pose valide.
- `CALPI-006` — dimensions spécifiques de forme complètes et cohérentes.
- `CALPI-007` — contour fermé.
- `CALPI-008` — absence d'auto-croisement.
- `CALPI-009` — orthogonalité du contour.
- `CALPI-015` — polygone exact généré.
- `CALPI-016` — surface exacte calculée.
- `CALPI-017` — zone de pose découpée en bandes géométriques exactes.
- `CALPI-018` — rotation de forme valide.
- `CALPI-019` — nombre minimal de points en forme libre.

## Rangées / rives — inchangé
- `CALPI-010` — nombre de rangées calculé.
- `CALPI-011` — dernière rive géométriquement valide.
- `CALPI-013` — équilibrage des rives.
- `CALPI-014` — contrôle de largeur minimale de rive.

## Pose
- `CALPI-020` — motif pris en charge.
- `CALPI-021` — décalages de départ générés.
- `CALPI-022` — ordre de pose généré.

Règles verrouillées :
- 1/2 = exactement 2 positions de départ.
- 1/3 = exactement 3 positions de départ.

## Coupes / chutes
- `CALPI-030` — seuils de réutilisation valides.
- `CALPI-031` — stock de chutes consulté avant élément neuf.
- `CALPI-032` — traçabilité origine → réemploi.
- `CALPI-033` — anti-double-usage.
- `CALPI-034` — reliquats reclassés.
- `CALPI-035` — matière perdue identifiée.
- `CALPI-036` — contrôle d'optimisation des découpes complexes aux décrochements.

`CALPI-036 = AVERTISSEMENT` lorsque la géométrie est exacte mais que les chutes issues d'encoches sont encore traitées comme fragments rectangulaires et ne bénéficient pas encore d'une optimisation 2D complète.

## Sortie
- `CALPI-040` — résultat complet généré.
- `CALPI-041` — sortie interdite lorsqu'un contrôle BLOQUANT subsiste.

## Statuts
- `OK`
- `AVERTISSEMENT`
- `A_VALIDER`
- `BLOQUANT`
