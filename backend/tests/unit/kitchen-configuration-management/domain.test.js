import { ConfigurationName } from '../../../src/modules/kitchen-configuration-management/domain/model/ConfigurationName.js';
import { KitchenConfiguration } from '../../../src/modules/kitchen-configuration-management/domain/model/KitchenConfiguration.js';
import { KitchenConfigurationId } from '../../../src/modules/kitchen-configuration-management/domain/model/KitchenConfigurationId.js';
import { KitchenLayout } from '../../../src/modules/kitchen-configuration-management/domain/model/KitchenLayout.js';
import { ActiveConfigurationDeletionError } from '../../../src/modules/kitchen-configuration-management/domain/errors/ActiveConfigurationDeletionError.js';
import { ConcurrencyConflictError } from '../../../src/modules/kitchen-configuration-management/domain/errors/ConcurrencyConflictError.js';
import { sample } from '../../helpers/kitchenConfigurationFixtures.js';

const layout = () => KitchenLayout.fromValidated(sample('compact'));
const now = new Date('2026-11-12T10:15:00.000Z');

describe('WEB06 KitchenConfiguration (UT08)', () => {
  test('create: INACTIVE, version 1', () => {
    const configuration = KitchenConfiguration.create(
      'KCF-00001',
      'Compact kitchen',
      layout(),
      'USR-00001',
      now,
    );
    expect(configuration.getStatus()).toBe('INACTIVE');
    expect(configuration.getVersion()).toBe(1);
    expect(configuration.getAudit()).toMatchObject({
      createdAt: now,
      createdBy: 'USR-00001',
      activatedAt: null,
    });
  });

  test('edit with the loaded version increments it; another version is a conflict', () => {
    const configuration = KitchenConfiguration.create(
      'KCF-00001',
      'Compact kitchen',
      layout(),
      null,
      now,
    );
    configuration.edit('Kitchen B', layout(), 1, 'USR-00002', now);
    expect(configuration.getVersion()).toBe(2);
    expect(configuration.getName().getValue()).toBe('Kitchen B');
    expect(() =>
      configuration.edit('Kitchen C', layout(), 1, null, now),
    ).toThrow(ConcurrencyConflictError);
    expect(configuration.getName().getValue()).toBe('Kitchen B');
  });

  test('activate / deactivate change only the status; the active one is not deletable', () => {
    const configuration = KitchenConfiguration.create(
      'KCF-00001',
      'Compact kitchen',
      layout(),
      null,
      now,
    );
    configuration.assertDeletable();
    configuration.activate('USR-00001', now);
    expect(configuration.isActive()).toBe(true);
    expect(configuration.getVersion()).toBe(1);
    expect(() => configuration.assertDeletable()).toThrow(
      ActiveConfigurationDeletionError,
    );
    configuration.deactivate();
    expect(configuration.getStatus()).toBe('INACTIVE');
  });

  test('the layout is immutable and returned as a copy', () => {
    const value = layout();
    expect(Object.isFrozen(value.elements[0])).toBe(true);
    const copy = value.toJSON();
    copy.elements = [];
    expect(value.elementCount).toBe(14);
    expect(value.referencedAssetIds()).toEqual(
      expect.arrayContaining(['AST-MDL-OVEN-DOME-02', 'AST-TEX-TILES-COLOR']),
    );
  });
});

describe('WEB06 ConfigurationName / KitchenConfigurationId (UT09)', () => {
  test('trims and builds the case-insensitive key', () => {
    const name = ConfigurationName.create('  Kitchen A ');
    expect(name.getValue()).toBe('Kitchen A');
    expect(name.getKey()).toBe('kitchen a');
  });
  test.each(['ab', '   ', 'x'.repeat(81), 42])('rejects %p', (value) => {
    expect(() => ConfigurationName.create(value)).toThrow(/between 3 and 80/);
  });
  test('identifier format KCF- + at least 5 digits', () => {
    expect(KitchenConfigurationId.create('kcf-00002').getValue()).toBe(
      'KCF-00002',
    );
    expect(() => KitchenConfigurationId.create('KCF-12')).toThrow(
      'Invalid kitchen configuration id',
    );
  });
});