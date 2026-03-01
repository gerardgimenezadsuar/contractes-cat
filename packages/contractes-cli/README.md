# @gerardgimenezadsuar/contractes-cli

CLI to query Catalonia public contract data from [contractes.cat](https://www.contractes.cat).

## Install

```bash
npm install -g @gerardgimenezadsuar/contractes-cli
```

Or run without installing:

```bash
npx @gerardgimenezadsuar/contractes-cli help
```

## Commands

```bash
contractes search-contracts --search "neteja" --year 2025 --page 1
contractes search-companies --search "ferrovial" --page 1
contractes search-organs --search "ajuntament" --limit 25
contractes organ-top-companies --organ "Ajuntament de Barcelona" --limit 10
contractes person-contracts --name "Nom Cognom" --date-from 2024-01-01 --date-to 2025-12-31
contractes attribution
```

## Configuration

- `CONTRACTES_API_BASE`: Override the API base URL.
  - Default: `https://www.contractes.cat`
  - Example for local development:

```bash
CONTRACTES_API_BASE=http://localhost:3000 contractes search-contracts --search salut
```

## Output

- JSON by default (pretty printed)
- Raw single-line JSON with `--raw`

## Data source and attribution

The CLI uses public data displayed by contractes.cat from the official Catalonia open-data dataset:

- Dataset: `ybgg-dgi6`
- Publisher: Departament d'Economia i Hisenda
- License/terms: <https://administraciodigital.gencat.cat/ca/dades/dades-obertes/informacio-practica/llicencies/>

## Publish and agent discoverability checklist

1. Publish package to npm (`npm publish --access public`).
2. Keep this README with copy-paste commands and flags.
3. Keep `https://www.contractes.cat/llms.txt` updated with install + usage.
4. Keep attribution command output stable (`contractes attribution`).
5. Tag releases in GitHub so agents can cite a concrete version.
