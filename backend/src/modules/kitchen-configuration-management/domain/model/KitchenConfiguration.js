import { ActiveConfigurationDeletionError } from '../errors/ActiveConfigurationDeletionError.js';
import { ConcurrencyConflictError } from '../errors/ConcurrencyConflictError.js';
import { ConfigurationName } from './ConfigurationName.js';
import { ConfigurationStatus } from './ConfigurationStatus.js';
import { KitchenConfigurationId } from './KitchenConfigurationId.js';
import { KitchenLayout } from './KitchenLayout.js';

const actorId = (actor) => actor ?? null;

/**
 * Aggregate root of WEB06. Guards "new = inactive", the version check of an
 * edit (BR 12) and "the active configuration cannot be deleted" (BR 10). The
 * "only one ACTIVE" rule crosses aggregates and is enforced by the service
 * transaction plus the partial unique index (BR 8, D5).
 */
export class KitchenConfiguration {
  #id;
  #name;
  #status;
  #layout;
  #version;
  #audit;

  constructor({ id, name, status, layout, version, audit }) {
    if (!(layout instanceof KitchenLayout))
      throw new TypeError('A validated KitchenLayout is required');
    if (!Object.values(ConfigurationStatus).includes(status))
      throw new TypeError('Invalid kitchen configuration status');
    if (!Number.isInteger(version) || version < 1)
      throw new TypeError('Invalid kitchen configuration version');
    this.#id = KitchenConfigurationId.create(id);
    this.#name = ConfigurationName.create(name);
    this.#status = status;
    this.#layout = layout;
    this.#version = version;
    this.#audit = { ...audit };
  }

  /** BR 7 / D4: created INACTIVE, version 1, with an ALREADY VALID layout. */
  static create(id, name, layout, actor, now = new Date()) {
    return new KitchenConfiguration({
      id,
      name,
      layout,
      status: ConfigurationStatus.INACTIVE,
      version: 1,
      audit: {
        createdAt: now,
        createdBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
        activatedAt: null,
        activatedBy: null,
      },
    });
  }

  static restore(props) {
    return new KitchenConfiguration(props);
  }

  /**
   * Replaces name and layout (status untouched). The stored version must be
   * the one the editor loaded, otherwise another user changed it (409).
   */
  edit(name, layout, expectedVersion, actor, now = new Date()) {
    if (expectedVersion !== this.#version) throw new ConcurrencyConflictError();
    if (!(layout instanceof KitchenLayout))
      throw new TypeError('A validated KitchenLayout is required');
    this.#name = ConfigurationName.create(name);
    this.#layout = layout;
    this.#version += 1;
    this.#audit.updatedAt = now;
    this.#audit.updatedBy = actorId(actor);
  }

  /** The version is not changed: an activation does not invalidate editors (D6). */
  activate(actor, now = new Date()) {
    this.#status = ConfigurationStatus.ACTIVE;
    this.#audit.activatedAt = now;
    this.#audit.activatedBy = actorId(actor);
  }

  deactivate() {
    this.#status = ConfigurationStatus.INACTIVE;
  }

  assertDeletable() {
    if (this.isActive()) throw new ActiveConfigurationDeletionError();
  }

  isActive() {
    return this.#status === ConfigurationStatus.ACTIVE;
  }

  getId() {
    return this.#id;
  }
  getName() {
    return this.#name;
  }
  getStatus() {
    return this.#status;
  }
  getLayout() {
    return this.#layout;
  }
  getVersion() {
    return this.#version;
  }
  getAudit() {
    return { ...this.#audit };
  }
}