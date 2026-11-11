# Documentation of a deployment

A starting point for the documentation of a deployment of the MarmotGraph Suite - its curation guidelines, conventions
or contacts. The Suite serves it at `/docs/custom/`, next to the documentation of the Suite.

```bash
pip install -r requirements.txt
zensical serve   # preview while writing
zensical build   # writes the site to site/
```

Provide the content of `site/` to the Suite in the directory configured by `DOCS_CUSTOM_DIR` (e.g. a read-only volume).
The link to the Suite (`../index.html`) as well as the stylesheet of the Suite only resolve once the site is served by
the Suite.

See "Operations → Deployment documentation" in the documentation of the Suite for details.
