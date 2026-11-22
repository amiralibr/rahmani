import {DataSource} from 'typeorm';

/** Operational counts only. Quotes and holds are not revenue or confirmed visits. */
export async function receptionReport(db:DataSource){
 const [row]=await db.query(`WITH calendar AS (
   SELECT (now() AT TIME ZONE 'Asia/Tehran')::date-i AS day FROM generate_series(0,6) i
 ), daily AS (
   SELECT c.day,
    (SELECT count(*)::int FROM contact_requests WHERE created_at>=c.day::timestamp AT TIME ZONE 'Asia/Tehran' AND created_at<(c.day+1)::timestamp AT TIME ZONE 'Asia/Tehran') AS requests,
    (SELECT count(*)::int FROM booking_quotes WHERE issued_at>=c.day::timestamp AT TIME ZONE 'Asia/Tehran' AND issued_at<(c.day+1)::timestamp AT TIME ZONE 'Asia/Tehran') AS quotes
   FROM calendar c
 ) SELECT now() AS as_of,
 (SELECT count(*)::int FROM contact_requests WHERE status='new') AS fresh,
 (SELECT count(*)::int FROM contact_requests WHERE status='in_progress') AS following,
 (SELECT count(*)::int FROM appointment_slots WHERE confirmed_quote IS NULL AND NOT withdrawn AND starts_at>now() AND (hold_until IS NULL OR hold_until<=now())) AS available,
 (SELECT count(*)::int FROM appointment_slots WHERE confirmed_quote IS NULL AND NOT withdrawn AND starts_at>now() AND hold_until>now()) AS held,
 (SELECT json_agg(d ORDER BY day) FROM daily d) AS days`);
 return row;
}
