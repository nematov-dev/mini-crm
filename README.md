# Mini CRM

Kichik kompaniya uchun lead management system: leadlarni yaratish, ko'rish, qidirish, filtrlash, tahrirlash, statusini boshqarish, o'zgarishlar tarixi va dashboard statistikasi.

**Stack:** Django 5.1 + Django REST Framework · PostgreSQL · JWT (simplejwt) · React 19 + TypeScript + Vite · Ant Design · TanStack Query · Docker

| | |
|---|---|
| Frontend | http://localhost:8080 (Docker) yoki http://localhost:5173 (dev) |
| API docs (Swagger) | http://localhost:8080/api/docs/ |
| Django admin | http://localhost:8080/admin/ |
| Demo login | `manager` / `manager12345` · `admin` / `admin12345` (staff) |

---

## Imkoniyatlar

**Minimum talablar**
- Lead yaratish: name, phone/email, source, note (+ status, owner)
- Lead list: pagination, search (name/email/phone), status filter (bir nechta status birga)
- Statuslar: New, Contacted, Qualified, Won, Lost
- Lead detail: barcha ma'lumotlarni ko'rish, edit qilish, statusni bir klikda o'zgartirish
- Backend: JWT authentication, CRUD, validation, pagination, filtering, yagona xato formati

**Bonuslar**
- Activity / history: har bir o'zgarish kim, qachon, qaysi maydonni nimadan nimaga o'zgartirgani bilan saqlanadi
- Sorting: name, status, created_at, updated_at
- Dashboard: KPI'lar, status/source bo'yicha va oxirgi 30 kunlik grafiklar
- Docker: `docker compose up` bitta buyruq bilan Postgres, backend va frontend'ni ko'taradi
- Tests: 26 ta API testi (pytest)
- API documentation: OpenAPI 3 + Swagger UI
- CI: GitHub Actions testlarni Postgres'da ishlatadi, frontend'ni lint va build qiladi

---

## Ishga tushirish

### 1-variant: Docker (tavsiya)

```bash
docker compose up --build
```

http://localhost:8080 manzilini oching. Birinchi ishga tushishda migratsiyalar avtomatik bajariladi va 60 ta demo lead yaratiladi.

### 2-variant: Lokal development

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # DATABASE_URL ni bo'sh qoldirsangiz, SQLite ishlatiladi
python manage.py migrate
python manage.py seed           # demo userlar va leadlar
python manage.py runserver
```

**Frontend** (Node 20+):

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173, /api -> 127.0.0.1:8000 ga proxy qilinadi
```

### 3-variant: Render.com'ga deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/nematov-dev/mini-crm)

`render.yaml` (Blueprint) bepul PostgreSQL va bitta Docker web service yaratadi. Root `Dockerfile` React app'ni build qiladi, so'ng uni Django + WhiteNoise orqali API bilan bitta domenda beradi, shuning uchun CORS kerak emas. Secret key avtomatik generatsiya qilinadi, migratsiya va demo ma'lumotlar birinchi ishga tushishda bajariladi.

> Bepul planda servis 15 daqiqa ishlatilmasa uxlab qoladi, keyingi birinchi so'rov ~1 daqiqa olishi mumkin.

**Testlar:**

```bash
cd backend && python -m pytest
```

---

## Arxitektura

```
mini-crm/
├── backend/
│   ├── config/              # settings, urls, pagination, global exception handler
│   ├── accounts/            # auth endpointlari: login, refresh, me, users
│   └── leads/
│       ├── models.py        # Lead, LeadActivity
│       ├── serializers.py   # input validation va output shakli
│       ├── services.py      # biznes-logika: create/update/status + activity log, stats
│       ├── views.py         # ViewSet: HTTP <-> service
│       ├── filters.py       # django-filter FilterSet
│       ├── permissions.py   # delete faqat owner yoki admin uchun
│       └── tests/
├── frontend/
│   └── src/
│       ├── api/             # axios client (JWT + refresh), typed endpointlar
│       ├── auth/            # AuthContext
│       ├── pages/           # Login, Leads, LeadDetail, Dashboard
│       ├── components/      # Layout, LeadFormModal, StatusTag, RequireAuth
│       └── lib/             # konstantalar, xatolarni formaga bog'lash
├── docker-compose.yml       # lokal: db (postgres) + backend (gunicorn) + frontend (nginx)
├── Dockerfile               # deploy: frontend build + backend bitta image'da
└── render.yaml              # Render Blueprint
```

### So'rov oqimi

```
React (TanStack Query) -> axios -> nginx /api -> gunicorn -> DRF ViewSet
    -> Serializer (validation) -> services.py (transaction: Lead + LeadActivity) -> PostgreSQL
```

### Asosiy qarorlar va ularning sabablari

1. **Service layer (`leads/services.py`).** View'lar faqat HTTP bilan ishlaydi, yozish logikasi esa servisda turadi. Lead o'zgarishi va unga mos `LeadActivity` yozuvi **bitta tranzaksiyada** saqlanadi. Shu sababli tarix hech qachon "unutilmaydi": status PATCH orqali o'zgarsa ham, `/status/` endpointi orqali o'zgarsa ham, seed buyrug'i orqali o'zgarsa ham log yoziladi. Django signallari o'rniga oddiy funksiya tanladim: signal'da `request.user` (actor) yo'q va oqimni kuzatish qiyinroq.

2. **Status uchun alohida endpoint (`POST /leads/{id}/status/`).** Bu biznes-amal, oddiy maydon yangilanishi emas. Alohida endpoint aniq audit yozuvini (`status_changed`) beradi. Bir xil statusga o'tkazish 400 qaytaradi. Kelajakda bu yerga transition qoidalari qo'shilishi mumkin, masalan "Lost → Won mumkin emas". PATCH orqali o'zgartirish ham ishlaydi va u ham log qilinadi.

3. **Validation ikki qatlamda.**
   - Serializer foydalanuvchiga tushunarli xabar beradi: name trim qilinadi va kamida 2 belgi bo'lishi kerak, email lowercase qilinadi, telefon `+998901234567` ko'rinishiga normalizatsiya qilinadi.
   - DB darajasida `CheckConstraint` bor: lead'da email **yoki** telefon bo'lishi shart. Bu admin panel, shell yoki boshqa yo'l bilan ham buzib bo'lmaydigan oxirgi himoya.
   - PATCH'da validation joriy qiymatlar bilan birlashtiriladi, ya'ni oxirgi kontaktni o'chirib bo'lmaydi.

4. **Yagona xato formati (`config/exceptions.py`).** Barcha xatolar bir shaklda qaytadi:
   ```json
   {"error": {"code": "validation_error", "message": "Invalid input.", "details": {"email": ["Enter a valid email address."]}}}
   ```
   Frontend `details` orqali xatoni kerakli forma maydoni ostida ko'rsatadi, `message`ni esa toast sifatida chiqaradi. Kutilmagan exception log qilinadi, mijozga esa ichki tafsilotlarsiz 500 qaytadi.

5. **Authentication: JWT (access 30 daqiqa, refresh 7 kun).** SPA va API alohida bo'lgani uchun stateless token qulay. Frontend 401 olganda tokenni **bir marta** yangilaydi (single-flight). Bir vaqtda kelgan bir nechta 401 bitta refresh so'rovini kutadi. Refresh ham muvaffaqiyatsiz bo'lsa, foydalanuvchi login sahifasiga qaytariladi.
   *Trade-off:* tokenlar `localStorage`da saqlanadi (sodda). Production'da refresh tokenni httpOnly cookie'da saqlash XSS'ga qarshi xavfsizroq bo'lardi.

6. **Ruxsatlar.** Kichik jamoada pipeline umumiy: har qanday autentifikatsiyadan o'tgan foydalanuvchi barcha leadlarni ko'radi va tahrirlaydi. **O'chirish** esa faqat lead egasi (owner) yoki staff uchun ruxsat etilgan, chunki u qaytarib bo'lmaydigan amal.

7. **Pagination.** `PageNumberPagination` ishlatiladi. Javobda `count`, `page`, `page_size`, `total_pages` bor, `page_size` esa ko'pi bilan 100 tagacha cheklangan. CRM jadvali uchun "N-sahifaga o'tish" kerak bo'lgani uchun cursor pagination tanlanmadi.

8. **Frontend holati URL'da.** Sahifa, qidiruv, filter va sort query parametrlarida saqlanadi (`/leads?status=won&search=ali&page=2`). Sahifani yangilaganda holat yo'qolmaydi, havolani ulashish mumkin, "orqaga" tugmasi ishlaydi. Server holati TanStack Query'da cache qilinadi, mutation'dan keyin tegishli query'lar invalidate qilinadi.

### Data model

```
User (django.contrib.auth)
  │ 1
  │        owner (SET_NULL)
  ├──────────────────────────┐
  │                          ▼ *
  │                 ┌─────────────────────────────┐
  │                 │ Lead                        │
  │                 │ id, name, email, phone      │
  │                 │ source  (TextChoices)       │
  │                 │ status  (TextChoices)       │
  │                 │ note, created_at, updated_at│
  │                 └──────────────┬──────────────┘
  │ actor (SET_NULL)               │ 1   (CASCADE)
  │                                ▼ *
  │                 ┌─────────────────────────────┐
  └────────────────▶│ LeadActivity                │
                    │ action: created / updated / │
                    │         status_changed      │
                    │ changes: JSON {field:       │
                    │   {from, to}}               │
                    │ created_at                  │
                    └─────────────────────────────┘
```

- **Status va source `TextChoices`, alohida jadval emas.** Ro'yxat qat'iy va kichik, kod ichida ishlatiladi (`LeadStatus.WON`), DB'da esa o'qiladigan qiymat (`"won"`) saqlanadi. Agar admin panel orqali source qo'shish kerak bo'lsa, `Source` jadvaliga FK qilish oson migratsiya bo'ladi.
- **Indekslar** asosiy so'rovlarga mos qilingan: `(status, -created_at)` status filter + default sort uchun, `-created_at` va `source`, `(lead, -created_at)` esa activity ro'yxati uchun.
- **`owner` uchun `SET_NULL`.** Xodim o'chirilsa, leadlar yo'qolmaydi. Activity'da owner o'zgarishi ID emas, **ism** bilan saqlanadi, shuning uchun tarix keyin ham o'qiladigan bo'lib qoladi.
- **`LeadActivity.changes` JSON.** Har bir o'zgarishga alohida jadval yaratmasdan, moslashuvchan diff saqlanadi: `{"status": {"from": "new", "to": "won"}}`. Log faqat qo'shiladi (append-only), hech narsa o'zgarmagan PATCH yozuv yaratmaydi.

---

## API

Barcha endpointlar (login/refresh'dan tashqari) `Authorization: Bearer <access>` talab qiladi. To'liq interaktiv hujjat: `/api/docs/`.

| Method | Endpoint | Tavsif |
|---|---|---|
| POST | `/api/auth/login/` | `{username, password}` → `{access, refresh}` |
| POST | `/api/auth/refresh/` | `{refresh}` → `{access}` |
| GET | `/api/auth/me/` | Joriy foydalanuvchi |
| GET | `/api/users/` | Faol foydalanuvchilar (owner tanlash uchun) |
| GET | `/api/leads/` | Ro'yxat (pagination, search, filter, ordering) |
| POST | `/api/leads/` | Yaratish |
| GET | `/api/leads/{id}/` | Detail |
| PATCH / PUT | `/api/leads/{id}/` | Tahrirlash |
| DELETE | `/api/leads/{id}/` | O'chirish (owner yoki staff) |
| POST | `/api/leads/{id}/status/` | `{status}`: statusni o'zgartirish |
| GET | `/api/leads/{id}/activities/` | O'zgarishlar tarixi (paginated) |
| GET | `/api/leads/stats/` | Dashboard statistikasi (list filterlarini ham qabul qiladi) |

**List query parametrlari:**

| Parametr | Misol |
|---|---|
| `page`, `page_size` | `?page=2&page_size=20` (max 100) |
| `search` | `?search=ali` (name, email, phone bo'yicha) |
| `status` (takrorlanadi) | `?status=new&status=contacted` |
| `source` (takrorlanadi) | `?source=ads` |
| `owner` | `?owner=3` |
| `created_after`, `created_before` | `?created_after=2026-09-01` |
| `ordering` | `?ordering=-created_at` · `name` · `status` · `updated_at` |

**Misol:**

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login/ -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"manager12345"}' | jq -r .access)

curl -s "localhost:8080/api/leads/?status=won&ordering=name" -H "Authorization: Bearer $TOKEN"

curl -s -X POST localhost:8080/api/leads/ -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Ali Valiyev","phone":"+998 90 123 45 67","source":"website"}'
```

**HTTP status kodlari:** `200/201/204` muvaffaqiyat · `400` validation · `401` token yo'q yoki eskirgan · `403` ruxsat yo'q · `404` topilmadi · `500` kutilmagan xato (log qilinadi).

---

## Testlar

`backend/leads/tests/` papkasida 26 ta test bor:
- auth: tokensiz kirishda 401, login, noto'g'ri parol
- validation: email, phone, source, status, name; email yoki phone majburiyligi; PATCH'da oxirgi kontaktni o'chirib bo'lmasligi
- pagination shakli, `page_size` cheklovi, noto'g'ri sahifa
- search, ko'p qiymatli status filter, noto'g'ri filter qiymati, sorting
- status o'zgarishi va activity diff, bir xil statusga o'tishni rad etish, o'zgarishsiz PATCH log yozmasligi, owner o'zgarishi
- delete ruxsatlari (owner, owner bo'lmagan foydalanuvchi)
- 404 formati, stats hisob-kitobi

CI testlarni haqiqiy PostgreSQL'da ishlatadi.

---

## AI'dan foydalanish

Loyiha **Claude Code** (AI coding assistant) yordamida yozildi. Qanday ishlatilgani:

- **Nimaga ishlatildi:** loyiha skeleti, boilerplate (settings, serializer, AntD komponentlari), testlar, Docker va CI konfiguratsiyasi, README qoralamasi.
- **Arxitektura qarorlari** (service layer, alohida status endpoint, DB constraint, yagona xato formati, ruxsatlar modeli, URL'dagi holat) muhokama qilinib, yuqorida tushuntirilgan sabablar bilan tanlandi.
- **Natija qanday tekshirildi:**
  - Har bir backend qadamidan keyin API'ga qo'lda so'rov yuborib tekshirildi, so'ng avtomatik testlar yozildi (SQLite va PostgreSQL'da).
  - Frontend headless brauzerda to'liq oqim bo'yicha tekshirildi: login → ro'yxat → qidiruv → validation xatolari → yaratish → status o'zgarishi → activity → dashboard → mobil ko'rinish. Console'da xato chiqmasligi ham tekshirildi.
  - Docker stack ko'tarilib, barcha route'lar (SPA, API, admin, static) tekshirildi.
- **Review paytida topilib tuzatilgan muammolar:**
  - `Meta.ordering = ["-created_at"]` tufayli `values().annotate(Count)` so'rovida `created_at` GROUP BY'ga tushib, statistikani buzar edi. `.order_by()` bilan tuzatildi.
  - 30 kunlik grafik oynasi UTC'da hisoblanib, mahalliy kun bilan mos kelmas edi. `timezone.localtime` bilan tuzatildi.
  - Activity'da owner o'zgarishi `user #3` ko'rinishida saqlanayotgan edi. Endi ism bilan saqlanadi.
  - Standart JWT secret HS256 uchun juda qisqa edi (testdagi `InsecureKeyLengthWarning`). Uzunroq qilindi.

---

## Keyingi qadamlar (vaqt bo'lganda)

- Status transition qoidalari (state machine) va "lost reason" maydoni
- Refresh tokenni httpOnly cookie'ga ko'chirish, login uchun rate limiting
- Takroriy leadlarni aniqlash (bir xil telefon yoki email)
- Leadga izoh va vazifa (task/reminder) qo'shish
- Frontend testlari (Vitest + React Testing Library) va Playwright E2E'ni CI'ga qo'shish
- Rollar: manager faqat o'z leadlarini ko'radi, admin hammasini ko'radi
