# borsa-kokpit

Modüler BIST hisse terminali. Ön yüz: React + Vite (GitHub Pages). Arka yüz: Cloudflare Worker.

## Durum
- Aşama 1 (Worker iskeleti): hazır ve yayında. `/api/health`, `/api/login`, `/api/me`.
- Aşama 2 (ön yüz iskeleti): hazır. Giriş ekranı, üst bar, sol panel (arama, BIST 30/100 sekmeleri, favoriler alanı), noktalı modül alanı, seçili hisse bağlamı.
- Sonraki: Aşama 3 (modül sistemi, sürükle/boyutlandır, kalıcı düzen), Aşama 4 (Yahoo veri hattı), Aşama 5 (fiyat özeti modülü).

## Klasörler
- `worker/` Cloudflare Worker (API)
- `web/` React ön yüz
- `.github/workflows/pages.yml` ön yüzü GitHub Pages'e yayınlar

## Ön yüz (`web/`)
```
cd web
npm install
npm run dev       # http://localhost:5173
npm test          # testler
npm run build     # üretim derlemesi
```
API adresi varsayılan olarak yayındaki Worker'dır. Değiştirmek için `web/.env.local` dosyasına `VITE_API_URL=...` yaz.

### GitHub Pages
1. Repo → Settings → Pages → **Source: GitHub Actions** seç.
2. `main` dalına yükleme yapınca `pages.yml` testleri çalıştırır, derler ve yayınlar.
3. Adres: `https://<kullanıcı>.github.io/borsa-kokpit/`

## Worker (`worker/`)
```
cd worker
npm install
npm test
npm run typecheck
npm run deploy
```
Gizli değerler (`APP_PASSWORD`, `TOKEN_SECRET`) `npx wrangler secret put ...` ile eklenir, dosyaya yazılmaz.
`wrangler.toml` içindeki `ALLOWED_ORIGIN`, ön yüzün açıldığı adresleri içermelidir (virgülle ayrılır). Bu değeri değiştirince `npm run deploy` gerekir.

### Giriş yöntemi
`POST /api/login` gövdesi `{"password": "..."}`. Doğruysa 30 gün geçerli imzalı token döner. Korumalı uçlara `Authorization: Bearer <token>` başlığıyla gidilir. Aynı IP'den 5 hatalı denemede 15 dakika kilitlenir.
