# IGC Atlas mirror

Lossless mirror of the public Ville de Paris IGC/IGN `IGC_Atlas` ArcGIS
service at its highest published detail level.

- Source: <https://capgeo2.paris.fr/public/rest/services/IGC/IGC_Atlas/MapServer>
- Coordinate reference system: Lambert-93 (`EPSG:2154`)
- Level of detail: 12
- Source resolution: `0.07464551054102107 m/px`
- Source tile size: 256 × 256 pixels
- Coverage: the service's complete reported extent, including transparent and
  missing tile addresses recorded in `coverage.bin.zst`

## Layout

- `manifest.json` pins the source metadata, coverage digest, and every archive
  digest.
- `coverage.bin.zst` is the compressed row-major classification of every source
  address.
- `parts/*.tar.zst` are size-bounded Git LFS objects containing the exact
  non-transparent PNG bytes returned by the source service.

The archives are consolidation containers, not derived map products. Tar and
Zstandard are lossless; the PNGs are not resized, reprojected, decoded, or
re-encoded. PMTiles is intentionally not used for the mirror because it would
represent a derived Web-Mercator runtime tile set rather than the raw
Lambert-93 source atlas.

## Checkout and verify

```sh
git lfs pull
node verify.mjs
```

To materialize the original source tree:

```sh
mkdir -p extracted
for part in parts/*.tar.zst; do
  tar -xf "$part" -C extracted
done
```

The extracted files retain their source addresses as
`tiles/<row>/<column>.png`.

## Provenance

Source attribution: Ville de Paris / IGC - IGN. This repository preserves the
upstream bytes and provenance; it does not assert additional rights over the
source material.
