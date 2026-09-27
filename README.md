# Atlas de la Desconexión Digital de Chile 2026 — Visualizador público

[![Visualizer QA](https://github.com/selguetagodoy/atlas-visualizador-cotel/actions/workflows/site-qa.yml/badge.svg)](https://github.com/selguetagodoy/atlas-visualizador-cotel/actions/workflows/site-qa.yml)

Visualizador comunal asociado al **Atlas de la Desconexión Digital de Chile 2026**, investigación desarrollada por **Sebastián Elgueta Godoy** y difundida públicamente por COTEL.

**Proyecto canónico:** https://selguetagodoy.github.io/atlas-desconexion-digital-chile.html  
**Visualizador:** https://atlas-visualizador-cotel.vercel.app/  
**Repositorio de investigación:** https://github.com/selguetagodoy/atlas-desconexion-digital-chile.  
**Version DOI:** https://doi.org/10.5281/zenodo.22921209  
**Concept DOI:** https://doi.org/10.5281/zenodo.22921208

> COTEL participa como espacio de presentación y difusión sectorial. La autoría de la investigación, del Atlas y de la base asociada corresponde a Sebastián Elgueta Godoy.

## Qué incluye

- mapa comunal de Chile con indicadores seleccionables;
- buscador por comuna;
- ranking por indicador y región;
- ficha comunal con hogares sin Internet, dependencia móvil, Internet fijo, computador e IVD;
- dispersión entre hogares sin Internet y vulnerabilidad digital;
- síntesis metodológica para consulta pública;
- acceso al documento del Atlas disponible en el visualizador.

## Datos y generación

El script `scripts/build-data.ps1` genera los artefactos públicos utilizados por la aplicación:

- `public/data/atlas.json`
- `public/data/comunas.geojson`

Los insumos analíticos originales y las capas fuente se gestionan fuera de este repositorio de interfaz. Este repositorio **no reemplaza** el repositorio canónico de investigación ni constituye una publicación independiente de la base completa.

## Trazabilidad

Para metodología, fuentes, citación y límites de publicación, consultar:

- [Atlas — ficha canónica](https://selguetagodoy.github.io/atlas-desconexion-digital-chile.html)
- [Repositorio de investigación](https://github.com/selguetagodoy/atlas-desconexion-digital-chile.)
- [Source of Truth](https://github.com/selguetagodoy/atlas-desconexion-digital-chile./blob/main/SOURCE_OF_TRUTH.md)
- [Version DOI](https://doi.org/10.5281/zenodo.22921209)
- [Índice de Vulnerabilidad Digital](https://selguetagodoy.github.io/indice-vulnerabilidad-digital-chile.html)

## Desarrollo local

Es una aplicación estática. No requiere npm ni un build step para servir la interfaz.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-data.ps1
```

## Despliegue

El proyecto está preparado para despliegue estático en Vercel. `robots.txt` y `sitemap.xml` apuntan a la URL pública del visualizador.
