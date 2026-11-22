import {DataSource} from 'typeorm';

// One snapshot for totals and paged detail. Receipts attest only to staff records.
export async function refundReport(db:DataSource,category:string,page:number,actor:string|null=null){
 const [report]=await db.query(`WITH cases AS (
 SELECT x.reference AS document_ref,x.amount_irr AS document_amount,x.id::text AS reply,x.closed_at,EXISTS(SELECT 1 FROM staff_accounts u WHERE u.id=$3 AND u.active AND u.refund_approver AND u.role='reception' AND u.id<>i.owner_id) AS may_close,a.username AS owner,i.outcome,i.owner_id=$3 AS mine,r.quote_id,r.authorized_at,r.proposed_irr,p.reference AS payment_reference,
        b.reference AS refund_reference,b.amount_irr AS recorded_irr,
        CASE WHEN x.closed_at IS NOT NULL THEN 'closed' WHEN b.quote_id IS NULL THEN 'missing' WHEN b.amount_irr<>r.proposed_irr THEN 'mismatch' ELSE 'recorded' END AS category
 FROM cancellation_reviews r JOIN gateway_payments p USING (quote_id) LEFT JOIN refund_receipts b USING (quote_id) LEFT JOIN refund_inquiries i USING(quote_id) LEFT JOIN LATERAL (SELECT * FROM inquiry_replies WHERE quote_id=r.quote_id ORDER BY id DESC LIMIT 1)x ON true LEFT JOIN staff_accounts a ON a.id=i.owner_id
 WHERE r.refund_decision='approved' AND r.proposed_irr>0 AND p.state='confirmed'
 ), detail AS (SELECT * FROM cases WHERE category=$1 ORDER BY authorized_at,quote_id LIMIT 20 OFFSET $2)
 SELECT (SELECT coalesce(json_agg(g),'[]'::json) FROM (SELECT category,count(*)::int AS count,sum(proposed_irr)::text AS approved,sum(coalesce(recorded_irr,0))::text AS recorded FROM cases GROUP BY category) g) AS totals,
 (SELECT coalesce(json_agg(d ORDER BY authorized_at,quote_id),'[]'::json) FROM detail d) AS items`,[category,page*20,actor]);return report;
}
