# Portabilidad futura al VPS (COP $0 adicional)

Esta arquitectura está diseñada sin lock-in propietario para migrar en cualquier momento desde Cloudflare Pages + Supabase Free hacia el VPS de RDV:

1. **Frontend estático (`dist/`)**
   - Compilar con `npm run build` y servir `dist/` desde Nginx o Caddy con fallback SPA (`try_files $uri /index.html;`) y TLS Let's Encrypt apuntando `memorial.dueloanimal.co`.
2. **Base de datos PostgreSQL**
   - Ejecutar las migraciones SQL versionadas de `supabase/migrations/` en PostgreSQL estándar (o Supabase self-hosted con Docker Compose).
   - Restaurar datos mediante `pg_dump` / `pg_restore` o `node scripts/restore-supabase.mjs`.
3. **Almacenamiento de fotografías (`memorial-photos`)**
   - Las imágenes ya están optimizadas en WebP y desacopladas del JSONB.
   - Se pueden copiar desde `backups/*/storage/memorial-photos/` a un bucket MinIO S3-compatible o a `/var/www/memorial-photos` servido por Nginx.
4. **Turnstile**
   - Cloudflare Turnstile Free sigue funcionando sin cambios frente a cualquier origen (Cloudflare Pages o VPS).
