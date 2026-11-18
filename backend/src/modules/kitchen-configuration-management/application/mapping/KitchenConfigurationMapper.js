const iso = (value) => (value ? new Date(value).toISOString() : null);

/**
 * Application-layer mapping (domain / summary rows -> response DTOs). The API
 * never exposes database rows (DTO + Mapper, usWEB06 3.6).
 */
export class KitchenConfigurationMapper {
  /** @param {import('../../domain/model/KitchenConfiguration.js').KitchenConfiguration|object} source */
  static toSummary(source) {
    if (typeof source?.getId !== 'function')
      return {
        id: source.id,
        name: source.name,
        status: source.status,
        version: source.version,
        elementCount: source.elementCount,
        updatedAt: iso(source.updatedAt),
        activatedAt: iso(source.activatedAt),
      };
    const audit = source.getAudit();
    return {
      id: source.getId().getValue(),
      name: source.getName().getValue(),
      status: source.getStatus(),
      version: source.getVersion(),
      elementCount: source.getLayout().elementCount,
      updatedAt: iso(audit.updatedAt),
      activatedAt: iso(audit.activatedAt),
    };
  }

  static toDetail(configuration) {
    const audit = configuration.getAudit();
    return {
      id: configuration.getId().getValue(),
      name: configuration.getName().getValue(),
      status: configuration.getStatus(),
      version: configuration.getVersion(),
      content: configuration.getLayout().toJSON(),
      createdAt: iso(audit.createdAt),
      updatedAt: iso(audit.updatedAt),
      activatedAt: iso(audit.activatedAt),
    };
  }

  /**
   * GET /kitchen-configurations/active: stored content unchanged plus ONLY the
   * referenced assets with resolved URLs (D7, contract 3.4.5).
   */
  static toActive(configuration, assets, assetUrl) {
    const audit = configuration.getAudit();
    const resolved = {};
    for (const id of configuration.getLayout().referencedAssetIds()) {
      const asset = assets.get(id);
      if (asset)
        resolved[id] = {
          kind: asset.kind,
          format: asset.format,
          url: assetUrl(asset),
        };
    }
    return {
      id: configuration.getId().getValue(),
      name: configuration.getName().getValue(),
      status: configuration.getStatus(),
      version: configuration.getVersion(),
      activatedAt: iso(audit.activatedAt),
      content: configuration.getLayout().toJSON(),
      assets: resolved,
    };
  }

  static toAsset(asset, assetUrl) {
    const dto = {
      id: asset.id,
      kind: asset.kind,
      format: asset.format,
      description: asset.description,
      url: assetUrl(asset),
    };
    if (asset.isModel()) {
      dto.size = { ...asset.size };
      dto.embeddedTextureSet = asset.embeddedTextureSet;
    }
    return dto;
  }

  static toIssue(issue) {
    return {
      path: issue.path,
      code: issue.code,
      message: issue.message,
      params: { ...issue.params },
    };
  }
}