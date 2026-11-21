import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { InputError } from '../../planning-inputs/domain/InputError.js';
import { validateForecast } from '../domain/forecast.js';
import { forecastOptions } from './catalogue.js';

const current = `FROM consumption_forecasts f JOIN consumption_forecast_versions v
  ON v.forecast_id=f.id AND v.version=f.current_version WHERE NOT f.archived`;
const missing = () =>
  new InputError('FORECAST_NOT_FOUND', 'Forecast was not found.', 404);
const stale = () =>
  new InputError(
    'STALE_VERSION',
    'Reload this forecast before saving changes.',
    409,
    'version',
  );

export class ForecastRepository {
  constructor(database) {
    this.database = database;
  }

  async list() {
    const { rows } = await this.database
      .query(`SELECT f.id, v.version::text, v.document->>'name' AS name
      ${current} ORDER BY name, f.id`);
    return rows;
  }

  async get(id) {
    const { rows } = await this.database.query(
      `SELECT f.id, v.version::text, v.document ${current} AND f.id=$1`,
      [id],
    );
    if (!rows.length) throw missing();
    return { id, version: rows[0].version, ...rows[0].document };
  }

  create(actor, requestId, document) {
    return this.database.withTransaction(async (tx) => {
      // Serialize only retries of this actor's request, including its first insertion.
      await tx.query(
        'SELECT pg_advisory_xact_lock(hashtextextended(jsonb_build_array($1::text,$2::uuid)::text, 0))',
        [actor, requestId],
      );
      const { rows } = await tx.query(
        `SELECT r.forecast_id, v.document FROM forecast_creation_receipts r
        JOIN consumption_forecast_versions v ON v.forecast_id=r.forecast_id AND v.version=1
        WHERE r.actor_id=$1 AND r.request_id=$2`,
        [actor, requestId],
      );
      if (rows.length) {
        if (!isDeepStrictEqual(rows[0].document, document))
          throw new InputError(
            'FORECAST_CREATION_CONFLICT',
            'This creation request already has a different forecast.',
            409,
          );
        return { id: rows[0].forecast_id, version: '1' };
      }
      validateForecast(document, await forecastOptions(tx));
      const id = 'FCST-' + randomUUID();
      await tx.query('INSERT INTO consumption_forecasts(id) VALUES ($1)', [id]);
      await tx.query(
        'INSERT INTO consumption_forecast_versions VALUES ($1,1,$2)',
        [id, document],
      );
      await tx.query(
        'INSERT INTO forecast_creation_receipts VALUES ($1,$2,$3)',
        [actor, requestId, id],
      );
      return { id, version: '1' };
    });
  }

  change(id, version, document, archive = false) {
    return this.database.withTransaction(async (tx) => {
      const { rows } = await tx.query(
        'SELECT current_version FROM consumption_forecasts WHERE id=$1 AND NOT archived FOR UPDATE',
        [id],
      );
      if (!rows.length) throw missing();
      if (String(rows[0].current_version) !== version) throw stale();
      if (archive) {
        await tx.query(
          'UPDATE consumption_forecasts SET archived=true WHERE id=$1',
          [id],
        );
        return;
      }
      validateForecast(document, await forecastOptions(tx));
      const next = rows[0].current_version + 1;
      await tx.query(
        'INSERT INTO consumption_forecast_versions VALUES ($1,$2,$3)',
        [id, next, document],
      );
      await tx.query(
        'UPDATE consumption_forecasts SET current_version=$2 WHERE id=$1',
        [id, next],
      );
      return { id, version: String(next) };
    });
  }

  // AI06 supplies the pinned transaction used for its current catalogue and stock.
  async read({ type, id, version }, tx) {
    if (type !== 'forecast') return null;
    const { rows } = await (tx ?? this.database).query(
      'SELECT document FROM consumption_forecast_versions WHERE forecast_id=$1 AND version::text=$2',
      [id, version],
    );
    if (!rows.length) return null;
    const options = await forecastOptions(tx ?? this.database);
    const { startDate, endDate, entries } = validateForecast(
      rows[0].document,
      options,
    );
    const pizzas = new Set(
      options.filter((p) => p.isPizza).map((p) => p.productId),
    );
    return {
      forecast: { id, version, startDate, endDate },
      demandLines: entries.map((line) => ({
        ...line,
        type: pizzas.has(line.productId) ? 'pizza' : 'directSale',
      })),
    };
  }
}
