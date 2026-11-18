import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';
import { CategoryId } from '../../../product-category-management/domain/model/CategoryId.js';
import { ComponentTypeId } from '../../../pizza-component-type-management/domain/model/values.js';
import { Money } from '../../domain/model/Money.js';
import { AcquisitionType } from '../../domain/model/AcquisitionType.js';
import { ProductCompositionItem } from '../../domain/model/ProductCompositionItem.js';
import { PricingMode } from '../../domain/model/PricingMode.js';
import { ProductDescription } from '../../domain/model/ProductDescription.js';
import { ProductName } from '../../domain/model/ProductName.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { ProductResponseDTO } from '../dtos/ProductResponseDTO.js';

/** Maps between application DTOs and the domain model (no persistence concerns). */
export class ProductMapper {
  /**
   * Builds the value objects of the editable state. Each VO throws AppError(400)
   * with a specific message when a field value is invalid.
   * @returns {import('../../domain/model/Product.js').ProductProps}
   */
  static toProps(dto) {
    if (!Array.isArray(dto.allergenIds))
      throw new AppError('allergenIds must be a list');
    return {
      name: ProductName.create(dto.name),
      description: ProductDescription.create(dto.description),
      categoryId: CategoryId.create(dto.categoryId),
      isSellable: dto.isSellable,
      isPizzaComponent: dto.isPizzaComponent,
      acquisitionType: AcquisitionType.from(dto.acquisitionType),
      compositionItems: dto.compositionItems.map((item) =>
        ProductCompositionItem.create(item.productId, item.quantity),
      ),
      pizzaComponentTypeId:
        dto.pizzaComponentTypeId === null ||
        dto.pizzaComponentTypeId === undefined
          ? null
          : ComponentTypeId.create(dto.pizzaComponentTypeId),
      allergenIds: dto.allergenIds.map((id) => AllergenId.create(id)),
      pricingMode: PricingMode.from(dto.pricingMode),
      basePrice:
        dto.basePrice === null || dto.basePrice === undefined
          ? null
          : Money.create(dto.basePrice),
    };
  }

  static toDTO(product) {
    return new ProductResponseDTO({
      id: product.getId().getValue(),
      name: product.getName().getValue(),
      description: product.getDescription().getValue(),
      categoryId: product.getCategoryId().getValue(),
      isSellable: product.isSellable(),
      isPizzaComponent: product.isPizzaComponent(),
      acquisitionType: product.getAcquisitionType(),
      compositionItems: product.getCompositionItems().map((item) => ({
        productId: item.getProductId().getValue(),
        quantity: item.getQuantity().getAmount(),
      })),
      isActive: product.isActive(),
      pizzaComponentTypeId: product.getPizzaComponentTypeId()?.getValue() ?? null,
      allergenIds: product.getAllergenIds().map((id) => id.getValue()),
      pricingMode: product.getPricingMode(),
      basePrice: product.getBasePrice()?.getAmount() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  }

  static toDTOList(products) {
    return products.map((product) => this.toDTO(product));
  }
}
