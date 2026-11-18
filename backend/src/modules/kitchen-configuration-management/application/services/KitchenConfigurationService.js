import { AppError } from '../../../../shared/errors/AppError.js';
import { ConcurrencyConflictError } from '../../domain/errors/ConcurrencyConflictError.js';
import { ActiveConfigurationDeletionError } from '../../domain/errors/ActiveConfigurationDeletionError.js';
import { KitchenConfigurationValidationError } from '../../domain/errors/KitchenConfigurationValidationError.js';
import { ConfigurationName } from '../../domain/model/ConfigurationName.js';
import { KitchenConfiguration } from '../../domain/model/KitchenConfiguration.js';
import { KitchenConfigurationId } from '../../domain/model/KitchenConfigurationId.js';
import { KitchenLayoutValidator } from '../../domain/services/KitchenLayoutValidator.js';
import { KitchenConfigurationMapper } from '../mapping/KitchenConfigurationMapper.js';

export const CONFIGURATION_NOT_FOUND = 'Kitchen configuration not found';
export const NO_ACTIVE_CONFIGURATION = 'No active kitchen configuration';
/** VIS-ALN-1: stable code that lets the viewer tell "no active one" from a wrong route. */
export const NO_ACTIVE_CONFIGURATION_CODE = 'NO_ACTIVE_CONFIGURATION';
export const DUPLICATE_NAME =
  'A kitchen configuration with this name already exists';
export const ACTIVATION_RACE =
  'Another activation was in progress. Reload and try again.';

const found = (configuration) => {
  if (!configuration) throw new AppError(CONFIGURATION_NOT_FOUND, 404);
  return configuration;
};
const actorOf = (actor) => actor?.sub ?? null;

/**
 * Application service of WEB06. Authentication and roles are enforced by the
 * route middlewares; local invariants live in the KitchenConfiguration
 * aggregate; content rules in KitchenLayoutValidator. This service loads the
 * asset context, owns the transactions and the "one active" rule (BR 8, BR 9).
 */
export class KitchenConfigurationService {
  /**
   * @param {Object} deps
   * @param {import('../../domain/repositories/IKitchenConfigurationRepository.js').IKitchenConfigurationRepository} deps.repository
   * @param {import('../ports/IKitchenAssetCatalogue.js').IKitchenAssetCatalogue} deps.assetCatalogue
   * @param {import('../ports/IKitchenAssetFileStore.js').IKitchenAssetFileStore} deps.assetFiles
   * @param {import('../ports/IUnitOfWork.js').IUnitOfWork} deps.unitOfWork
   * @param {(asset) => string} deps.assetUrl Builds the public URL of an asset file.
   */
  constructor({
    repository,
    assetCatalogue,
    assetFiles,
    unitOfWork,
    assetUrl,
    validator = new KitchenLayoutValidator(),
    mapper = KitchenConfigurationMapper,
    clock = () => new Date(),
  }) {
    Object.assign(this, {
      repository,
      assetCatalogue,
      assetFiles,
      unitOfWork,
      assetUrl,
      validator,
      mapper,
      clock,
    });
  }

  /** SD 4 - summaries without content (D11). */
  async listConfigurations() {
    const summaries = await this.repository.findAllSummaries();
    return summaries.map((summary) => this.mapper.toSummary(summary));
  }

  /** SD 4 - consult one configuration with its content. */
  async getConfiguration(id) {
    const configuration = found(
      await this.repository.findById(KitchenConfigurationId.create(id)),
    );
    return this.mapper.toDetail(configuration);
  }

  /** SD 5 - the only source of the layout used by the viewer (BR 13, D7). */
  async getActiveConfiguration() {
    const configuration = await this.repository.findActive();
        if (!configuration)
      throw new AppError(NO_ACTIVE_CONFIGURATION, 404, [
        {
          path: '',
          code: NO_ACTIVE_CONFIGURATION_CODE,
          message: NO_ACTIVE_CONFIGURATION,
        },
      ]);
    const assets = await this.assetCatalogue.findByIds(
      configuration.getLayout().referencedAssetIds(),
    );
    return this.mapper.toActive(configuration, assets, this.assetUrl);
  }

  /** SD 1 - create / import: validated first, stored INACTIVE (BR 6, BR 7). */
  async createConfiguration(dto, actor) {
    const name = ConfigurationName.create(dto?.name);
    const layout = await this.#validateOrThrow(dto?.content);
    const saved = await this.unitOfWork.withTransaction(async (tx) => {
      if (await this.repository.existsByName(name, null, tx))
        throw new AppError(DUPLICATE_NAME, 409);
      const configuration = KitchenConfiguration.create(
        await this.repository.nextId(tx),
        name,
        layout,
        actorOf(actor),
        this.clock(),
      );
      await this.repository.insert(configuration, tx);
      return configuration;
    });
    return this.mapper.toDetail(saved);
  }

  /** SD 2 - edit (also of the ACTIVE one): validated before any write (BR 11, BR 12). */
  async updateConfiguration(id, dto, actor) {
    const configurationId = KitchenConfigurationId.create(id);
    const configuration = found(
      await this.repository.findById(configurationId),
    );
    const layout = await this.#validateOrThrow(dto?.content);
    const name = ConfigurationName.create(dto?.name);
    if (await this.repository.existsByName(name, configurationId))
      throw new AppError(DUPLICATE_NAME, 409);
    const expectedVersion = dto.version;
    configuration.edit(
      name,
      layout,
      expectedVersion,
      actorOf(actor),
      this.clock(),
    );
    await this.unitOfWork.withTransaction(async (tx) => {
      if (!(await this.repository.replace(configuration, expectedVersion, tx)))
        throw new ConcurrencyConflictError();
    });
    return this.mapper.toDetail(configuration);
  }

  /** SD 4 - only INACTIVE configurations are deleted (BR 10). */
  async deleteConfiguration(id) {
    const configurationId = KitchenConfigurationId.create(id);
    const configuration = found(
      await this.repository.findById(configurationId),
    );
    configuration.assertDeletable();
    if (await this.repository.deleteIfInactive(configurationId)) return;
    // Activated or deleted between the read and the conditional DELETE.
    if (await this.repository.findById(configurationId))
      throw new ActiveConfigurationDeletionError();
    throw new AppError(CONFIGURATION_NOT_FOUND, 404);
  }

  /**
   * SD 3 - ONE transaction: lock -> load target FOR UPDATE -> re-validate
   * (catalogue AND files) -> already active? -> previous INACTIVE, target ACTIVE.
   * Validation comes before the idempotency shortcut (D5).
   */
  async activateConfiguration(id, actor) {
    const configurationId = KitchenConfigurationId.create(id);
    return this.unitOfWork.withTransaction(async (tx) => {
      await this.repository.lockActivation(tx);
      const target = found(
        await this.repository.findByIdForUpdate(configurationId, tx),
      );
      await this.#validateOrThrow(target.getLayout().toJSON(), tx);
      if (target.isActive())
        return {
          activeConfiguration: this.mapper.toSummary(target),
          previousActiveConfigurationId: null,
        };
      const previous = await this.repository.deactivateCurrent(
        configurationId,
        tx,
      );
      target.activate(actorOf(actor), this.clock());
      if (!(await this.repository.markActive(target, tx)))
        throw new AppError(ACTIVATION_RACE, 409);
      return {
        activeConfiguration: this.mapper.toSummary(target),
        previousActiveConfigurationId: previous?.getValue() ?? null,
      };
    });
  }

  /** Dry run (D3): the same rules, nothing stored. */
  async validateContent(content) {
    const result = this.validator.validate(
      content,
      await this.#assetContext(content),
    );
    return {
      valid: result.isValid(),
      issues: result.issues.map((issue) => this.mapper.toIssue(issue)),
    };
  }

  async #validateOrThrow(content, tx) {
    const result = this.validator.validate(
      content,
      await this.#assetContext(content, tx),
    );
    if (!result.isValid())
      throw new KitchenConfigurationValidationError(
        result.issues.map((issue) => this.mapper.toIssue(issue)),
      );
    return result.layout;
  }

  /** Catalogue rows of the referenced ids + whether each file exists (BR 19). */
  async #assetContext(content, tx) {
    const ids = KitchenLayoutValidator.referencedAssetIds(content);
    const context = new Map();
    if (!ids.length) return context;
    const assets = await this.assetCatalogue.findByIds(ids, tx);
    await Promise.all(
      [...assets.values()].map(async (asset) => {
        context.set(asset.id, {
          asset,
          fileAvailable: await this.assetFiles.exists(asset.path),
        });
      }),
    );
    return context;
  }
}