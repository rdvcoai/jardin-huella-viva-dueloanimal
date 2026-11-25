# JHV-PUBLIC-UX-HOTFIX-004 — INFORME FINAL DE CIERRE

**Dictamen final:** **`BETA_PUBLIC_LIVE_VERIFIED`**  
**Fecha:** 2026-11-25  
**URL pública:** https://memorial.dueloanimal.co  
**Presupuesto incremental ejecutado:** **COP $0**

---

## 1. Cambios Implementados

1. **Acceso simple y humano (sin fricción ni campos técnicos)**
   - [EmailAccessModal.tsx](file:///c:/Users/Io/Desktop/repo%20nata/src/components/EmailAccessModal.tsx) y [HUD.tsx](file:///c:/Users/Io/Desktop/repo%20nata/src/components/HUD.tsx): acceso únicamente mediante **Nombre, País y Correo**.
   - Eliminados de la UI: OTP, contraseñas, claves de recuperación visibles (`JHV-...`), campos técnicos y métricas de infraestructura/cuotas.
   - Exportación e importación JSON conservadas únicamente como herramienta opcional dentro de `<details>` (`Respaldo opcional (.json)`).

2. **Anonymous Auth transparente + Referencia a homenajes públicos por correo**
   - Migración [20261125000004_email_hash_public_lookup.sql](file:///c:/Users/Io/Desktop/repo%20nata/supabase/migrations/20261125000004_email_hash_public_lookup.sql) aplicada en `pgaaqnczxaylqznliecl`.
   - `public.memorials.email_hash` almacena únicamente el hash SHA-256 del correo normalizado (nunca el correo en texto plano).
   - RPC `find_public_memorials_by_email(p_email)` devuelve exclusivamente memoriales con `privacy = 'publico'` y `deleted_at is null`, sin exponer correos, sin exponer cartas/fotos privadas y sin conceder propiedad (`owner_uuid`) ni permisos de edición/eliminación.
   - `redeem_memorial_invite` actualizado para no hacer fallback al código legado si existe una invitación explícita revocada o agotada.

3. **Corrección de vista de lista móvil y Turnstile discreto**
   - [DirectoryListView.tsx](file:///c:/Users/Io/Desktop/repo%20nata/src/components/DirectoryListView.tsx) y [index.css](file:///c:/Users/Io/Desktop/repo%20nata/src/index.css): `.directory-list-main` con `padding-top: calc(7.5rem + env(safe-area-inset-top))` en móvil (`<= 900px`) para despejar por completo la cabecera fija.
   - Cloudflare Turnstile se mantiene activo y discreto en envíos públicos (`QuickGuideModal` / `submit-public-action`).

---

## 2. Evidencia de Pruebas y Certificación en Vivo

- **TypeScript & Build:** `npx tsc --noEmit` y `npm run build` → código `0`.
- **Suite versionada [certify-launch-003.mjs](file:///c:/Users/Io/Desktop/repo%20nata/tests/certify-launch-003.mjs): `19/19 passed`**:
  - Incluye verificación de `find_public_memorials_by_email` (retorna solo `publico`, nunca `privado`, y no concede propiedad a User B), rechazo de token dummy por Turnstile real en producción, respaldo cifrado `AES-256-GCM`, restauración comprobada, 1.000 memoriales paginados y 50 lecturas concurrentes (`961 ms` total, `p95 = 887 ms`).
- **Verificación en vivo (`https://memorial.dueloanimal.co/` a `360×740`):**
  - **HTTP 200**, **0 errores de consola**.
  - Modal `Tus datos de acceso`: únicamente Nombre, Correo, País y sección colapsada `Respaldo opcional (.json)` (`step_12_shot_1.png`).
  - `Vista en lista`: título `Rincones del jardín (vista en lista)` completamente legible debajo de la cabecera fija (`step_14_shot_1.png`), ajustado finalmente a `7.5rem` para margen positivo total.
