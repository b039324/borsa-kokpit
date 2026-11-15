# borsa-kokpit

Modüler BIST hisse terminali. Ön yüz: React + Vite (GitHub Pages). Arka yüz: Cloudflare Worker.

## Durum
- Aşama 1 (Worker iskeleti): hazır. `/api/health`, `/api/login`, `/api/me`.
- Sonraki: ön yüz iskeleti, modül sistemi, veri hattı.

## Worker (`worker/`)
```
cd worker
npm install
npm test          # testler
npm run typecheck # tip kontrolü
```

### Yayına alma
1. `npx wrangler kv namespace create KOKPIT` çıktısındaki id'yi `wrangler.toml` içindeki `BURAYA_KV_ID` yerine yaz.
2. `wrangler.toml` içindeki `ALLOWED_ORIGIN` değerine GitHub Pages adresini ekle (virgülle ayır).
3. Gizli değerler:
   - `npx wrangler secret put APP_PASSWORD`
   - `npx wrangler secret put TOKEN_SECRET` (uzun, rastgele bir metin)
4. `npm run deploy`

### Giriş yöntemi
`POST /api/login` gövdesi `{"password": "..."}`. Doğruysa 30 gün geçerli imzalı token döner. Korumalı uçlara `Authorization: Bearer <token>` başlığıyla gidilir. Aynı IP'den 5 hatalı denemede 15 dakika kilitlenir.

Yerel geliştirme için `worker/.dev.vars` dosyası (git'e girmez):
```
APP_PASSWORD=bir-sifre
TOKEN_SECRET=uzun-rastgele-bir-metin
```
