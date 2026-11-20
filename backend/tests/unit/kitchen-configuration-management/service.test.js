import { jest } from '@jest/globals';
import { KitchenConfigurationService } from '../../../src/modules/kitchen-configuration-management/application/services/KitchenConfigurationService.js';
import {
  MemoryKitchenAssetCatalogue,
  MemoryKitchenAssetFileStore,
  MemoryKitchenConfigurationRepository,
  MemoryKitchenUnitOfWork,
  sample,
} from '../../helpers/kitchenConfigurationFixtures.js';

const manager = { sub: 'USR-00001', roles: ['MANAGER'] };
let repository, files, unitOfWork, service;

beforeEach(() => {
  repository = new MemoryKitchenConfigurationRepository();
  files = new MemoryKitchenAssetFileStore();
  unitOfWork = new MemoryKitchenUnitOfWork(repository);
  service = new KitchenConfigurationService({
    repository,
    assetCatalogue: new MemoryKitchenAssetCatalogue(),
    assetFiles: files,
    unitOfWork,
    assetUrl: (asset) =>
      `http://localhost:8080/api/v1/kitchen-assets/files/${asset.path}`,
    clock: () => new Date('2026-11-12T10:15:00.000Z'),
  });
});

const create = (name, content = sample('compact')) =>
  service.createConfiguration({ name, content }, manager);
const statuses = () =>
  Object.fromEntries(
    [...repository.rows.values()].map((row) => [row.id, row.status]),
  );

describe('WEB06 KitchenConfigurationService', () => {
  test('creates a valid configuration INACTIVE with version 1', async () => {
    const created = await create('  Compact kitchen ');
    expect(created).toMatchObject({
      id: 'KCF-00001',
      name: 'Compact kitchen',
      status: 'INACTIVE',
      version: 1,
      activatedAt: null,
    });
    expect(created.content).toEqual(sample('compact'));
  });

  test('UT11 - invalid content: no transaction, no id, no insert', async () => {
    const spy = jest.spyOn(unitOfWork, 'withTransaction');
    await expect(create('Broken', sample('invalid'))).rejects.toMatchObject({
      status: 422,
      details: expect.arrayContaining([
        expect.objectContaining({ code: 'LINE_COMPOSITION' }),
      ]),
    });
    expect(spy).not.toHaveBeenCalled();
    expect(repository.calls).not.toContain('nextId');
    expect(repository.calls).not.toContain('insert');
  });

  test('duplicate name (case-insensitive) is a 409', async () => {
    await create('Compact kitchen');
    await expect(create('COMPACT KITCHEN')).rejects.toMatchObject({
      status: 409,
    });
  });

  test('UT12 - an invalid edit of the active configuration keeps the stored one', async () => {
    const { id } = await create('Compact kitchen');
    await service.activateConfiguration(id, manager);
    await expect(
      service.updateConfiguration(
        id,
        { name: 'Compact kitchen', content: sample('invalid'), version: 1 },
        manager,
      ),
    ).rejects.toMatchObject({ status: 422 });
    const stored = await service.getConfiguration(id);
    expect(stored).toMatchObject({ version: 1, status: 'ACTIVE' });
    expect(stored.content).toEqual(sample('compact'));
  });

  test('a valid edit increments the version and keeps the status; a stale one is a 409', async () => {
    const { id } = await create('Compact kitchen');
    await service.activateConfiguration(id, manager);
    const edited = await service.updateConfiguration(
      id,
      { name: 'Kitchen B', content: sample('extended'), version: 1 },
      manager,
    );
    expect(edited).toMatchObject({
      name: 'Kitchen B',
      version: 2,
      status: 'ACTIVE',
    });
    await expect(
      service.updateConfiguration(
        id,
        { name: 'Kitchen C', content: sample('compact'), version: 1 },
        manager,
      ),
    ).rejects.toMatchObject({
      status: 409,
      message:
        'This kitchen configuration was changed by another user. Reload it before saving.',
    });
    expect((await service.getConfiguration(id)).name).toBe('Kitchen B');
  });

  test('UT13 - a failure after the first status update rolls both back', async () => {
    const first = await create('Compact kitchen');
    const second = await create('Extended kitchen', sample('extended'));
    await service.activateConfiguration(first.id, manager);
    repository.failOnMarkActive = true;
    await expect(
      service.activateConfiguration(second.id, manager),
    ).rejects.toThrow('simulated failure');
    expect(statuses()).toEqual({
      [first.id]: 'ACTIVE',
      [second.id]: 'INACTIVE',
    });
  });

  test('UT14 - first activation and idempotent activation of the active one', async () => {
    const first = await create('Compact kitchen');
    const second = await create('Extended kitchen', sample('extended'));
    const activation = await service.activateConfiguration(first.id, manager);
    expect(activation).toMatchObject({
      activeConfiguration: { id: first.id, status: 'ACTIVE' },
      previousActiveConfigurationId: null,
    });
    repository.calls = [];
    const again = await service.activateConfiguration(first.id, manager);
    expect(again.activeConfiguration.status).toBe('ACTIVE');
    expect(repository.calls).toEqual(['lockActivation']);
    const switched = await service.activateConfiguration(second.id, manager);
    expect(switched.previousActiveConfigurationId).toBe(first.id);
    expect(statuses()).toEqual({
      [first.id]: 'INACTIVE',
      [second.id]: 'ACTIVE',
    });
  });

    test('UT15 - active configuration: 404 NO_ACTIVE_CONFIGURATION when none; only the referenced assets otherwise', async () => {
    await expect(service.getActiveConfiguration()).rejects.toMatchObject({
      status: 404,
      message: 'No active kitchen configuration',
      details: [
        {
          path: '',
          code: 'NO_ACTIVE_CONFIGURATION',
          message: 'No active kitchen configuration',
        },
      ],
    });
    const content = sample('compact');
    const { id } = await create('Compact kitchen', content);
    await service.activateConfiguration(id, manager);
    const active = await service.getActiveConfiguration();
    expect(active).toMatchObject({ id, status: 'ACTIVE', version: 1, content });
    expect(Object.keys(active.assets).sort()).toEqual(
      [
        'AST-MDL-CONVEYOR-02',
        'AST-MDL-COUNTER-01',
        'AST-MDL-DISPENSER-02',
        'AST-MDL-EXHAUST-HOOD-01',
        'AST-MDL-FRIDGE-02',
        'AST-MDL-GRIDDLE-01',
        'AST-MDL-PIZZA-PEEL-01',
        'AST-MDL-OVEN-LINE-01',
        'AST-MDL-ROBOT-ARM-02',
        'AST-MDL-TABLE-PLAIN-01',
        'AST-TEX-PLASTER-COLOR',
        'AST-TEX-PLASTER-ROUGH',
        'AST-TEX-STEEL-COLOR',
        'AST-TEX-STEEL-NORMAL',
        'AST-TEX-STEEL-ROUGH',
        'AST-TEX-TILES-COLOR',
        'AST-TEX-TILES-NORMAL',
        'AST-TEX-WOOD-COLOR',
        'AST-TEX-WOOD-NORMAL',
      ].sort(),
    );
    expect(active.assets['AST-MDL-OVEN-LINE-01']).toEqual({
      kind: 'MODEL',
      format: 'glb',
      url: 'http://localhost:8080/api/v1/kitchen-assets/files/models/oven-line-01.glb',
    });
  });

  test('UT19 - a missing asset file blocks activation of an inactive AND of the active one', async () => {
    const first = await create('Compact kitchen');
    const second = await create('Extended kitchen', sample('extended'));
    await service.activateConfiguration(first.id, manager);
    files.missing.add('models/oven-line-01.glb');
    for (const id of [second.id, first.id]) {
      repository.calls = [];
      await expect(
        service.activateConfiguration(id, manager),
      ).rejects.toMatchObject({
        status: 422,
        details: expect.arrayContaining([
          expect.objectContaining({ code: 'ASSET_FILE_MISSING' }),
        ]),
      });
      expect(repository.calls).not.toContain('deactivateCurrent');
      expect(repository.calls).not.toContain('markActive');
    }
    expect(statuses()).toEqual({
      [first.id]: 'ACTIVE',
      [second.id]: 'INACTIVE',
    });
  });

  test('delete: inactive removed, active refused, unknown 404', async () => {
    const first = await create('Compact kitchen');
    const second = await create('Extended kitchen', sample('extended'));
    await service.activateConfiguration(first.id, manager);
    await expect(service.deleteConfiguration(first.id)).rejects.toMatchObject({
      status: 409,
    });
    await service.deleteConfiguration(second.id);
    expect(repository.rows.has(second.id)).toBe(false);
    await expect(
      service.deleteConfiguration('KCF-00099'),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('dry-run validation stores nothing', async () => {
    expect(await service.validateContent(sample('compact'))).toEqual({
      valid: true,
      issues: [],
    });
    const report = await service.validateContent(sample('invalid'));
    expect(report.valid).toBe(false);
    expect(report.issues[0]).toEqual(
      expect.objectContaining({
        path: expect.any(String),
        code: expect.any(String),
        message: expect.any(String),
      }),
    );
    expect(repository.rows.size).toBe(0);
  });

  test('list returns summaries without content', async () => {
    await create('Compact kitchen');
    expect(await service.listConfigurations()).toEqual([
      {
        id: 'KCF-00001',
        name: 'Compact kitchen',
        status: 'INACTIVE',
        version: 1,
        elementCount: 14,
        updatedAt: '2026-11-12T10:15:00.000Z',
        activatedAt: null,
      },
    ]);
  });
});
