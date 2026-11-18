import { KitchenConfigurationMapper } from '../mapping/KitchenConfigurationMapper.js';

/** Read-only catalogue listing, so the Manager can write asset references (BR 15). */
export class KitchenAssetService {
  constructor({
    assetCatalogue,
    assetUrl,
    mapper = KitchenConfigurationMapper,
  }) {
    Object.assign(this, { assetCatalogue, assetUrl, mapper });
  }

  async listAssets() {
    const assets = await this.assetCatalogue.findAll();
    return assets.map((asset) => this.mapper.toAsset(asset, this.assetUrl));
  }
}