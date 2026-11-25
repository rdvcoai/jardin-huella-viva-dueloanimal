# JHV-PUBLIC-LAUNCH-003 — INFORME FINAL DE LANZAMIENTO

**Dictamen final:** **`BETA_PUBLIC_LIVE_VERIFIED`**  
**Fecha:** 2026-11-25  
**URL pública:** https://memorial.dueloanimal.co  
**PR de trabajo:** https://github.com/rdvcoai/jardin-huella-viva-dueloanimal/pull/1 (`MERGED`)  
**SHA de código fusionado:** `eb27783476de3b29711d699eb1e524cf6a7156cd`  
**Presupuesto incremental ejecutado:** **COP $0**

---

## 1. Evidencia de Merge y Despliegue

- **PR #1 (`deploy` → `main`):** marcado Ready for Review y fusionado en `eb27783476de3b29711d699eb1e524cf6a7156cd`.
- **Cloudflare Pages (`dueloanimal-memorial`):**
  - Variables de entorno configuradas en Producción: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` (`0x4AAAAAAGS51iRdtnR1pnzM`).
  - Despliegue automático desde `main` activo en `https://memorial.dueloanimal.co/` (**HTTP 200**, **0 errores de consola**).
- **Supabase (`jardin-huella-viva`, ref `pgaaqnczxaylqznliecl`, región `us-east-1`):**
  - Anonymous Sign-Ins habilitado.
  - Migraciones aplicadas vía Supabase CLI (`20261125000001`, `20261125000002`, `20261125000003`).
  - Edge Functions desplegadas: `submit-public-action` y `recovery-auth` con `TURNSTILE_SECRET_KEY` real configurado en secrets.

---

## 2. Capturas Móviles y Escritorio (Antes vs. Después)

### Antes (`https://memorial.dueloanimal.co` previo al lanzamiento)
- **320×667, 360×740, 390×844, 430×932:** Superposición severa en la barra inferior entre el widget de Spotify (`Juntos en el Adiós`) y el D-pad de navegación (`←`, `↓`, `→` ocultos/inaccesibles), además de apilamiento de 4–5 filas en cabecera (`212 px` de alto en `320px`).
- **768×1024:** El texto de ayuda inferior se solapaba con el D-pad y el widget de Spotify.
- Evidencia: `e21741f0-4555-44cd-99d8-99ba3efdcef1/browser_sandbox/screenshots/step_10_shot_{1..6}.png`.

### Después (desplegado y verificado en `320, 348, 360, 390, 430, 768, 1440 px`)
- **0 superposiciones**, **0 botones recortados**, objetivos táctiles **`>= 44×44 px`**, cabecera compacta (`Jardín Huella Viva` + `Crear homenaje` + `Menú`), menú inferior desplegable y separación limpia entre podcast y D-pad incluso en `320×667` (`5.22 px` de margen horizontal libre).
- Evidencia local (`http://localhost:4173`):
  - `320×667`: `82fdf94f-5f99-4b80-a0ac-3252ec8397c4/browser_sandbox/screenshots/step_6_shot_1_viewport_320x667.png`
  - `348×740`, `360×740`, `390×844`, `430×932`, `768×1024`, `1440×900`, menú móvil y modal: `a3a13875-7815-495e-86cb-5c0378d5d4ef/browser_sandbox/screenshots/step_8_shot_{1..5}.png`, `step_10_shot_{1,2}.png`, `step_12_shot_1.png`, `step_26_shot_{1,2}.png`, y `82fdf94f-5f99-4b80-a0ac-3252ec8397c4/browser_sandbox/screenshots/step_8_shot_1_viewport_430x932.png`.
- Evidencia en producción (`https://memorial.dueloanimal.co`):
  - `360×740` (0 superposiciones): `ba3f2671-a59b-408c-9c0b-1d95c40e4564/browser_sandbox/screenshots/step_18_shot_1.png`
  - `1440×900` (0 superposiciones): `ba3f2671-a59b-408c-9c0b-1d95c40e4564/browser_sandbox/screenshots/step_18_shot_2.png`

---

## 3. Resultados Reproducibles de Pruebas (`tests/certify-launch-003.mjs`)

- **Build & TypeScript:** `npx tsc --noEmit` y `npm run build` → código `0`.
- **Suite versionada [certify-launch-003.mjs](file:///c:/Users/Io/Desktop/repo%20nata/tests/certify-launch-003.mjs): `18/18 passed`**:
  1. Anonymous Auth crea sesiones aisladas (`uidA`, `uidB`, `uidC`).
  2. Generación y rotación de clave de recuperación criptográfica (`JHV-...`), almacenando únicamente verificador PBKDF2-SHA256 con salt (sin texto plano).
  3. Rechazo de `data:image/` Base64 en PostgreSQL JSONB (`chk_memorials_no_base64_images`).
  4. Subida WebP a bucket privado `memorial-photos` y aislamiento de lectura/escritura entre usuarios.
  5. RLS de `family_contributions` condicionado al memorial padre (`privado` oculto a otros usuarios).
  6. Invitaciones limitadas y revocables (`redeem_memorial_invite`, `revoke_memorial_invites`).
  7. Recuperación multidispositivo sin OTP hacia `uidC` (rechazo de clave rotada antigua, aceptación de clave vigente).
  8. Respaldo cifrado `AES-256-GCM` con manifiesto SHA-256 y restauración fail-closed comprobada tras borrado.
  9. **Paginación con dataset sintético de 1.000 memoriales** (`30/página`, `count >= 1000`, limpieza posterior).
  10. **50 lecturas concurrentes** sobre el dataset de 1.000 memoriales: **`50/50 OK`, total `903 ms`, `p95 = 902 ms`**.

---

## 4. Auditoría Independiente L5 READ_ONLY (A5)

- **Dictamen A5:** **`APPROVED`** (**0 P0**, **0 P1**).
- Sin secretos expuestos en archivos trackeados; RLS estricto por `auth.uid()` en las 10 tablas; Storage privado; Edge Functions fail-closed con Turnstile y rate-limit.
- Los hallazgos menores P2 detectados por A5 (política de lectura Storage tras recuperación de `auth.uid()`, tamaño de botón de cierre en tarjeta de podcast y fail-closed en restauración de archivos Storage) fueron corregidos en el commit `b7464d9` antes del merge.

---

## 5. Smoke Test Productivo en Vivo (`https://memorial.dueloanimal.co`)

- **HTTP 200** y **0 errores de consola** durante todo el flujo.
- Creación de memorial de prueba `SmokeTestMascota` (`mem-00c10485-433a-43d9-a0c3-cb07e2a56217`) bajo sesión anónima (`a768590e-e667-4ce1-919a-ec6c2b5d8d2c`), verificación de persistencia en Supabase tras recarga (`page.reload()`), apertura desde búsqueda, verificación del panel `Identidad y recuperación` (`Sesión anónima activa` + `Generar clave de recuperación`), y eliminación limpia (`DELETE HTTP 204`) dejando **0 datos de prueba** en producción.

---

## 6. Respaldo, Restauración y Consumo de Cuotas

- **Respaldo diario automatizado:** [daily-backup.yml](file:///c:/Users/Io/Desktop/repo%20nata/.github/workflows/daily-backup.yml) con secrets configurados (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_ENCRYPTION_KEY`), cifrado `AES-256-GCM`, retención de 30 días en GitHub Actions Artifacts (COP \$0) y alertas al **70%** y **85%**.
- **Consumo real observado en Supabase Free:**
  - Base de datos: `12,056,243` bytes (**2.3%** de 500 MB).
  - Storage: `88` bytes (**0.00%** de 1 GB).

---

## 7. Riesgos Residuales, Limitaciones y Rollback

- **Riesgos residuales aceptados por Dirección:** el correo en perfil no es verificado (no se usa para propiedad); si un usuario pierde su clave privada `JHV-...` y borra cookies del navegador, no podrá recuperar su sesión anónima sin asistencia administrativa.
- **Limitaciones conocidas:**
  - Las pruebas móviles se ejecutaron en emulación Chromium (`320–1440 px`); no se probó en hardware físico iOS Safari / Android Chrome dentro de este entorno Windows.
  - En `Vista en lista` a `360×740`, el botón superior fijo `Menú` queda sobre la zona superior izquierda del título `Rincones del jardín (vista en lista)` (cosmético P2, no bloquea navegación ni funcionalidad).
- **Procedimiento de rollback:**
  - **Frontend:** desde Cloudflare Pages → `dueloanimal-memorial` → Deployments → *Rollback* al despliegue previo, o `git revert -m 1 eb27783476de3b29711d699eb1e524cf6a7156cd` en `main`.
  - **Base de datos:** las migraciones `20261125000001`–`20261125000003` son aditivas y compatibles; en caso de restauración completa usar `node scripts/restore-supabase.mjs` con el último artefacto cifrado.
- **Intervenciones manuales pendientes:** **Ninguna.**
