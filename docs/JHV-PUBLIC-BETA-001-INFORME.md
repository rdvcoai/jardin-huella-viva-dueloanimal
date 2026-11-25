# JHV-PUBLIC-BETA-001 — Informe de Certificación Beta Pública

**Repositorio:** `rdvcoai/jardin-huella-viva-dueloanimal`  
**Rama de trabajo:** `deploy` (rama `main` intacta, sin merge ni deploy productivo hasta aprobación)  
**Presupuesto incremental:** COP $0  
**Dictamen final:** **`BETA_PUBLIC_READY`** *(sujeto únicamente a la creación/configuración del Site Key + Secret Key real de Cloudflare Turnstile en producción y secrets de GitHub Actions para respaldo diario)*

---

## 1. Identificación del Proyecto Supabase y Entorno

- **Proyecto Supabase:** `jardin-huella-viva`
- **Project ID / Ref:** `pgaaqnczxaylqznliecl`
- **Organización:** `kimhxdzpodruaacopjjy` (`io`, cuenta `dh@rdv.com.co`)
- **Región:** `us-east-1` *(seleccionada por menor latencia desde Colombia `dueloanimal.co` y norte de Latinoamérica, ~65 ms vs ~115 ms a `sa-east-1`)*
- **Hosting estático:** Cloudflare Pages Free (`dueloanimal-memorial`, `memorial.dueloanimal.co`)
- **Protección anti-bot:** Cloudflare Turnstile Free + Edge Function `submit-public-action`

---

## 2. Arquitectura Implementada

1. **Seguridad P0 (F1)**
   - Eliminación de políticas RLS permisivas (`using (true)`).
   - Propiedad estricta mediante `auth.uid()` (`owner_uuid`) y autenticación real con Supabase Auth Email OTP en [EmailAccessModal.tsx](file:///c:/Users/Io/Desktop/repo%20nata/src/components/EmailAccessModal.tsx).
   - Separación física de contenido público vs privado:
     - `public.memorials`: datos públicos/compartidos sanitizados (sin `privateLetters`, `inviteCode` ni `invitedEmails`).
     - `public.memorial_private_data`: cartas privadas y códigos de invitación, estrictamente solo propietario (`auth.uid() = owner_uuid`).
     - `public.memory_books` (borradores solo propietario) vs `public.published_memory_books` (solo snapshots publicados).
   - Invitaciones seguras mediante hash SHA-256 (`invite_code_hash`) y función `SECURITY DEFINER` `redeem_memorial_invite(p_code)`.
   - Validación server-side de Cloudflare Turnstile y filtro antispam/moderación en Edge Function [index.ts](file:///c:/Users/Io/Desktop/repo%20nata/supabase/functions/submit-public-action/index.ts).

2. **Persistencia, Storage y WebP (F2)**
   - Bucket `memorial-photos` en Supabase Storage (límite 2 MB por imagen, carpeta por `auth.uid()`).
   - Conversión a WebP y eliminación de metadatos EXIF/GPS en [imageUtils.ts](file:///c:/Users/Io/Desktop/repo%20nata/src/utils/imageUtils.ts).
   - Confirmación efectiva de escrituras (`Guardando...` / `Guardado` / `No se pudo guardar`), tumbas locales (`dueloanimal_deleted_ids_v1`) para evitar resurrección de registros eliminados y exclusión de `demo-owner` (`is_demo`) de la persistencia productiva.

3. **Optimización (F3)**
   - Paginación de 30 memoriales (`fetchCloudMemorialsPage`, `ALTARS_PER_SANCTUARY = 30`).
   - Carga diferida de imágenes (`loading="lazy"`, `decoding="async"`).
   - Eliminación de suscripción Realtime global innecesaria.
   - Generación de PDF 100% en cliente (`jspdf` + `html2canvas`).
   - Indicadores de consumo y alertas operativas al 70% y 85% (`get_sanctuary_usage_stats` + UI en `EmailAccessModal`).

4. **Continuidad y Portabilidad (F4)**
   - Respaldo diario independiente de PostgreSQL y Storage mediante [backup-supabase.mjs](file:///c:/Users/Io/Desktop/repo%20nata/scripts/backup-supabase.mjs), restauración comprobada en [restore-supabase.mjs](file:///c:/Users/Io/Desktop/repo%20nata/scripts/restore-supabase.mjs) y workflow [daily-backup.yml](file:///c:/Users/Io/Desktop/repo%20nata/.github/workflows/daily-backup.yml) ($0 en GitHub Actions).
   - Guía de portabilidad sin lock-in hacia VPS en [PORTABILIDAD_VPS.md](file:///c:/Users/Io/Desktop/repo%20nata/docs/PORTABILIDAD_VPS.md).

---

## 3. Migraciones SQL Versionadas

- [20261125000001_initial_secure_schema.sql](file:///c:/Users/Io/Desktop/repo%20nata/supabase/migrations/20261125000001_initial_secure_schema.sql) — aplicada en `pgaaqnczxaylqznliecl` vía `supabase db push --remote`.

---

## 4. Evidencias de Pruebas (F5)

- **TypeScript & Build:** `npx tsc --noEmit` y `npm run build` exit code `0`.
- **Batería de Certificación (`18/18 passed`):**
  - CRUD propietario (`publico`, `invitados`, `privado`) + `memorial_private_data`: **PASS**
  - Aislamiento `anon` (solo ve `publico`, bloqueado en `memorial_private_data` e inserciones): **PASS**
  - Aislamiento entre usuarios (Usuario B bloqueado en lectura/edición/eliminación de Usuario A): **PASS**
  - Canje seguro de invitación vía RPC `redeem_memorial_invite`: **PASS**
  - Subida WebP a Storage y aislamiento de carpeta por `auth.uid()`: **PASS**
  - Edge Function Turnstile: rechaza sin token (`400`), rechaza spam URL (`422`), acepta sugerencia válida (`200`): **PASS**
  - Respaldo y restauración completa tras eliminación de memorial: **PASS**
  - Prueba de carga controlada: **50 lecturas concurrentes paginadas (30/página) → 50/50 OK, total `12,231 ms`, p95 `1,529 ms`**.

---

## 5. Consumo y Cuotas Observadas (Supabase Free)

- **Base de datos:** `12,056,243` bytes (~11.5 MB de 500 MB = **2.3%**).
- **Storage:** `88` bytes (~0.00% de 1 GB).
- **Alertas configuradas:** Advertencia al **70%** y crítica al **85%** tanto en UI como en el workflow diario.

---

## 6. Riesgos Pendientes e Intervenciones Manuales Estrictamente Necesarias

1. **Cloudflare Turnstile (producción):** Crear el widget gratuito para `memorial.dueloanimal.co` en Cloudflare Turnstile, configurar `VITE_TURNSTILE_SITE_KEY` en Cloudflare Pages (`dueloanimal-memorial`) y actualizar `TURNSTILE_SECRET_KEY` en Supabase (`supabase secrets set TURNSTILE_SECRET_KEY=<real>`).
2. **Variables de entorno en Cloudflare Pages:** Agregar `VITE_SUPABASE_URL` (`https://pgaaqnczxaylqznliecl.supabase.co`) y `VITE_SUPABASE_ANON_KEY` en Cloudflare Pages cuando Dirección autorice el deploy de `deploy`.
3. **Secrets de respaldo diario en GitHub Actions:** Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en GitHub → Settings → Secrets and variables → Actions para habilitar el cron diario automático de `daily-backup.yml`.
