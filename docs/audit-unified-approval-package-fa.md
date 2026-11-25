<div dir="rtl" align="right">

# بستهٔ واحد بررسی و تصویب معماری Audit

**وضعیت معماری: `PROPOSED — NOT APPROVED`**

این سند برای بررسی مستقل پنج حوزهٔ امنیت، DBA/Platform، Privacy/Legal، Clinical و Product تهیه شده است. این بسته تصمیم انسانی را جایگزین نمی‌کند و به‌تنهایی مجوز پیاده‌سازی، تغییر زیرساخت، migration، استفاده از دادهٔ واقعی یا فعال‌سازی دسترسی بالینی نیست. همهٔ فرم‌های تأیید خالی‌اند؛ هیچ تأیید، امضا، نام یا تاریخی از طرف مسئولان ثبت نشده است.

**وضعیت جاری:** `ClinicalGuard` باید deny-by-default بماند؛ Phase 0 **BLOCKED** است و Phase 1 آغاز نشده است. Fail-closed در این سند صرفاً سیاست پیشنهادی است، نه سیاست مصوب یا رفتار اجرایی تأییدشده.

## دامنه و اسناد مبنا

این بسته بر بازبینی ایستای اسناد و شواهد موجود در مخزن متکی است؛ schema زنده، مجوزهای DB مستقر، WORM/KMS واقعی، runtime و backup/restore عملیاتی در این بازبینی آزموده نشده‌اند. وجود سند به‌تنهایی نه کفایت محتوایی است و نه تأیید.

اسناد محوری برای بررسی:

- `docs/audit-final-architecture-proposal-fa.md` — طرح پیشنهادی معماری و گزینه‌ها.
- `docs/audit-architecture-review-fa.md` — یافته‌های read-only دربارهٔ جدول‌ها، cascadeها، routeها و پوشش رویدادها.
- `docs/audit-approval-package-fa.md` — ماتریس تصمیم‌ها و معیارهای AUD-AC-01..12.
- `docs/phase0-final-readiness-report-fa.md` — blockers و وضعیت Gate.
- اسناد تخصصی/زمینه‌ای در بخش‌های مرتبط همین سند و پیوست‌های ذکرشده در هر بخش.

---

## بخش اول — معرفی معماری پیشنهادی

### 1. هدف Audit Store مستقل

هدف، ایجاد مرجع ثبت رویدادهای حسابرسی مستقل از دیتابیس عملیاتی است تا چرخهٔ عمر رکورد business، حذف آبشاری، تغییرات عادی برنامه یا یک failure domain واحد به‌تنهایی نتواند تاریخچه را پاک یا بی‌اثر کند. Audit Store باید حداقل event لازم برای پاسخ‌گویی به «چه actor یا سرویسی، چه عملی روی کدام منبع، چه زمانی و با چه نتیجه‌ای انجام داد؟» را نگه دارد؛ نه کپی پرونده یا payload کامل درخواست را.

### 2. طرح پیشنهادی

1. **Append-only ingestion:** سرویس ثبت رویداد، eventهای schema-valid را می‌پذیرد و receipt پایدار می‌دهد. رویداد قدیمی با UPDATE بازنویسی نمی‌شود؛ اصلاح/ابطال معنایی با event جبرانی و ارجاع به رویداد پیشین بیان می‌شود.
2. **Audit Store جدا:** محل ثبت معتبر از دیتابیس عملیاتی و دسترسی‌های روزمرهٔ آن جدا باشد. Eventها به رکوردهای business با FK/cascade متصل نشوند.
3. **Hash Chain:** رویدادهای canonicalized در scope/partition تعریف‌شده به hash قبلی متصل شوند؛ verifier مستقل gap، حذف، reorder، duplicate و mismatch را کشف کند. الگوریتم، قالب canonicalization و partitioning هنوز انتخاب و تصویب نشده‌اند.
4. **WORM:** checkpoint/root امضاشده به storage خارج از trust boundary با object-lock/WORM نوشته شود تا حفظ نسخه در بازهٔ retention دشوارتر از حذف محلی باشد. WORM به‌تنهایی کامل‌بودن eventها را ثابت نمی‌کند و ممکن است با حذف قانونی تعارض داشته باشد.
5. **تفکیک Writer / Reader / Admin:** Writer فقط append محدود و دریافت receipt؛ Reader/Auditor فقط read در scope مجاز؛ application دسترسی مستقیم owner نداشته باشد؛ DB/schema owner، migration، key custodian، backup/recovery و WORM admin هویت‌های جدا و کنترل‌شده داشته باشند. هیچ role عادی نباید UPDATE/DELETE/TRUNCATE/DDL یا تغییر retention انجام دهد.
6. **مدیریت کلید:** کلیدهای signing، encryption و pseudonymous reference از هم جدا باشند؛ signing key خارج DB و container برنامه، با custody محدود و rotation/revocation/recovery مستند. KMS/HSM، الگوریتم، quorum، cadence و provider هنوز تعیین نشده‌اند.
7. **Backup و Recovery:** Audit Store و anchorها در failure domain مناسب و با credential جدا پشتیبان‌گیری شوند. پس از restore، range/sequence، chain head، signature و WORM receipt مستقل verify شوند. هدف‌های RPO/RTO، دورهٔ نگهداری و تمرین DR هنوز تأیید نشده‌اند.
8. **سیاست پیشنهادی Fail-closed:** اگر برای عملیات حساس receipt پایدار Audit دریافت نشود، داده افشا نشود و mutation حساس موفق اعلام نگردد؛ خطا alert شود و recovery/replay محدود و idempotent باشد. این صرفاً پیشنهاد است؛ عملیات مشمول، استثناها، queue/buffer و موازنهٔ ایمنی/دسترس‌پذیری نیازمند تصویب امنیت، DBA/Platform و Clinical است.

### 3. محدودیت‌ها و ریسک‌های شناخته‌شده

- در سورس بررسی‌شده، `clinical.access_log.record_id` با `ON DELETE CASCADE` به پرونده متصل است؛ حذف parent می‌تواند log مرتبط را حذف کند. `contact_status_events` و بخشی از زنجیرهٔ refund نیز cascade دارند؛ برخی migrationهای `down()` جداول event-like را DROP می‌کنند.
- مسیرهای مشاهده‌شده، emergency access، assignment/revoke، تغییر نقش/مجوز و برخی عملیات مدیریتی را به‌طور کامل audit نمی‌کنند. `ClinicalGuard` در وضعیت جاری unconditional deny است.
- API فاقد endpoint مستقیم حذف یک log بودن، در برابر DB owner، cascade، migration، restore یا compromise تضمین immutability نیست.
- Hash Chain تشخیص دستکاری را تا حدود anchor فراهم می‌کند، اما به‌تنهایی جلوی حذف را نمی‌گیرد؛ آخرین بازهٔ anchor نشده، compromise کلید و دسترسی به هر دو trust domain ریسک باقی می‌مانند.
- WORM، pseudonymous ID و hash ممکن است همچنان اطلاعات شخصی باشند؛ immutability نباید برای دورزدن حذف قانونی استفاده شود.
- Audit Store مستقل هزینه، پیچیدگی، latency، availability و ناسازگاری dual-write می‌افزاید. Fail-closed می‌تواند عملیات حیاتی را متوقف کند؛ fail-open ممکن است ممیزی را ناقص بگذارد.
- هیچ provider، jurisdiction، retention period، SLA، RPO/RTO یا هزینهٔ زیرساختی در این proposal تصویب نشده است.

### 4. پرسش‌های تصمیم مشترک

- آیا معماری پیشنهادی پذیرفته می‌شود یا گزینهٔ دیگری انتخاب می‌شود؟ Trust boundary و residual risk چیست؟
- کدام eventها اجباری‌اند، چه metadata حداقلی مجاز است و کدام داده‌ها مطلقاً نباید ثبت شوند؟
- failure چه عملیاتی را متوقف می‌کند، آیا buffer/outbox مجاز است و recovery چگونه بدون duplicate/gap انجام می‌شود؟
- retention، حذف، legal hold، backup/WORM و mapping هویت چگونه با الزامات قانونی سازگار می‌شوند؟
- چه evidence، آزمون، معیار و مالکی برای پذیرش هر شرط لازم است؟ هیچ معیار صرفاً با متن این proposal PASS نمی‌شود.

---

## بخش دوم — بررسی امنیت اطلاعات (Security)

**اسناد مرتبط:** `docs/audit-review-security-fa.md`, `docs/audit-architecture-review-fa.md`, `docs/audit-final-architecture-proposal-fa.md`, `docs/audit-approval-package-fa.md`, `docs/security-fa.md`, `docs/api-fa.md`, و در صورت نیاز `Dockerfile` و `compose.yaml`.

`security-fa.md` و `api-fa.md` توصیف‌هایی از access logging/clinical دارند که برای اثبات طراحی نهایی کافی نیستند و باید با Guard deny-by-default و یافته‌های ممیزی تطبیق شوند. Schema و grants مستقر بررسی نشده‌اند.

### پرسش‌های تخصصی

1. در threat model، مهاجم application، writer credential، DB owner، migration operator، WORM/cloud admin و key custodian چگونه مدل می‌شوند؟ trust boundaryها کجا هستند؟
2. آیا append-only grant، جداسازی DB roles و کنترل DDL واقعاً UPDATE/DELETE/TRUNCATE غیرمجاز را رد و تلاش را alert می‌کنند؟ در برابر owner/superuser چه محدودیتی باقی می‌ماند؟
3. آیا طراحی Hash Chain canonicalization، ordering، partition و checkpoint را درست تعریف می‌کند؟ حذف/reorder/gap تا کدام anchor قابل کشف است؟
4. آیا WORM/object-lock خارج trust boundary است؟ چه کسی می‌تواند retention lock عوض کند یا anchor پاک کند؟ آیا تغییرات کنترل‌پلین خودشان ثبت می‌شوند؟
5. آیا Writer، Reader، application، Admin، migration، key custody و backup identities به اندازهٔ کافی جدا هستند؟ دسترسی به خود Audit و export نیز audit می‌شود؟
6. KMS/HSM، الگوریتم‌ها، key rotation، revocation، quorum، recovery و verify امضاهای تاریخی چگونه کنترل می‌شوند؟
7. چه eventها و outcomeهای denied/failed باید ثبت شوند؟ چه metadata مانند IP/device fingerprints غیرضروری یا پرریسک است؟
8. آیا Fail-closed پیشنهادی برای عملیات حساس از نظر threat model مناسب است؟ چه خطر availability، local buffer، retry، alert و incident response باقی می‌ماند؟
9. چه tamper simulation، privilege test، key recovery و independent verification evidence پیش از تصویب لازم است؟

**موارد باز:** threat boundary، الگوریتم/provider، anchor cadence، alert SLA، risk acceptance و آزمون‌های runtime تصویب نشده‌اند. هیچ تستی در تهیهٔ این بسته اجرا نشده است.

---

## بخش سوم — بررسی زیرساخت و پایگاه داده (DBA / Platform)

**اسناد مرتبط:** `docs/audit-review-dba-fa.md`, `docs/audit-architecture-review-fa.md`, `docs/audit-final-architecture-proposal-fa.md`, `docs/audit-approval-package-fa.md`, `docs/vps-backup-fa.md`, `compose.yaml`, `Dockerfile`, `docs/phase0-final-readiness-report-fa.md`.

`compose.yaml` توصیف سرویس web و PostgreSQL عملیاتی است؛ Audit Store مستقل/WORM در آن تعریف نشده و اجرای Compose در این بررسی انجام نشده است. راهنمای VPS backup، Audit Store و DR اختصاصی آن را اثبات نمی‌کند.

### پرسش‌های تخصصی

1. چگونه Audit Store از دیتابیس، credential و failure domain عملیاتی جدا شود؟ چه topology، replication و network boundary لازم است؟
2. چه هویتی مالک schema است و چه هویتی runtime writer، reader، migration، backup/recovery و operator؟ چگونه separation of duties اجرا و بازبینی می‌شود؟
3. چگونه UPDATE/DELETE/TRUNCATE/DDL/drop و تغییر retention غیرمجاز رد و پایش شوند؟ چه کنترل‌هایی در برابر DBA/owner قدرتمند باقی می‌مانند؟
4. آیا FK/cascade به business row حذف می‌شود؟ legacy eventها، migrationهای destructive و rollback چگونه مدیریت می‌شوند تا audit حذف نشود؟
5. Backup چگونه رمزگذاری، جدا، نگهداری و verify می‌شود؟ Restore چگونه chain head، ranges، gaps، anchors و duplicateها را می‌سنجد؟
6. برای ingest و read چه RPO/RTO لازم است؟ چه SLA، lag، ترتیب و idempotency قابل قبول‌اند؟ اعداد باید مالک‌دار و مصوب شوند.
7. در outage، queue/outbox محلی مجاز است؟ چه quota، encryption، retention، replay و reconciliation لازم است؟
8. چه migration/recovery path و change approval مانع پاک‌شدن تاریخچه می‌شود؟ آیا recovery دو نفره و دارای audit مستقل است؟
9. حجم event، مدت retention و concurrency چه ظرفیت، storage، monitoring، on-call و هزینه‌ای می‌طلبد؟ چه اعداد/فرض‌هایی برای cost estimate کم است؟
10. چه DR drill و محیط synthetic لازم است؟ این بسته مجوز نصب سرویس یا اجرای runtime نمی‌دهد.

**موارد باز:** Audit Store مستقل، فناوری/provider، ظرفیت و هزینه، RPO/RTO، مجوزهای واقعی DB، backup/restore Audit و migration plan تأیید نشده‌اند. در بررسی ایستا هیچ schema زنده یا role مستقر inspect نشده است.

---

## بخش چهارم — بررسی حریم خصوصی و حقوقی (Privacy / Legal)

**اسناد مرتبط:** `docs/audit-review-privacy-legal-fa.md`, `docs/audit-final-architecture-proposal-fa.md`, `docs/audit-approval-package-fa.md`, `docs/product-open-issues-fa.md`, `docs/clinical-access-policy-proposal-fa.md`, و `docs/vps-backup-fa.md` فقط به‌عنوان زمینهٔ backup.

فایل `سایت روانشناسی دکتر رحمانی.docx` داخلی و بالقوه حساس است؛ به این بسته پیوست نشده و محتوایش بازنشر نمی‌شود. در صورت نیاز، مالک سند باید نسخهٔ redacted و مجاز را مستقیماً در کانال امن فراهم کند. هیچ ادعای حقوقی از طرف این سند ارائه نمی‌شود.

### پرسش‌های تخصصی

1. برای هر دستهٔ رویداد، چه داده‌ای واقعاً ضروری و مجاز است؟ آیا نام، تماس، IP/device، role snapshot یا resource reference قابل شناسایی است؟
2. آیا pseudonymous `subject_ref` و HMAC reference همچنان دادهٔ شخصی/قابل انتساب‌اند؟ mapping کجا، با دسترسی چه کسانی و تا چه زمان نگهداری شود؟
3. چه اطلاعاتی ممنوع باشد؟ حداقل‌سازی باید مانع ثبت clinical narrative، محتوای summary، credential، token، payment secret و بدنهٔ کامل درخواست شود؟
4. مبنا و مدت retention برای هر رویداد چیست؟ از چه لحظه‌ای آغاز می‌شود و چه استثنای قانونی/قراردادی وجود دارد؟ هیچ مدت از این proposal فرض نشود.
5. درخواست حذف/اصلاح چگونه روی Audit event، identity mapping، replica، backup، export، WORM و legal hold اثر می‌گذارد؟ آیا/چگونه crypto-shred یا anonymization معتبر است؟
6. چگونه محرمانگی اطلاعات مراجعان حفظ شود، به‌خصوص در گزارش‌گیری، export، دسترسی auditor و event مربوط به مشاهدهٔ پرونده؟
7. آیا WORM retention یا hash قابل انتساب با حق حذف، اصلاح، محدودسازی یا legal order تعارض دارد؟ چه مسیر escalation/تصمیم انسانی لازم است؟
8. چه jurisdiction/data residency، processor/subprocessor، قرارداد، disclosure و الزامات اطلاع‌رسانی/رضایت باید پیش از انتخاب provider بررسی شوند؟
9. آیا record حذف‌شده را می‌توان برای مدت مشخص در Audit حفظ کرد؟ اگر بله، کدام مبنا و حداقل داده لازم است؛ اگر خیر، چه چیزی و چگونه پاک می‌شود؟

**موارد باز:** مبنای قانونی، دسته/مدت retention، حذف در برابر WORM، jurisdiction/provider، notice/consent، legal hold و backup erasure تصویب نشده‌اند. این بسته جای مشاوره یا نظر حقوقی را نمی‌گیرد.

---

## بخش پنجم — بررسی بالینی (Clinical)

**اسناد مرتبط:** `docs/audit-review-clinical-fa.md`, `docs/clinical-access-policy-proposal-fa.md`, `docs/audit-architecture-review-fa.md`, بخش‌های بالینی `docs/audit-approval-package-fa.md`, `docs/prd-final-fa.md`, `docs/product-decision-history-fa.md`.

`docs/api-fa.md`, `docs/admin-guide-fa.md` و `docs/security-fa.md` صرفاً برای تطبیق‌اند؛ برخی توصیف‌های دسترسی/ثبت باید با وضعیت جاری بررسی شوند. `ClinicalGuard` فعلی unconditional deny است؛ هیچ دسترسی مثبت یا emergency workflow با این بسته فعال نمی‌شود. در تصمیم‌های تاریخی، دسترسی مدیر کلینیک superseded است؛ emergency eligibility جاری که در policy ثبت شده فقط دکتر رحمانی و سوپروایزر ارشد است، اما اجرای آن اثبات نشده است.

### پرسش‌های تخصصی

1. چه رویدادهایی برای مشاهده، فهرست، ایجاد، اصلاح، export، archive/restore و درخواست حذف پرونده ثبت شوند؟ برای هرکدام attempt، deny و outcome لازم است؟
2. چه اطلاعات حداقلی برای ثبت مشاهده/تغییر لازم است، بی‌آنکه متن پرونده، تشخیص یا خلاصهٔ درمان در Audit تکرار شود؟
3. چگونه انتقال پرونده، ایجاد/پایان assignment، revoke قبلی و propagation به session/cache به‌طور قابل اثبات ثبت شوند؟
4. در دسترسی اضطراری، چه actorهایی واجد شرایط‌اند، چه resource scope، مدت، reason code، approver، اقدامات، پایان دسترسی و post-review لازم است؟
5. کدام محدودیت‌های دسترسی متخصصان باید enforce شوند؟ آیا فقط متخصصِ منتسب می‌تواند مشاهده کند؟ پوشش/چندمتخصصی چه استثنایی دارد و چه کسی تأیید می‌کند؟
6. کدام metadata بالینی ممنوع یا بسیار محدود باشد؟ چه کسانی می‌توانند audit را بخوانند یا export کنند؟ آیا auditor باید محتوای پرونده را نبیند؟
7. اگر Audit Store unavailable باشد، fail-closed برای read، emergency و درمان از نظر ایمنی بیمار چه پیامدهایی دارد؟ آیا استثنای اضطراری لازم است و چه کنترل‌های جایگزینی/ثبت بعدی و approval لازم دارد؟
8. چگونه خطاهای Audit به افشای داده یا توقف نامحدود خدمت منجر نشوند، بدون آن‌که عملیات حساس بی‌ثبت انجام شود؟
9. چه retention، correction و حذف بالینی/حقوقی لازم است و چه تصمیمی باید مشترکاً با Privacy/Legal گرفته شود؟

**موارد باز:** event coverage، emergency/assignment workflow، محتوای مجاز summary، full-record scope، Fail-closed safety assessment و retention بالینی تأیید نشده‌اند. Guard باید بسته بماند تا تصمیم‌ها و Gateهای جداگانه تکمیل شوند.

---

## بخش ششم — بررسی محصول (Product Owner)

**اسناد مرتبط:** `docs/audit-review-product-fa.md`, `docs/prd-final-fa.md`, `docs/product-acceptance-trace-fa.md`, `docs/product-decision-history-fa.md`, `docs/product-panels-fa.md`, `docs/product-open-issues-fa.md`, `README.md`, `docs/api-fa.md`, `docs/refund-acceptance-fa.md` در صورت بحث eventهای مالی.

این اسناد requirement و گردش کار را توصیف می‌کنند، اما به‌تنهایی coverage یا approval معماری را اثبات نمی‌کنند. متن مستقل پاسخ‌های محصولی ۱–۸۲ در workspace موجود نیست؛ تطبیق کامل با آن‌ها ادعا نمی‌شود.

### پرسش‌های تخصصی

1. چه رویدادهایی در حوزه‌های مدیریتی، مالی، آموزشی و بالینی باید پوشش داده شوند؟ برای هر domain فهرست success/failed/denied و owner چیست؟
2. منظور محصول از «غیرقابل‌حذف بودن گزارش‌ها» دقیقاً در برابر کدام actorها/سناریوهاست (کاربر، مدیر، DBA، migration، backup operator)؟ مرز و استثناهای قانونی چیست؟ ادعای مطلق بدون trust boundary پذیرفته نشود.
3. چه سطوحی مجاز به مشاهده، جست‌وجو، export و verification گزارش‌اند؟ دسترسی به خود گزارش و export چگونه audit می‌شود؟
4. کدام عملیات حساس نیازمند ثبت قبل از افشا/تغییر و receipt پایدار است؟ آیا audit denied/failed هم نیاز محصول است؟
5. نیاز محصول به نگهداری، جست‌وجو، export، archive و بازیابی چیست؟ مدت و مبنای retention را Privacy/Legal تعیین و تصویب کند.
6. نیازمندی‌های مؤسسه دربارهٔ availability هنگام Audit outage چیست؟ Fail-closed پیشنهادی چه workflowهایی را متوقف می‌کند و چه trade-offی باید به‌صراحت پذیرفته شود؟
7. معیارهای قابل سنجش acceptance، reporting، completeness، latency و recovery چه هستند؟ مالک هر معیار و evidence لازم کیست؟
8. چگونه scope محصول با محدودیت‌های بالینی، امنیتی و حقوقی هماهنگ می‌شود؟ کدام موارد به owner تخصصی ارجاع می‌شوند؟
9. آیا منابع نسخه‌دار و مجاز برای تکمیل traceability requirementها در دسترس‌اند؟ هر تصمیم جدید در PRD/decision history ثبت شود.

**موارد باز:** دامنهٔ eventها، گزارش/export roles، تعریف محصولی immutability، معیار پذیرش/latency، جزئیات نگهداری و تأیید requirementها نیازمند تصمیم مالک محصول و هم‌ترازی با چهار حوزهٔ دیگر است.

---

## بخش هفتم — فرم‌های مستقل تأیید پنج حوزه

**دستور:** هر مسئول فرم حوزهٔ خود را مستقل تکمیل کند. هیچ فیلدی پیش‌پر نشده است. نتیجه فقط یکی از گزینه‌های تعیین‌شده باشد؛ در صورت شرط، شروط دقیق، مالک و مهلت در همان فرم بیاید. «تأیید مشروط» به‌معنای مجوز اجرا نیست مگر تصمیم/Gate جداگانه چنین اجازه‌ای بدهد.

### 7.1 فرم مسئول امنیت اطلاعات (Security)

- حوزهٔ تخصصی: ______________________________
- نام و نام خانوادگی: ______________________________
- سمت: ______________________________
- تاریخ بررسی: ______________________________
- نتیجه (`APPROVED / APPROVED WITH CONDITIONS / REJECTED`): ______________________________
- ایرادها و ریسک‌های شناسایی‌شده: ______________________________
- اصلاحات و شروط ضروری: ______________________________
- توضیحات تکمیلی: ______________________________
- امضا یا تأیید رسمی: ______________________________

### 7.2 فرم مسئول زیرساخت و پایگاه داده (DBA / Platform)

- حوزهٔ تخصصی: ______________________________
- نام و نام خانوادگی: ______________________________
- سمت: ______________________________
- تاریخ بررسی: ______________________________
- نتیجه (`APPROVED / APPROVED WITH CONDITIONS / REJECTED`): ______________________________
- ایرادها و ریسک‌های شناسایی‌شده: ______________________________
- اصلاحات و شروط ضروری: ______________________________
- توضیحات تکمیلی: ______________________________
- امضا یا تأیید رسمی: ______________________________

### 7.3 فرم مسئول حریم خصوصی و امور حقوقی (Privacy / Legal)

- حوزهٔ تخصصی: ______________________________
- نام و نام خانوادگی: ______________________________
- سمت: ______________________________
- تاریخ بررسی: ______________________________
- نتیجه (`APPROVED / APPROVED WITH CONDITIONS / REJECTED`): ______________________________
- ایرادها و ریسک‌های شناسایی‌شده: ______________________________
- اصلاحات و شروط ضروری: ______________________________
- توضیحات تکمیلی: ______________________________
- امضا یا تأیید رسمی: ______________________________

### 7.4 فرم مسئول بالینی (Clinical)

- حوزهٔ تخصصی: ______________________________
- نام و نام خانوادگی: ______________________________
- سمت: ______________________________
- تاریخ بررسی: ______________________________
- نتیجه (`APPROVED / APPROVED WITH CONDITIONS / REJECTED`): ______________________________
- ایرادها و ریسک‌های شناسایی‌شده: ______________________________
- اصلاحات و شروط ضروری: ______________________________
- توضیحات تکمیلی: ______________________________
- امضا یا تأیید رسمی: ______________________________

### 7.5 فرم مالک محصول (Product Owner)

- حوزهٔ تخصصی: ______________________________
- نام و نام خانوادگی: ______________________________
- سمت: ______________________________
- تاریخ بررسی: ______________________________
- نتیجه (`APPROVED / APPROVED WITH CONDITIONS / REJECTED`): ______________________________
- ایرادها و ریسک‌های شناسایی‌شده: ______________________________
- اصلاحات و شروط ضروری: ______________________________
- توضیحات تکمیلی: ______________________________
- امضا یا تأیید رسمی: ______________________________

---

## بخش هشتم — تصمیم نهایی و Gate

### 8.1 جدول وضعیت تأیید پنج حوزه

تمام خانه‌ها عمداً خالی‌اند. `APPROVED` را فقط بر پایهٔ فرم رسمی تکمیل‌شده و نسخهٔ اسناد بررسی‌شده وارد کنید.

| حوزه | نام مسئول | سمت | تاریخ بررسی | نتیجه | شروط/ریسک‌های باز | مرجع/امضای رسمی |
|---|---|---|---|---|---|---|
| Security | __________ | __________ | __________ | __________ | __________ | __________ |
| DBA / Platform | __________ | __________ | __________ | __________ | __________ | __________ |
| Privacy / Legal | __________ | __________ | __________ | __________ | __________ | __________ |
| Clinical | __________ | __________ | __________ | __________ | __________ | __________ |
| Product Owner | __________ | __________ | __________ | __________ | __________ | __________ |

### 8.2 موارد باز و شروط باقی‌مانده

برای هر مورد، owner، evidence و موعد/شرط بسته‌شدن را ثبت کنید؛ این فهرست اکنون تصمیم یا تأیید نیست.

| مورد باز/شرط | حوزهٔ مسئول | اقدام یا evidence لازم | مسئول | موعد/شرط تکمیل | وضعیت/مرجع تصمیم |
|---|---|---|---|---|---|
| انتخاب/تصویب معماری، trust boundary و residual risk | __________ | __________ | __________ | __________ | __________ |
| event scope، writer/reader/admin roles و آزمون‌های امنیتی | __________ | __________ | __________ | __________ | __________ |
| DB topology، ownership/grants، cascade و migration/recovery | __________ | __________ | __________ | __________ | __________ |
| retention، مبنای حقوقی، pseudonymization و حذف/WORM | __________ | __________ | __________ | __________ | __________ |
| بالینی: مشاهده، انتقال، emergency، محدودیت‌ها و ایمنی Fail-closed | __________ | __________ | __________ | __________ | __________ |
| پوشش product domains، گزارش‌ها و acceptance criteria | __________ | __________ | __________ | __________ | __________ |
| هزینه/منابع، RPO/RTO، backup/restore و DR evidence | __________ | __________ | __________ | __________ | __________ |
| سایر شروط/ریسک‌های پذیرفته‌شده | __________ | __________ | __________ | __________ | __________ |

### 8.3 محل ثبت تصمیم نهایی

تصمیم نهایی باید در سامانه/مرجع رسمی مؤسسه ثبت و به نسخهٔ دقیق این بسته و مدارک پشتیبان ارجاع داده شود. ثبت در این جدول به‌تنهایی جای امضا یا governance رسمی را نمی‌گیرد.

- محل/سامانهٔ رسمی ثبت تصمیم: ______________________________
- شناسهٔ تصمیم/صورت‌جلسه/تیکت: ______________________________
- نسخه یا شناسهٔ بسته و پیوست‌های بررسی‌شده: ______________________________
- نام مسئول تصویب نهایی: ______________________________
- سمت و دامنهٔ اختیار: ______________________________
- تاریخ تصویب: ______________________________
- تصمیم نهایی و شروط/محدودیت‌ها: ______________________________
- امضا یا تأیید رسمی: ______________________________

### 8.4 وضعیت Gate در زمان تهیهٔ این سند

- معماری Audit: **`PROPOSED — NOT APPROVED`**.
- Fail-closed: پیشنهاد بررسی‌نشده/تصویب‌نشده؛ رفتار اجرایی مصوب نیست.
- فرم‌های پنج حوزه و تصمیم نهایی: خالی؛ هیچ تأیید یا امضایی از طرف هیچ مسئول یا گروهی جعل یا ثبت نشده است.
- `ClinicalGuard`: deny-by-default باقی می‌ماند.
- Phase 0: **BLOCKED**؛ Phase 1 شروع نشده است.
- این سند صرفاً مستندسازی است: هیچ کد، SQL، schema، migration، تنظیم یا قابلیت اجرایی تغییر نمی‌دهد و مجوز تست runtime، نصب dependency، تغییر زیرساخت، commit، push یا deploy نیست.

</div>
