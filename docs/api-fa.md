# مستندات API مرکز رحمانی

> نسخهٔ پیش‌نمایش داخلی. مسیرها از دکوراتورهای `apps/api/src/*.ts` استخراج شده‌اند؛ قبل از تغییر هر ماژول این فایل را به‌روز کنید. نمونهٔ کامل احراز هویت در انتها آمده است.

## مدل احراز هویت

سه نوع تماس‌گیرندهٔ مستقل وجود دارد؛ هرکدام گارد/سرآیند مخصوص خود را دارند و در صورت خطا `401/403` برمی‌گردد.

### ۱) مراجع (Client)
- ورود: `POST /api/v1/client/login` یا `register` با JSON `{username, password}`.
- نشست: کوکی `rahmani_client` (httpOnly، SameSite=Strict، path=`/api/v1/client`).
- **همهٔ درخواست‌های غیر-GET باید سرآیند `X-Rahmani-Client: 1` داشته باشند** (`ClientOriginGuard`).
- نام مستعار: لاتین ۳–۴۸ نویسه؛ گذرواژه ۱۲–۱۲۸ نویسه.

### ۲) کارکنان (Staff: `manager` / `reception` / `specialist` / `viewer`)
- ورود: `POST /api/v1/staff/login` با `{username, password, code}` — کد TOTP شش‌رقمی از برنامهٔ رمزساز الزامی است (MFA).
- درخواست‌ها: `Authorization: Bearer <token_64hex>`.
- محدودیت‌ها: `ReceptionGuard` به نقش `reception` اجازهٔ تغییر می‌دهد و برای `manager`/`viewer` فقط خواندن باز است. `SpecialistGuard` و `ManagerGuard` فقط نقش همتای خود را می‌پذیرند.
- ساخت/غیرفعال‌سازی حساب فقط با ابزار میزبانی `staff-cli.ts` (نگاه کنید به `admin-guide-fa.md`).

### ۳) تماس عمومی (بدون احراز هویت)
- `POST /api/v1/contact-requests`، `POST /api/v1/feedback`، `POST /api/v1/journal/submissions` — با محدودیت نرخ و بدون دسترسی به هیچ دادهٔ خصوصی.

## محدودیت‌ها و قراردادها
- بدنهٔ پیش‌فرض `4kb`؛ `journal/submissions` تا `64kb`؛ صورت‌حساب تا `24kb`.
- خطاها شکل استاندارد NestJS دارند: `{message, error, statusCode}`؛ جزئیات ورودی برگردانده نمی‌شود.
- پول همیشه **ریال** و عدد صحیح است (`amount_irr`، `fee_irr`).
- زمان‌ها UTC ISO-8601 هستند و در رابط به وقت تهران نمایش داده می‌شوند.
- شناسه‌ها UUID v4 هستند مگر ذکر شده باشد (گواهی: کد ۱۰–۳۲ نویسه‌ای؛ رسید نقدی: `CASH-XXXXXXXXXXXX`).

## فهرست مسیرها (گروه‌بندی‌شده)

### مراجع — `/api/v1/client` (کوکی + سرآیند)
`register`, `login`, `logout`, `GET /` (داشبورد), `recovery/code`, `recovery/reset`, `holds` (POST لینک وقت), `holds` (DELETE آزادسازی)، `holds/:id/quote` (پیش‌فاکتور), `quotes/:id/checkout` (شروع پرداخت زرین‌پال)، `quotes/:id/recheck` (استعلام)، `quotes/:id/cancellation` (درخواست بررسی لغو)، `quotes/:id/meeting` (اتاق آنلاین جلسه)، `academy/:id/checkout|enrol|exam`، `library`، `GET /academy/:id/exam`.

### نگه‌داری وقت — `/api/v1/holds`
`POST /:slot` (۱۰ تا ۳۰ دقیقه، قابل پیکربندی با `HOLD_MINUTES`)، `GET /`، `DELETE /`. یک وقت فقط یک‌بار نگه داشته می‌شود (محدودیت exclusion روی بازهٔ زمانی + تراکنش).

### تقویم و شعب — `/api/v1/availability`, `/api/v1/branches`
`GET /availability` (عمومی)، `POST`/`DELETE` (پذیرش)، `GET /branches` (عمومی)، `POST`/`DELETE` (پذیرش؛ حذف = بایگانی).

### پروندهٔ بالینی — `/api/v1/clinical` (فقط نقش `specialist`؛ 503 بدون `CLINICAL_KEY`)
`POST /records` `{slot_id, record_type: session|intake|note, content≤4000}` (فقط جلسات قطعی؛ audit `create`)، `GET /records?slot_id=` (فقط متاداده)، `GET /records/:id` (متن رمزگشایی‌شده؛ audit `read`). همهٔ دسترسی‌ها در `clinical.access_log` ثبت می‌شود. مدیر/پذیرش/مراجع `403`.

### پذیرش — `/api/v1/reception` (گارد پذیرش؛ نوشتن فقط `reception`)
صف درخواست‌ها `GET /`، جزئیات/تاریخچه `:id/history`، تغییر وضعیت `PATCH /:id`، گزارش `GET /report`، جلسات و حضور `sessions*`، مالی لغو و بازپرداخت `sessions/finance*` (جداسازی وظایف: ثبت‌کننده ≠ تأییدکننده).

### صندوق پرداخت حضوری — `/api/v1/reception/cash`
`GET /pending` (فهرست نوبت‌های حضوری قطعی‌نشده)، `POST /record` `{quote_id, discount_irr?}` (فقط نقش `reception`؛ تأیید نوبت + مرجع رسید `CASH-…`)، `GET /report` (مجموع این ماه + ۱۰ رسید اخیر).

### مدیریت — `/api/v1/manager`
`GET /overview` (جمع‌های ماه جاری: مخاطبین، پرداخت‌های آنلاین + نقدی، بازپرداخت‌ها، جلسات، بازبینی‌های شهریه و لغوها)، `GET /staff`، `PATCH /staff/:id/active` (فعال/غیرفعال؛ تغییر وضعیت حساب مدیر ممکن نیست).

### متخصص — `/api/v1/specialist`
`GET /sessions?period=upcoming|past&page=`، `GET /earnings` (جمع ماهانهٔ ۱۲ ماه اخیر؛ شامل آنلاین + نقدی).

### ژورنال — `/api/v1/journal`
`POST /submissions` (عمومی، نیازمند بررسی)، `GET /published` (عمومی)، `GET/PATCH` صف بررسی (مدیر).

### آکادمی — `/api/v1/academy`, `/api/v1/academy-payments`
دوره‌ها/ظرفیت‌ها، ثبت‌نام، شهریه، آزمون و گواهی (`GET /courses/...`، `POST /exams/:id/open`، `GET /certificates/:code`)، بازبینی‌ها `GET/PATCH tuition-reviews*` (پذیرش).

### سایر
`GET /api/v1/payments/return` (بازگشت زرین‌پال؛ غیرقابل اعتماد بدون `verify` سمت سرور)، `GET /api/v1/academy-payments/return`، `GET/PATCH /api/v1/site/settings` (عمومی خواندن؛ تغییر فقط مدیر)، `GET /api/v1/feedback` صف شکایت/بازخورد (پذیرش)، `POST /api/v1/feedback` (عمومی)، `POST /api/v1/contact-requests` (عمومی)، `POST /api/v1/staff/login|logout`.

## نمونه‌ها

ورود کارکنان و خواندن صف:
```bash
TOKEN=$(curl -s -X POST localhost:8080/api/v1/staff/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"USER","password":"PASS","code":"123456"}' | jq -r .token)
curl -s localhost:8080/api/v1/reception -H "Authorization: Bearer $TOKEN"
```

ثبت پرداخت نقدی برای نوبت حضوری:
```bash
curl -s -X POST localhost:8080/api/v1/reception/cash/record \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"quote_id":"<uuid>","discount_irr":100000}'
# → {"reference":"CASH-…","amount_irr":…,"discount_irr":…}
```

ساخت حساب مراجع:
```bash
curl -s -c jar -X POST localhost:8080/api/v1/client/register \
  -H 'Content-Type: application/json' -H 'X-Rahmani-Client: 1' \
  -d '{"username":"name.example","password":"at-least-12-chars"}'
```
