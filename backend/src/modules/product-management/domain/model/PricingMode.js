import { AppError } from '../../../../shared/errors/AppError.js';

/**
 * How a sellable product gets its selling price (BR6).
 * FIXED: the product has its own basePrice.
 * COMPONENT_BASED: the price derives from size-specific component prices
 * (BCK08/BCK10 predefined pizzas); the product has no basePrice.
 */
export const PricingMode = Object.freeze({
  FIXED: 'FIXED',
  COMPONENT_BASED: 'COMPONENT_BASED',

  /** Parses an optional pricing mode; `null`/`undefined` mean "no pricing mode". */
  from(value) {
    if (value === null || value === undefined) return null;
    if (value === PricingMode.FIXED || value === PricingMode.COMPONENT_BASED)
      return value;
    throw new AppError('Pricing mode must be FIXED or COMPONENT_BASED');
  },
});