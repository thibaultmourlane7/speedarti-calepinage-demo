# CALPI — Registre des balises V0.1.2

## Entrées et géométrie
- `CALPI-001` — dimensions de pièce présentes et strictement positives.
- `CALPI-002` — dimensions matériau présentes et strictement positives.
- `CALPI-003` — largeur de joint valide et non négative.
- `CALPI-004` — forme de pièce prise en charge par la version du moteur.
- `CALPI-005` — orientation valide.

## Rangées / rives
- `CALPI-010` — nombre de rangées calculable.
- `CALPI-011` — dernière rive supérieure à zéro.
- `CALPI-012` — contrôle largeur minimale de dernière rive.
- `CALPI-013` — équilibrage première/dernière rive appliqué.
- `CALPI-014` — contrôle largeur minimale après équilibrage.

## Pose
- `CALPI-020` — motif de pose pris en charge.
- `CALPI-021` — décalage de départ compatible avec le format.
- `CALPI-022` — ordre de pose généré.

### Règles de cycle verrouillées par tests
- Pose `1/2` : exactement 2 positions de départ.
- Pose `1/3` : exactement 3 positions de départ.
- Ces règles sont vérifiées dans `tests.js` afin d'empêcher toute régression.

## Coupes et chutes
- `CALPI-030` — seuil de chute réutilisable valide.
- `CALPI-031` — recherche du stock de chutes avant élément neuf.
- `CALPI-032` — traçabilité origine → réemploi complète.
- `CALPI-033` — aucun double usage d'une même chute.
- `CALPI-034` — chute résiduelle reclassée après réemploi.
- `CALPI-035` — matière perdue identifiée.

## Sortie
- `CALPI-040` — résultat complet généré.
- `CALPI-041` — aucune sortie finale en présence d'un contrôle BLOQUANT.

## Statuts
- `OK` : contrôle validé.
- `AVERTISSEMENT` : calcul possible, point technique à vérifier.
- `A_VALIDER` : décision utilisateur requise.
- `BLOQUANT` : calcul ou sortie impossible tant que l'entrée n'est pas corrigée.
