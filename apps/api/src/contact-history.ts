import { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing rows have a known current state, not a reconstructible past. */
export class ContactHistory1795046400002 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE contact_status_events (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      request_id uuid NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE,
      kind text NOT NULL CHECK(kind IN ('created','baseline','changed')),
      previous text, status text NOT NULL, at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query('CREATE INDEX contact_event_order ON contact_status_events(request_id,id DESC)');
    await q.query(`INSERT INTO contact_status_events(request_id,kind,status) SELECT id,'baseline',status FROM contact_requests`);
    await q.query(`CREATE FUNCTION record_contact_status() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO contact_status_events(request_id,kind,status) VALUES(NEW.id,'created',NEW.status);
        ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
          INSERT INTO contact_status_events(request_id,kind,previous,status) VALUES(NEW.id,'changed',OLD.status,NEW.status);
        END IF;
        RETURN NEW;
      END; $$`);
    await q.query(`CREATE TRIGGER track_contact_status AFTER INSERT OR UPDATE OF status ON contact_requests FOR EACH ROW EXECUTE FUNCTION record_contact_status()`);
  }
  async down(q: QueryRunner) {
    await q.query('DROP TRIGGER track_contact_status ON contact_requests');
    await q.query('DROP FUNCTION record_contact_status()');
    await q.query('DROP TABLE contact_status_events');
  }
}
