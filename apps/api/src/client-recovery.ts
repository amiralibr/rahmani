import {MigrationInterface,QueryRunner} from 'typeorm';
export class ClientRecovery1795046400010 implements MigrationInterface {
 async up(q:QueryRunner){await q.query('ALTER TABLE client_accounts ADD COLUMN recovery_hash text');}
 async down(q:QueryRunner){await q.query('ALTER TABLE client_accounts DROP COLUMN recovery_hash');}
}
