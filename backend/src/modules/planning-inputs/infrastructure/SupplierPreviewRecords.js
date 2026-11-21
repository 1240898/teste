import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { InputError } from '../domain/InputError.js';
import { exportProducts } from '../../forecast-planning/infrastructure/catalogue.js';
import { inspectSupplierDocument } from '../../procurement-scenarios/supplierDocument.js';

const absent = () =>
  new InputError('PREVIEW_NOT_FOUND', 'Supplier preview was not found.', 404);
const expired = () =>
  new InputError(
    'PREVIEW_EXPIRED',
    'Import the document again to review a fresh preview.',
    409,
  );

export class SupplierPreviewRecords {
  constructor(database) {
    this.database = database;
  }

  async save(actor, document, withoutOffers) {
    const id = randomUUID();
    const { rows } = await this.database.query(
      `INSERT INTO planning_supplier_previews
      (id,actor_id,document,without_offers,expires_at) VALUES ($1,$2,$3,$4,now()+interval '15 minutes')
      RETURNING expires_at`,
      [id, actor, document, JSON.stringify(withoutOffers)],
    );
    return {
      previewId: id,
      expiresAt: rows[0].expires_at,
      document,
      withoutOffers,
      simulated: true,
      status: 'REVIEW',
    };
  }

  async read(actor, id) {
    const { rows } = await this.database.query(
      `SELECT p.document,p.without_offers,p.expires_at,
      p.expires_at <= now() AS expired,c.scenario_id
      FROM planning_supplier_previews p LEFT JOIN planning_confirmed_supplier_scenarios c
      ON c.scenario_id='SCEN-'||p.id::text AND c.version='1' WHERE p.actor_id=$1 AND p.id=$2`,
      [actor, id],
    );
    const row = rows[0];
    if (!row) throw absent();
    if (!row.scenario_id && row.expired) throw expired();
    return {
      previewId: id,
      expiresAt: row.expires_at,
      document: row.document,
      withoutOffers: row.without_offers,
      simulated: true,
      status: row.scenario_id ? 'CONFIRMED' : 'REVIEW',
      ...(row.scenario_id && {
        scenario: { id: row.scenario_id, version: '1' },
      }),
    };
  }

  async checkConfirmation(tx, id, actor, document) {
    const { rows } = await tx.query(
      `SELECT document,expires_at <= clock_timestamp() AS expired
      FROM planning_supplier_previews WHERE id=$1 AND actor_id=$2 FOR UPDATE`,
      [id, actor],
    );
    if (!rows.length) throw absent();
    if (rows[0].expired) throw expired();
    if (!isDeepStrictEqual(rows[0].document, document))
      throw new InputError(
        'PREVIEW_CHANGED',
        'Review the supplier document again.',
        409,
      );
    inspectSupplierDocument(document, await exportProducts(tx));
  }

  async list() {
    const { rows } = await this.database
      .query(`SELECT scenario_id AS id,version,confirmed_at AS "confirmedAt"
      FROM planning_confirmed_supplier_scenarios ORDER BY confirmed_at DESC,scenario_id,version`);
    return { items: rows };
  }
}
