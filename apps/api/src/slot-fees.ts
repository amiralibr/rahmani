import {MigrationInterface,QueryRunner} from 'typeorm';

/** IRR throughout; old listings have an unknown price, not a zero price. */
export class SlotFees1795046400008 implements MigrationInterface {
 async up(q:QueryRunner){await q.query('ALTER TABLE appointment_slots ADD COLUMN fee_irr integer CHECK(fee_irr BETWEEN 1 AND 2000000000)');}
 async down(q:QueryRunner){await q.query('ALTER TABLE appointment_slots DROP COLUMN fee_irr');}
}
