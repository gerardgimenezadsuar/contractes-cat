# Facturas Médicas

Aplicación de facturación muy sencilla para médicos con consulta privada en España.

- **Login por correo electrónico** (código de un solo uso, sin contraseña) — Supabase Auth.
- **Perfil del emisor con DNI/NIF obligatorio** (validación con letra de control).
- **Clientes con NIF/CIF obligatorio** (DNI, NIE y CIF validados).
- **Plantillas de factura** (1ª visita, 2ª visita, visita clínica…) para emitir en un clic.
- **Exportación a PDF** de cada factura (generado en el navegador con @react-pdf/renderer).
- Numeración secuencial por usuario, exención de IVA sanitaria (art. 20.Uno.3º Ley 37/1992) y retención de IRPF opcional.

## Stack

Next.js (App Router) + Tailwind CSS + Supabase (Auth + Postgres con RLS). Desplegada en Vercel.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Variables opcionales (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`); por defecto usa el proyecto de Supabase `facturas-medicas` con su clave publicable.
