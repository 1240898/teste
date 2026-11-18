import { randomUUID } from 'node:crypto';
import { normalizeRoles } from './values.js';

export class RoleChangeRecord {
  constructor({
    id = randomUUID(),
    userId,
    changedAt = new Date(),
    previousRoles,
    newRoles,
    actor,
  }) {
    if (
      !userId ||
      !(changedAt instanceof Date) ||
      !Number.isFinite(changedAt.getTime())
    )
      throw new Error('Invalid role change record');
    if (!actor || !['ADMINISTRATOR', 'SYSTEM_PROCESS'].includes(actor.type))
      throw new Error('Invalid role change actor');
    if (
      actor.type === 'ADMINISTRATOR'
        ? !actor.userId || actor.systemProcess
        : !actor.systemProcess || actor.userId
    )
      throw new Error('Invalid role change actor');
    this.id = id;
    this.userId = userId;
    this.changedAt = new Date(changedAt);
    this.previousRoles = normalizeRoles(previousRoles);
    this.newRoles = normalizeRoles(newRoles);
    this.actor = Object.freeze({ ...actor });
    Object.freeze(this.previousRoles);
    Object.freeze(this.newRoles);
    Object.freeze(this);
  }
}
