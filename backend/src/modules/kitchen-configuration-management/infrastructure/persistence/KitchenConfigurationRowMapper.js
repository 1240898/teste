import { KitchenConfiguration } from '../../domain/model/KitchenConfiguration.js';
import { KitchenLayout } from '../../domain/model/KitchenLayout.js';

const date = (value) => (value ? new Date(value) : null);

/** SQL row mapping only. HTTP response mapping lives in the application layer. */
export class KitchenConfigurationRowMapper {
  static toDomain(row) {
    return KitchenConfiguration.restore({
      id: row.id,
      name: row.name,
      status: row.status,
      version: Number(row.version),
      layout: KitchenLayout.restore(row.content),
      audit: {
        createdAt: date(row.created_at),
        createdBy: row.created_by ?? null,
        updatedAt: date(row.updated_at),
        updatedBy: row.updated_by ?? null,
        activatedAt: date(row.activated_at),
        activatedBy: row.activated_by ?? null,
      },
    });
  }

  static toSummary(row) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      version: Number(row.version),
      elementCount: Number(row.element_count),
      updatedAt: date(row.updated_at),
      activatedAt: date(row.activated_at),
    };
  }

  /** Parameters of INSERT ... VALUES ($1 ... $8). */
  static toParams(configuration) {
    const audit = configuration.getAudit();
    const layout = configuration.getLayout();
    return [
      configuration.getId().getValue(),
      configuration.getName().getValue(),
      configuration.getStatus(),
      configuration.getVersion(),
      JSON.stringify(layout.toJSON()),
      layout.elementCount,
      audit.createdAt,
      audit.createdBy,
    ];
  }
}