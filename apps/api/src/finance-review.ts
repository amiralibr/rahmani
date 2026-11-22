import {ConflictException} from '@nestjs/common';
import {DataSource,MigrationInterface,QueryRunner} from 'typeorm';

export class FinanceReview1795046400017 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE cancellation_reviews(quote_id uuid PRIMARY KEY REFERENCES cancellation_requests(quote_id) ON DELETE CASCADE, staff_id uuid NOT NULL REFERENCES staff_accounts(id), started_at timestamptz NOT NULL DEFAULT now())`)}
 async down(q:QueryRunner){await q.query('DROP TABLE cancellation_reviews')}
}
const eligible=`FROM cancellation_requests c JOIN gateway_payments p ON p.quote_id=c.quote_id AND p.state='confirmed' JOIN booking_quotes q ON q.id=c.quote_id`;
export async function financialCases(db:DataSource,started:boolean,page:number,finished=false,actor:string|null=null){
 const rows=await db.query(`SELECT receipt.reference AS refund_reference,c.quote_id,c.decided_at,p.reference,q.amount_irr,r.refund_decision,EXISTS(SELECT 1 FROM staff_accounts f WHERE f.id=$4 AND f.active AND f.role='reception' AND f.refund_approver AND f.id<>r.staff_id) AS may_decide,r.started_at,r.proposed_irr,a.username AS operator ${eligible} LEFT JOIN cancellation_reviews r ON r.quote_id=c.quote_id LEFT JOIN refund_receipts receipt ON receipt.quote_id=c.quote_id LEFT JOIN staff_accounts a ON a.id=r.staff_id WHERE c.decision='approved' AND (r.quote_id IS NOT NULL)=$1 AND (r.proposed_irr IS NOT NULL)=$3 ORDER BY c.decided_at,c.quote_id LIMIT 21 OFFSET $2`,[started,page*20,finished,actor]);return {items:rows.slice(0,20),more:rows.length>20};
}
export async function startReview(db:DataSource,quote:string,staff:string){
 const rows=await db.query(`WITH inserted AS (INSERT INTO cancellation_reviews(quote_id,staff_id) SELECT c.quote_id,$2 ${eligible} WHERE c.decision='approved' AND c.quote_id=$1 ON CONFLICT DO NOTHING RETURNING quote_id) SELECT * FROM inserted`,[quote,staff]);if(!rows.length)throw new ConflictException();return {ok:true};
}

export class FinanceOutcome1795046400018 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`ALTER TABLE cancellation_reviews ADD proposed_irr integer CHECK(proposed_irr>=0), ADD finished_at timestamptz, ADD CHECK ((finished_at IS NULL)=(proposed_irr IS NULL))`)}
 async down(q:QueryRunner){await q.query('ALTER TABLE cancellation_reviews DROP proposed_irr,DROP finished_at')}
}
// A recommendation by the assigned reviewer, never a payment instruction.
export async function finishReview(db:DataSource,quote:string,staff:string,amount:number){
 const rows=await db.query(`WITH u AS (UPDATE cancellation_reviews r SET proposed_irr=$3,finished_at=now() FROM booking_quotes q WHERE r.quote_id=$1 AND q.id=r.quote_id AND r.staff_id=$2 AND r.finished_at IS NULL AND $3 BETWEEN 0 AND q.amount_irr RETURNING r.quote_id) SELECT * FROM u`,[quote,staff,amount]);if(!rows.length)throw new ConflictException();return {ok:true};
}

export class RefundAuthority1795046400019 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`ALTER TABLE staff_accounts ADD refund_approver boolean NOT NULL DEFAULT false`);await q.query(`ALTER TABLE cancellation_reviews ADD refund_decision text CHECK(refund_decision IN ('approved','rejected')), ADD authorized_by uuid REFERENCES staff_accounts(id), ADD authorized_at timestamptz, ADD CHECK((refund_decision IS NULL)=(authorized_at IS NULL) AND (refund_decision IS NULL)=(authorized_by IS NULL) AND (refund_decision IS NULL OR (finished_at IS NOT NULL AND authorized_by<>staff_id)))`)}
 async down(q:QueryRunner){await q.query('ALTER TABLE cancellation_reviews DROP refund_decision,DROP authorized_by,DROP authorized_at');await q.query('ALTER TABLE staff_accounts DROP refund_approver')}
}
export async function authorizeRecommendation(db:DataSource,quote:string,staff:string,decision:'approved'|'rejected'){
 const rows=await db.query(`WITH u AS (UPDATE cancellation_reviews r SET refund_decision=$3,authorized_by=a.id,authorized_at=now() FROM staff_accounts a WHERE a.id=$2 AND a.active AND a.role='reception' AND a.refund_approver AND a.id<>r.staff_id AND r.quote_id=$1 AND r.finished_at IS NOT NULL AND r.refund_decision IS NULL RETURNING quote_id) SELECT * FROM u`,[quote,staff,decision]);if(!rows.length)throw new ConflictException();return {ok:true};
}

export class RefundReceipt1795046400020 implements MigrationInterface {
 async up(q:QueryRunner){await q.query(`CREATE TABLE refund_receipts(quote_id uuid PRIMARY KEY REFERENCES cancellation_reviews(quote_id) ON DELETE CASCADE, reference text UNIQUE NOT NULL CHECK(reference ~ '^[A-Z0-9-]{4,64}$'), amount_irr integer NOT NULL CHECK(amount_irr>0), recorded_by uuid NOT NULL REFERENCES staff_accounts(id), recorded_at timestamptz NOT NULL DEFAULT now())`)}
 async down(q:QueryRunner){await q.query('DROP TABLE refund_receipts')}
}
// Records staff attestation of an external transfer, not bank verification.
export async function recordReceipt(db:DataSource,quote:string,staff:string,amount:number,reference:string){
 const rows=await db.query(`WITH u AS (INSERT INTO refund_receipts(quote_id,reference,amount_irr,recorded_by)
 SELECT r.quote_id,upper($4),r.proposed_irr,a.id FROM cancellation_reviews r JOIN staff_accounts a ON a.id=$2
 WHERE r.quote_id=$1 AND a.active AND a.role='reception' AND a.refund_approver AND a.id<>r.staff_id AND r.refund_decision='approved' AND r.proposed_irr=$3 AND r.proposed_irr>0
 ON CONFLICT DO NOTHING RETURNING quote_id) SELECT * FROM u`,[quote,staff,amount,reference]);if(!rows.length)throw new ConflictException();return {ok:true};
}
