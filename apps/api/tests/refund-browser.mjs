// Run ONLY against a disposable migrated local instance sharing these PG settings and MFA key.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {URI} from 'otpauth';
import {chromium} from 'playwright-core';
import bundled from '@sparticuz/chromium';
if(process.env.REFUND_E2E!=='1')throw Error('Set REFUND_E2E=1 for a disposable local database');
const fa=process.env.E2E_LOCALE==='fa';
const labels={'Sign in':'ورود','Cancelled appointment payments':'پیگیری مالی نوبت‌های لغوشده','Start financial review':'شروع بررسی مالی','Record result as assigned reviewer':'ثبت نتیجه توسط مسئول بررسی','Proposed refund (IRR)':'پیشنهاد استرداد (ریال)','Approve recommendation':'تأیید پیشنهاد','Reviewed':'بررسی‌شده','Record completed external transfer':'ثبت واریز انجام‌شده','Compare statement entries':'مقایسه با ردیف‌های صورت‌حساب','Compare with centre receipts':'مقایسه با رسیدهای مرکز','Amount matches':'هم‌مبلغ'};
const label=s=>fa?labels[s]:s;
const digits=s=>fa?s.replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]):s;
const db=new Client(), q=randomUUID(), client=randomUUID(), slot=randomUUID(), ref='PAY-'+q, refund='RF-'+q;
const cli=(...args)=>execFileSync(process.execPath,['dist/staff-cli.js',...args],{encoding:'utf8'}).trim();
const users=['desk','finance'].map(role=>role+'-'+q),creds=[];
const btn=(parent,name)=>parent.getByRole('button',{name:label(name),exact:true});
let browser;await db.connect();
try{
 for(const user of users)creds.push(cli('create',user,'reception').split('\n'));cli('grant-refund',users[1]);
 const {rows:[{id}]}=await db.query('SELECT id FROM staff_accounts WHERE username=$1',[users[0]]);
 await db.query('BEGIN');
 await db.query("INSERT INTO client_accounts(id,username,salt,verifier) VALUES($1,$2,'','')",[client,client]);
 await db.query("INSERT INTO appointment_slots(id,service,mode,starts_at,ends_at,published_by,fee_irr) VALUES($1,0,'online',now()+interval '80 days',now()+interval '80 days 30 minutes',$2,850000)",[slot,id]);
 await db.query('INSERT INTO booking_quotes(id,client_id,slot_id,hold_key,amount_irr,expires_at) VALUES($1,$2,$3,$4,850000,now())',[q,client,slot,q]);
 await db.query("INSERT INTO gateway_payments(quote_id,authority,state,reference,verified_at) VALUES($1,$2,'confirmed',$3,now())",[q,q,ref]);
 await db.query("INSERT INTO cancellation_requests(quote_id,requested_slot,reviewer,seen_at,decision,decided_by,decided_at) VALUES($1,$2,$3,now(),'approved',$3,now())",[q,slot,id]);await db.query('COMMIT');
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN||await bundled.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage']});
 async function login(index){const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(7000);page.on('dialog',d=>d.accept());await page.goto('http://localhost:8080/'+(fa?'':'en/')+'reception/');assert.equal(await page.locator('html').getAttribute('dir'),fa?'rtl':'ltr');await page.locator('[name=username]').fill(users[index]);await page.locator('[name=password]').fill(creds[index][0]);await page.locator('[name=otp]').fill(digits(URI.parse(creds[index][1]).generate()));await btn(page,'Sign in').click();await page.locator('summary').filter({hasText:label('Cancelled appointment payments')}).click();return page}
 const desk=await login(0),card=p=>p.locator('article').filter({hasText:ref});await btn(card(desk),'Start financial review').click();await card(desk).locator('[name=amount]').fill('400000');await btn(card(desk),'Record result as assigned reviewer').click();await card(desk).getByText(label('Proposed refund (IRR)'),{exact:false}).waitFor();assert.equal(await btn(card(desk),'Approve recommendation').count(),0);
 const finance=await login(1);await btn(finance,'Reviewed').click();await btn(card(finance),'Approve recommendation').click();await card(finance).locator('[name=amount]').fill('400000');await card(finance).locator('[name=ref]').fill(refund);await btn(card(finance),'Record completed external transfer').click();await card(finance).getByText(refund.toUpperCase(),{exact:true}).waitFor();
 await finance.locator('summary').filter({hasText:label('Compare statement entries')}).click();await finance.locator('textarea').fill(digits(refund+(fa?'،':',')+'400000'));await btn(finance,'Compare with centre receipts').click();await finance.locator('article').filter({hasText:refund.toUpperCase()}).getByText(label('Amount matches'),{exact:false}).waitFor();assert.equal((await db.query('SELECT amount_irr FROM refund_receipts WHERE quote_id=$1',[q])).rows[0].amount_irr,400000);console.log(fa?'FA':'EN','Browser PASS: separate MFA logins, review, independent approval, receipt and statement comparison');
}finally{await browser?.close();await db.query('ROLLBACK');for(const [table,col,val] of [['cancellation_requests','quote_id',q],['gateway_payments','quote_id',q],['booking_quotes','id',q],['appointment_slots','id',slot],['client_accounts','id',client]])await db.query(`DELETE FROM ${table} WHERE ${col}=$1`,[val]);await db.query('DELETE FROM staff_accounts WHERE username=ANY($1)',[users]);await db.end()}
