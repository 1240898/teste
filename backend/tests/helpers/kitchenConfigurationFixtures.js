import { readFileSync } from 'node:fs';
import { KitchenAsset } from '../../src/modules/kitchen-configuration-management/domain/model/KitchenAsset.js';
import { KitchenConfigurationRowMapper } from '../../src/modules/kitchen-configuration-management/infrastructure/persistence/KitchenConfigurationRowMapper.js';
import { KitchenConfigurationId } from '../../src/modules/kitchen-configuration-management/domain/model/KitchenConfigurationId.js';

const samples = new URL(
  '../../../docs/user_stories/web06/samples/',
  import.meta.url,
);

/** Sample layouts of usWEB06 (AC 10): compact, extended, invalid. */
export function sample(name) {
  return JSON.parse(
    readFileSync(new URL(`kitchen-${name}.json`, samples), 'utf8'),
  );
}

const model = (id, path, size, embeddedTextureSet = true) =>
  new KitchenAsset({
    id,
    kind: 'MODEL',
    format: 'glb',
    path,
    size,
    embeddedTextureSet,
  });
const texture = (id, path) =>
  new KitchenAsset({ id, kind: 'TEXTURE', format: 'png', path });

/** Same entries and sizes as backend/assets/kitchen/manifest.json. */
export const CATALOGUE = Object.freeze([
  model('AST-MDL-DISPENSER-01', 'models/dispenser-01.glb', {
    x: 0.6,
    y: 0.8,
    z: 0.6,
  }),
  model('AST-MDL-CONVEYOR-01', 'models/conveyor-01.glb', {
    x: 1,
    y: 0.1,
    z: 0.6,
  }),
  model('AST-MDL-ROBOT-ARM-01', 'models/robot-arm-01.glb', {
    x: 0.4,
    y: 1.2,
    z: 0.4,
  }),
  // WEB06 placeholders with their texture set, kept for existing layouts.
  model('AST-MDL-OVEN-DOME-01', 'models/oven-dome-01.glb', {
    x: 1.8,
    y: 1.6,
    z: 1.8,
  }),
  model('AST-MDL-FRIDGE-01', 'models/fridge-01.glb', { x: 0.9, y: 2, z: 0.8 }),
  // VIS02 equipment models (scripts/kitchen-models): no embedded textures.
  ...[
    ['OVEN-DOME-02', { x: 1.8, y: 1.6, z: 1.8 }],
    ['FRIDGE-02', { x: 0.9, y: 2, z: 0.8 }],
    ['TABLE-PLAIN-01', { x: 1.6, y: 0.9, z: 0.8 }],
    ['COUNTER-01', { x: 2.4, y: 0.9, z: 0.7 }],
    ['DEEP-FRYER-01', { x: 0.5, y: 0.9, z: 0.7 }],
    ['GRIDDLE-01', { x: 0.9, y: 0.9, z: 0.7 }],
    ['GRILL-01', { x: 0.8, y: 0.9, z: 0.7 }],
    ['DISHWASHER-01', { x: 0.6, y: 0.85, z: 0.6 }],
    ['EXHAUST-HOOD-01', { x: 1.3, y: 0.6, z: 1 }],
    ['PIZZA-PEEL-01', { x: 0.35, y: 0.03, z: 0.9 }],
    ['PAN-01', { x: 0.55, y: 0.06, z: 0.3 }],
    ['POT-01', { x: 0.38, y: 0.25, z: 0.3 }],
  ].map(([name, size]) =>
    model(`AST-MDL-${name}`, `models/${name.toLowerCase()}.glb`, size, false),
  ),
  ...[
    'TILES-COLOR',
    'TILES-NORMAL',
    'PLASTER-COLOR',
    'PLASTER-ROUGH',
    'STEEL-COLOR',
    'STEEL-ROUGH',
    'STEEL-NORMAL',
    'WOOD-COLOR',
    'WOOD-NORMAL',
  ].map((name) =>
    texture(`AST-TEX-${name}`, `textures/${name.toLowerCase()}.png`),
  ),
]);

/** Validator context: Map<id, { asset, fileAvailable }>. */
export function assetContext(missingFiles = []) {
  return new Map(
    CATALOGUE.map((asset) => [
      asset.id,
      { asset, fileAvailable: !missingFiles.includes(asset.path) },
    ]),
  );
}

export class MemoryKitchenAssetCatalogue {
  constructor(assets = CATALOGUE) {
    this.assets = new Map(assets.map((asset) => [asset.id, asset]));
  }
  async findByIds(ids) {
    return new Map(
      ids
        .filter((id) => this.assets.has(id))
        .map((id) => [id, this.assets.get(id)]),
    );
  }
  async findAll() {
    return [...this.assets.values()];
  }
}

export class MemoryKitchenAssetFileStore {
  missing = new Set();
  async exists(path) {
    return !this.missing.has(path);
  }
}

/**
 * In-memory IKitchenConfigurationRepository storing PostgreSQL-like rows, so
 * every read returns a fresh aggregate (as the real adapter does).
 */
export class MemoryKitchenConfigurationRepository {
  rows = new Map();
  sequence = 0;
  calls = [];

  #row(configuration) {
    const audit = configuration.getAudit();
    return {
      id: configuration.getId().getValue(),
      name: configuration.getName().getValue(),
      status: configuration.getStatus(),
      version: configuration.getVersion(),
      content: configuration.getLayout().toJSON(),
      element_count: configuration.getLayout().elementCount,
      created_at: audit.createdAt,
      created_by: audit.createdBy,
      updated_at: audit.updatedAt,
      updated_by: audit.updatedBy,
      activated_at: audit.activatedAt,
      activated_by: audit.activatedBy,
    };
  }
  #load(row) {
    return row
      ? KitchenConfigurationRowMapper.toDomain(structuredClone(row))
      : null;
  }
  async nextId() {
    this.calls.push('nextId');
    this.sequence += 1;
    return KitchenConfigurationId.create(
      `KCF-${String(this.sequence).padStart(5, '0')}`,
    );
  }
  async findAllSummaries() {
    return [...this.rows.values()]
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((row) => KitchenConfigurationRowMapper.toSummary(row));
  }
  async findById(id) {
    return this.#load(this.rows.get(id.getValue()));
  }
  async findByIdForUpdate(id) {
    return this.findById(id);
  }
  async findActive() {
    return this.#load(
      [...this.rows.values()].find((row) => row.status === 'ACTIVE'),
    );
  }
  async existsByName(name, excludeId) {
    return [...this.rows.values()].some(
      (row) =>
        row.name.toLowerCase() === name.getKey() &&
        row.id !== excludeId?.getValue(),
    );
  }
  async insert(configuration) {
    this.calls.push('insert');
    this.rows.set(configuration.getId().getValue(), this.#row(configuration));
  }
  async replace(configuration, expectedVersion) {
    const current = this.rows.get(configuration.getId().getValue());
    if (!current || current.version !== expectedVersion) return false;
    this.rows.set(current.id, {
      ...this.#row(configuration),
      status: current.status,
    });
    return true;
  }
  async lockActivation() {
    this.calls.push('lockActivation');
  }
  async deactivateCurrent(exceptId) {
    this.calls.push('deactivateCurrent');
    const active = [...this.rows.values()].find(
      (row) => row.status === 'ACTIVE' && row.id !== exceptId.getValue(),
    );
    if (!active) return null;
    active.status = 'INACTIVE';
    return KitchenConfigurationId.create(active.id);
  }
  async markActive(configuration) {
    this.calls.push('markActive');
    if (this.failOnMarkActive) throw new Error('simulated failure');
    const row = this.rows.get(configuration.getId().getValue());
    if (!row) return false;
    Object.assign(row, {
      status: 'ACTIVE',
      activated_at: configuration.getAudit().activatedAt,
      activated_by: configuration.getAudit().activatedBy,
    });
    return true;
  }
  async deleteIfInactive(id) {
    const row = this.rows.get(id.getValue());
    if (!row || row.status !== 'INACTIVE') return false;
    return this.rows.delete(id.getValue());
  }
}

/** Snapshot / restore of the repository rows (simulated ROLLBACK). */
export class MemoryKitchenUnitOfWork {
  transactions = 0;
  constructor(repository) {
    this.repository = repository;
  }
  async withTransaction(work) {
    const snapshot = structuredClone([...this.repository.rows]);
    this.transactions += 1;
    try {
      return await work({ id: this.transactions });
    } catch (error) {
      this.repository.rows = new Map(snapshot);
      throw error;
    }
  }
}