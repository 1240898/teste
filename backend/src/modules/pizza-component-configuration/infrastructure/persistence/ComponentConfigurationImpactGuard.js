import { AppError } from '../../../../shared/errors/AppError.js';

/**
 * Consistency guard for the BCK08 scope.
 *
 * Component configurations are identified by the Product/Pizza Size pair and
 * no order or predefined-pizza reference exists in the current schema. The
 * aggregate validates the pair during creation and revision; this adapter
 * protects that identity at the application boundary and leaves the port
 * extensible for later stories that add dependent business data.
 */
export class ComponentConfigurationImpactGuard {
  async assertSafeChange(current, candidate, _tx) {
    if (!candidate || typeof candidate.getProductId !== 'function')
      throw new AppError('Invalid component configuration candidate', 400);

    if (!current) return;

    const sameProduct =
      current.getProductId().getValue() === candidate.getProductId().getValue();
    const sameSize =
      current.getSizeId().getValue() === candidate.getSizeId().getValue();
    if (!sameProduct || !sameSize)
      throw new AppError('Component configuration identity cannot change', 409);
  }
}
