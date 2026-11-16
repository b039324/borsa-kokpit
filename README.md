# borsa-kokpit

Modüler BIST hisse terminali. Ön yüz: React + Vite (GitHub Pages). Arka yüz: Cloudflare Worker.

## Durum
- Aşama 1 (Worker iskeleti): hazır. `/api/health`, `/api/login`, `/api/me`.
- Aşama 2 (ön yüz iskeleti): hazır. Giriş, üst bar, sol panel, seçili hisse bağlamı.
- Aşama 3 (modül sistemi): hazır. Modül kaydı, "Modül ekle/çıkar" çekmecesi, sürükle ve kenardan boyutlandır (nokta ızgarasına oturur), düzenin Worker'da (KV) kalıcı kaydı. `/api/layout` eklendi.
- Sonraki: Aşama 4 (Yahoo veri hattı, hisse listeleri), Aşama 5 (fiyat özeti modülü).

## Klasörler
- `worker/` Cloudflare Worker (API)
- `web/` React ön yüz
- `.github/workflows/pages.yml` ön yüzü GitHub Pages'e yayınlar

## Yeni modül ekleme
`web/src/modules/` altına `<ad>.module.tsx` dosyası koy ve bir `ModuleDef`'i default export et. Başka yere dokunmak gerekmez; modül çekmecede ve ızgarada kendiliğinden görünür.

```tsx
import type { ModuleDef, ModuleProps } from "./types";

function Hacim({ symbol }: ModuleProps) {
  return <div>{symbol} hacmi</div>;
}

const def: ModuleDef = {
  id: "hacim",            // küçük harf/rakam/tire; kayıtlı düzenle eşleştiği için sonradan değiştirme
  title: "Hacim (TL)",
  scope: "stock",         // stock: seçili hisseye bağlı, global: bağımsız
  defaultSize: { w: 20, h: 12 },   // ızgara hücresi (1 hücre = 20px)
  minSize: { w: 10, h: 6 },
  order: 30,
  component: Hacim,
};
export default def;
```
- `stock` modül, hisse seçilmedikçe "Bir hisse seç." gösterir; bileşen hisse seçilince çizilir.
- Bir modül hata verirse yalnız o modül düşer, sayfa çalışmaya devam eder.
- `ornek-hisse` ve `ornek-saat` deneme amaçlıdır, gerçek modüller gelince silinebilir.

## Düzen nasıl saklanır
- Her modülün konumu/boyutu ızgara hücresi cinsinden Worker'da (KV, tek kayıt) tutulur; her cihazda aynı düzen açılır.
- Kayıt yalnız sürükleme/boyutlandırma bitince ve çekmeceden ekle/çıkar yapınca gider (kısa bir gecikmeyle birleştirilir).
- Düzen sunucudan alınamazsa hiçbir şey kaydedilmez; böylece mevcut düzen yanlışlıkla ezilmez.
- Kapatılan modülün yeri saklanır, tekrar açılınca aynı yere döner.
- Izgara en az 96 sütun (1920px) genişliğindedir; dar ekranda alan kaydırılır, konumlar değişmez.

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
`wrangler.toml` içindeki `ALLOWED_ORIGIN`, ön yüzün açıldığı adresleri içermelidir (virgülle ayrılır). Worker kodu değişince `npm run deploy` gerekir.

### Uçlar
| Uç | Yöntem | Giriş | Açıklama |
|---|---|---|---|
| `/api/health` | GET | hayır | Sağlık kontrolü |
| `/api/login` | POST | hayır | `{"password": "..."}` → 30 gün geçerli token. Aynı IP'den 5 hatalı denemede 15 dk kilit |
| `/api/me` | GET | evet | Token geçerli mi |
| `/api/chart`, `/api/search` | GET, giriş gerekli — Yahoo verisi |
| `/api/layout` | GET | evet | `{layout}` (kayıt yoksa `null`) |
| `/api/chart`, `/api/search` | GET, giriş gerekli — Yahoo verisi |
| `/api/layout` | PUT | evet | Düzeni doğrular ve kaydeder (en çok 50 KB, 100 modül) |

Korumalı uçlara `Authorization: Bearer <token>` başlığıyla gidilir.

Yerel geliştirme için `worker/.dev.vars` dosyası (git'e girmez):
```
APP_PASSWORD=bir-sifre
TOKEN_SECRET=uzun-rastgele-bir-metin
```


## Aşama 4–10 uçları (hepsi giriş ister)

| Uç | Ne yapar |
|---|---|
| `GET /api/chart?symbol=THYAO&period=1g` | Mum verisi (1g, 1h, 1a, 3a, 6a, 1y, 5y) |
| `GET /api/search?q=...` | İsimle hisse arama (BIST) |
| `GET /api/quotes?symbols=A,B` | Toplu güncel fiyat (en fazla 20) |
| `GET/PUT /api/favorites` | Favori listesi (en fazla 50) |
