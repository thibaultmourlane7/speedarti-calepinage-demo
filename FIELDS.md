# CALPI — Contrat des champs V0.2.0

Les noms de champs moteur existants sont conservés. Les nouvelles données de forme sont ajoutées sans renommer les champs V0.1.2.

## Champs moteur stables

| Champ | Type | Unité | Obligatoire | Rôle |
|---|---|---:|---|---|
| `materialType` | string | — | oui | Famille comprise par le moteur |
| `materialLengthMm` | number | mm | oui | Longueur exacte d'un élément neuf |
| `materialWidthMm` | number | mm | oui | Largeur exacte d'un élément neuf |
| `jointWidthMm` | number | mm | oui | Joint / espace entre éléments |
| `roomLengthMm` | number | mm | guidé | Largeur extérieure X des formes guidées |
| `roomWidthMm` | number | mm | guidé | Hauteur extérieure Y des formes guidées |
| `roomShape` | string | — | oui | `rectangle`, `l_shape`, `u_shape`, `t_shape`, `free_orthogonal` |
| `shapeRotationDeg` | number | ° | oui | `0`, `90`, `180`, `270` |
| `shapeDimensions` | object | mm | selon forme | Dimensions spécifiques L/U/T |
| `roomOutlinePoints` | array | mm | forme libre | Points ordonnés `{xMm,yMm}` du contour |
| `orientation` | string | — | oui | `lengthwise` ou `widthwise` |
| `pattern` | string | — | oui | `straight`, `half`, `third` |
| `edgeMode` | string | — | oui | `as_is` ou `balanced` |
| `minimumEdgeWidthMm` | number | mm | oui | Largeur mini de rive |
| `minimumReusableLengthMm` | number | mm | oui | Longueur mini d'une chute réutilisable |
| `minimumReusableWidthMm` | number | mm | oui | Largeur mini d'une chute réutilisable |

## `shapeDimensions`

### Forme L
- `cutoutWidthMm`
- `cutoutHeightMm`

Le décroché de référence est construit en haut à droite, puis `shapeRotationDeg` permet les 4 orientations.

### Forme U
- `openingWidthMm`
- `openingDepthMm`
- `openingOffsetMm`

L'ouverture de référence est en haut. `openingOffsetMm` est mesuré depuis la gauche. La rotation permet les 4 orientations.

### Forme T
- `barThicknessMm`
- `stemWidthMm`
- `stemOffsetMm`

La barre de référence est en haut. `stemOffsetMm` positionne le pied depuis la gauche. La rotation permet les 4 orientations.

### Forme libre
`roomOutlinePoints` contient le contour dans l'ordre. Le moteur ferme automatiquement le dernier point vers le premier. Chaque segment doit être horizontal ou vertical.

## Sorties ajoutées V0.2

| Champ | Type | Rôle |
|---|---|---|
| `roomPolygon` | array | Polygone exact normalisé de la pièce |
| `roomBounds` | object | Boîte englobante exacte |
| `roomAreaMm2` | number | Surface exacte de la pièce |
| `materialCoveredAreaMm2` | number | Surface couverte par les fragments de matériau hors joints |
| `geometrySplitBandCount` | number | Nombre de bandes créées par les décrochements |

Tout renommage futur doit être annoncé explicitement avant intégration SpeedArti.
