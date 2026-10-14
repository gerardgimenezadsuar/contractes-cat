# contractes.cat

Anàlisi independent de la contractació pública a Catalunya.

**Aquesta no és una web oficial del govern.** Les dades provenen de la [Plataforma de Transparència de Catalunya](https://analisi.transparenciacatalunya.cat) i es mostren amb finalitat informativa.

## Funcionalitats

- **Dashboard** amb indicadors clau: total de contractes, import total adjudicat, nombre d'empreses
- **Rànquing d'empreses** per import total de contractes adjudicats, amb cerca i paginació
- **Detall d'empresa** amb evolució anual i llistat de contractes
- **Explorador de contractes** amb filtres per data, any, tipus, procediment, import i òrgan de contractació, ordenació i exportació CSV
- **Anàlisi** del llindar de contractes menors (15.000 EUR), distribucions per tipus i procediment

## Stack tecnològic

- [Next.js](https://nextjs.org) 16 (App Router, Server Components)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Recharts](https://recharts.org) per a gràfiques
- TypeScript
- Dades: [Socrata Open Data API (SODA)](https://dev.socrata.com/)

## Desenvolupament

```bash
pnpm install
pnpm dev
```

Obre [http://localhost:3000](http://localhost:3000) al navegador.

### Variables d'entorn (BORME/Turso)

Per mostrar l'històric d'administradors des de Turso (sense fitxers JSON estàtics), configura:

```bash
TURSO_URL=libsql://<db-name>-<org>.turso.io
TURSO_TOKEN=<db-token>
```

També es suporta `TURSO_AUTH_TOKEN` com a alternativa a `TURSO_TOKEN`.

### Índex de cerca (Supabase)

La cerca d'empreses i organismes per nom llegeix un índex propi a Supabase (Postgres amb
`pg_trgm`), que es reconstrueix cada nit des de Socrata amb l'Edge Function
`supabase/functions/sync-search-index` disparada per `pg_cron`. L'esquema i les funcions SQL
són a `supabase/migrations/`. Si l'índex no està configurat, té més de 72 h o falla, l'app
torna a consultar Socrata directament; la cerca de contractes sempre va a Socrata.

```bash
SUPABASE_URL=https://<project>.supabase.co   # opcional, hi ha un valor per defecte
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...  # clau pública (només lectura via RLS)
SEARCH_INDEX_DISABLED=1                      # força el camí Socrata (tests, CI)
```

### Indicadors i context municipal (Idescat)

Les pàgines d'organisme i d'empresa mostren indicadors de competència (ofertes per licitació,
licitacions amb una sola oferta, rebaixa sobre el pressupost), el pes dels contractes menors, la
concentració de proveïdors i, per als ajuntaments, la despesa per habitant. La definició de cadascun
és a `/metodologia` i el càlcul a `src/lib/indicators.ts` (amb tests a `tests/unit`).

El context municipal (població, renda, PIB, IST, atur) ve d'Idescat i es distribueix com a fitxer
estàtic (`src/data/municipis.json`). Per regenerar-lo, un cop l'any:

```bash
node scripts/fetch-idescat.mjs
```

### Tests i CI

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript
pnpm test:unit   # Node test runner: lògica pura (p. ex. anàlisi de cerques)
pnpm test:e2e    # Playwright: smoke tests (mòbil i escriptori) contra un mock de Socrata
```

Els tests end-to-end no toquen l'API pública: `tests/mock-socrata/server.mjs` respon amb
dades sintètiques i l'app s'hi connecta amb `SOCRATA_ORIGIN_OVERRIDE=http://127.0.0.1:4545`.
El workflow `.github/workflows/ci.yml` executa lint, typecheck, build i els tests a cada PR.

Per comprovar un desplegament real (només el subconjunt de tests que no depèn del mock):

```bash
E2E_BASE_URL=https://www.contractes.cat pnpm test:e2e
```

## Font de dades

Totes les dades provenen del conjunt de dades [Contractació pública a Catalunya](https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6) publicat pel Departament d'Economia i Hisenda de la Generalitat de Catalunya.

## Desplegament

Desplegat a [Vercel](https://vercel.com). Per desplegar la teva pròpia instància:

```bash
pnpm run build
```

## CLI (`@gerardgimenezadsuar/contractes-cli`)

El repositori inclou una CLI perquè persones i agents puguin consultar dades sense UI:

```bash
npx @gerardgimenezadsuar/contractes-cli help
npx @gerardgimenezadsuar/contractes-cli search-contracts --search "neteja" --year 2025
npx @gerardgimenezadsuar/contractes-cli search-companies --search "ferrovial"
```

Documentació de la CLI:

- [`packages/contractes-cli/README.md`](packages/contractes-cli/README.md)

## Descobribilitat per agents (ChatGPT/Claude)

- `llms.txt` al root del repo (lectura a GitHub)
- `public/llms.txt` publicat a `https://www.contractes.cat/llms.txt`
- README de la CLI amb exemples copy-paste
- Metadata NPM (`keywords`, `description`) per millorar la cerca

## Llicència

AGPL-3.0. Consulta el fitxer [LICENSE](LICENSE) per a més detalls.
