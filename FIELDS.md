# CALPI — Contrat des champs V0.3.0

Les champs V0.2 sont conservés. Aucun champ moteur existant n'est renommé.

## Entrées moteur

| Champ | Type | Unité | Obligatoire | Rôle |
|---|---|---:|---|---|
| `materialType` | string | — | oui | Famille matériau comprise par le moteur |
| `materialLengthMm` | number | mm | oui | Longueur exacte d'un élément neuf |
| `materialWidthMm` | number | mm | oui | Largeur exacte d'un élément neuf |
| `jointWidthMm` | number | mm | oui | Joint / espace entre éléments |
| `roomLengthMm` | number | mm | guidé | Axe X extérieur des formes guidées |
| `roomWidthMm` | number | mm | guidé | Axe Y extérieur des formes guidées |
| `roomShape` | string | — | oui | `rectangle`, `l_shape`, `u_shape`, `t_shape`, `free_orthogonal` |
| `shapeRotationDeg` | number | ° | oui | `0`, `90`, `180`, `270` |
| `shapeDimensions` | object | mm | selon forme | Dimensions L/U/T |
| `roomOutlinePoints` | array | mm | forme libre | Points `{xMm,yMm}` du contour |
| `orientation` | string | — | oui | `lengthwise` ou `widthwise` |
| `pattern` | string | — | oui | `straight`, `half`, `third` |
| `edgeMode` | string | — | oui | `as_is` ou `balanced` |
| `minimumEdgeWidthMm` | number | mm | oui | Largeur minimale de rive |
| `minimumReusableLengthMm` | number | mm | oui | Longueur minimale de matière réutilisable |
| `minimumReusableWidthMm` | number | mm | oui | Largeur minimale de matière réutilisable |
| `allowOffcutRotation` | boolean | — | oui | Autorise le moteur à tester une rotation 90° d'une chute |

## Sorties 2D ajoutées V0.3

### Sur chaque pièce posée

| Champ | Type | Rôle |
|---|---|---|
| `shapeType` | string | `rectangle` ou `orthogonal` |
| `shapeCells` | array | Décomposition 2D exacte de la pièce dans son repère local |
| `shapeContours` | array | Contour(s) orthogonal(aux) de la pièce |
| `layoutCells` | array | Cellules exactes dans le plan de pose |
| `roomCells` | array | Cellules exactes dans le repère de la pièce |
| `sourceRotationDeg` | number | Rotation 0° ou 90° utilisée lors d'un réemploi |
| `producedOffcutIds` | array | Liste de toutes les chutes produites par la découpe |

### Sur chaque chute

| Champ | Type | Rôle |
|---|---|---|
| `id` | string | Identifiant stable `C1`, `C2`, etc. |
| `shapeType` | string | `rectangle` ou `orthogonal` |
| `cells` | array | Région 2D exacte sous forme de rectangles non chevauchants |
| `contours` | array | Contour(s) exact(s) dérivés de `cells` |
| `contourPoints` | array | Premier contour pour compatibilité simple |
| `areaMm2` | number | Aire réelle de la chute |
| `lengthMm` | number | Largeur de la boîte englobante, conservée pour compatibilité |
| `widthMm` | number | Hauteur de la boîte englobante, conservée pour compatibilité |
| `parentOffcutId` | string/null | Chute parente si le reliquat vient d'un réemploi |
| `status` | string | `available`, `used`, `lost` |
| `usedAt` | object/null | Position de réemploi |

### Statistiques V0.3

| Champ | Type | Rôle |
|---|---|---|
| `complexInstalledPieceCount` | number | Nombre de pièces posées avec encoche / contour orthogonal complexe |
| `complexOffcutsCreated` | number | Nombre de chutes 2D complexes créées |
| `twoDReuseCount` | number | Nombre de réemplois impliquant une chute ou une pièce complexe |
| `rotatedOffcutReuseCount` | number | Nombre de réemplois avec rotation 90° |

## Règle de compatibilité

`lengthMm` et `widthMm` d'une chute complexe représentent uniquement sa boîte englobante. Ils ne suffisent jamais à décider qu'une future pièce rentre. Le moteur doit obligatoirement utiliser `cells` pour contrôler la couverture 2D réelle.

Tout renommage futur doit être annoncé explicitement avant intégration SpeedArti.
