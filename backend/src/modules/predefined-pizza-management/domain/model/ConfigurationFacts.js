import { AppError } from '../../../../shared/errors/AppError.js';

const PRODUCT_ID_PATTERN = /^PROD-[0-9]{5,}$/;
const nonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export class ProductEligibility {
  constructor({ productId, isSellable, isPizzaComponent }) {
    if (
      typeof productId !== 'string' ||
      !PRODUCT_ID_PATTERN.test(productId) ||
      typeof isSellable !== 'boolean' ||
      typeof isPizzaComponent !== 'boolean'
    )
      throw new AppError('Invalid representative product facts');
    this.productId = productId;
    this.isSellable = isSellable;
    this.isPizzaComponent = isPizzaComponent;
    Object.freeze(this);
  }
}

export class ComponentEligibility {
  constructor({ productId, isActive, isPizzaComponent, componentTypeId }) {
    if (
      typeof productId !== 'string' ||
      !PRODUCT_ID_PATTERN.test(productId) ||
      typeof isActive !== 'boolean' ||
      typeof isPizzaComponent !== 'boolean' ||
      !nonEmptyString(componentTypeId)
    )
      throw new AppError('Invalid component eligibility facts');
    Object.assign(this, {
      productId,
      isActive,
      isPizzaComponent,
      componentTypeId,
    });
    Object.freeze(this);
  }
}

export class TypeCardinalityRule {
  constructor({ componentTypeId, minQuantity, maxQuantity }) {
    if (
      !nonEmptyString(componentTypeId) ||
      !Number.isInteger(minQuantity) ||
      minQuantity < 0 ||
      (maxQuantity !== null &&
        (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity))
    )
      throw new AppError('Invalid component type cardinality facts');
    Object.assign(this, { componentTypeId, minQuantity, maxQuantity });
    Object.freeze(this);
  }
}

export class ConfigurationFacts {
  constructor({
    representativeProduct,
    components,
    typeRules,
    activeStructurallyEligibleSizes,
  }) {
    if (
      !(representativeProduct instanceof ProductEligibility) ||
      !Array.isArray(components) ||
      !components.every(
        (component) => component instanceof ComponentEligibility,
      ) ||
      !Array.isArray(typeRules) ||
      !typeRules.every((rule) => rule instanceof TypeCardinalityRule) ||
      !Array.isArray(activeStructurallyEligibleSizes) ||
      !activeStructurallyEligibleSizes.every(nonEmptyString)
    )
      throw new AppError('Invalid predefined pizza configuration facts');
    if (
      new Set(components.map((component) => component.productId)).size !==
        components.length ||
      new Set(typeRules.map((rule) => rule.componentTypeId)).size !==
        typeRules.length ||
      new Set(activeStructurallyEligibleSizes).size !==
        activeStructurallyEligibleSizes.length
    )
      throw new AppError('Duplicate predefined pizza configuration facts');
    this.representativeProduct = representativeProduct;
    this.components = Object.freeze([...components]);
    this.typeRules = Object.freeze([...typeRules]);
    this.activeStructurallyEligibleSizes = Object.freeze([
      ...activeStructurallyEligibleSizes,
    ]);
    Object.freeze(this);
  }
}
