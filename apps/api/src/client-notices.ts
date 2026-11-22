import {DataSource} from 'typeorm';

// Read the move log itself: a rolled-back or rejected move cannot create a notice.
export function recentMoves(db:DataSource, clientId:string) {
  return db.query(`SELECT m.id, m.at, previous.starts_at AS previous_start, replacement.starts_at AS new_start
    FROM session_moves m JOIN booking_quotes q ON q.id=m.quote_id
    JOIN appointment_slots previous ON previous.id=m.from_slot
    JOIN appointment_slots replacement ON replacement.id=m.to_slot
    WHERE q.client_id=$1 ORDER BY m.id DESC LIMIT 20`, [clientId]);
}
