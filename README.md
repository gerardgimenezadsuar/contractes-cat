# contractes.cat

Anàlisi independent de la contractació pública a Catalunya.

**Aquesta no és una web oficial del govern.** Les dades provenen de la [Plataforma de Transparència de Catalunya](https://analisi.transparenciacatalunya.cat) i es mostren amb finalitat informativa.

## Funcionalitats

- **Dashboard** amb indicadors clau: total de contractes, import total adjudicat, nombre d'empreses
- **Rànquing d'empreses** per import total de contractes adjudicats, amb cerca i paginació
- **Detall d'empresa** amb evolució anual i llistat de contractes
- **Explorador de contractes** amb filtres per any, tipus, procediment, import i òrgan de contractació
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

## Font de dades

Totes les dades provenen del conjunt de dades [Contractació pública a Catalunya](https://analisi.transparenciacatalunya.cat/Sector-P-blic/Contractaci-del-sector-p-blic-de-la-Generalitat-d/ybgg-dgi6) publicat pel Departament d'Economia i Hisenda de la Generalitat de Catalunya.

## Desplegament

Desplegat a [Vercel](https://vercel.com). Per desplegar la teva pròpia instància:

```bash
pnpm run build
```

## Llicència

AGPL-3.0. Consulta el fitxer [LICENSE](LICENSE) per a més detalls.
