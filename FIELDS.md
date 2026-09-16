# CALPI — Contrat des champs V0.1.2

Les champs moteur restent inchangés : `materialType`, `materialLengthMm`, `materialWidthMm`, `jointWidthMm`, `roomLengthMm`, `roomWidthMm`, `roomShape`, `orientation`, `pattern`, `edgeMode`, `minimumEdgeWidthMm`, `minimumReusableLengthMm`, `minimumReusableWidthMm`.

## Nouveaux champs d'interface — non transmis au moteur

| Champ | Type | Rôle |
|---|---|---|
| `materialFamilyId` | string | Distingue la famille visible, notamment massif / contrecollé |
| `formatMode` | string | `preset` ou `manual` |
| `selectedFormatId` | string/null | Identifiant du format rapide choisi |

`Parquet massif` et `Parquet contrecollé` transmettent tous deux `materialType = parquet` au moteur.

Chaque famille propose exactement 5 formats rapides + `Dimensions manuelles`.
Les formats rapides sont des formats de démonstration. Le mode manuel permet de saisir les dimensions exactes du produit.
