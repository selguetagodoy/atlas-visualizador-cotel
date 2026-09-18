# Atlas de la Desconexion Digital 2026 - Visualizador COTEL

Visualizador editorial estatico para explorar el Atlas a escala comunal.

## Que incluye

- Mapa comunal de Chile con indicadores seleccionables.
- Buscador de comuna.
- Ranking por indicador y region.
- Ficha comunal con sin internet, solo movil, internet fijo, computador e IVD.
- Scatter IVD: hogares sin internet vs vulnerabilidad digital.
- Nota metodologica simple para prensa.

## Datos

El archivo `scripts/build-data.ps1` genera:

- `public/data/atlas.json`
- `public/data/comunas.geojson`

Fuentes locales usadas:

- `C:\Users\sebas\Desktop\abril 2026\master_atlas_epf_desconexion_comunal.csv`
- `C:\Users\sebas\Desktop\atlas_cotel_codex_work\shapes\Comunas\comunas.shp`
- `C:\Users\sebas\Desktop\atlas_cotel_codex_work\shapes\Comunas\comunas.dbf`

## Desarrollo local

Este prototipo no requiere npm ni build step. Puede abrirse con cualquier servidor estatico.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-data.ps1
```

## Vercel

Es un sitio estatico listo para publicar en Vercel desde esta carpeta.
