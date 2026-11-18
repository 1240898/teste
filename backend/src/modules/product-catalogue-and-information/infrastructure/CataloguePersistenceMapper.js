import { AllergenRowMapper } from '../../allergen-management/infrastructure/persistence/AllergenRowMapper.js';
import { ProductCategoryRowMapper } from '../../product-category-management/infrastructure/persistence/ProductCategoryRowMapper.js';
import { ComponentConfigurationPersistenceMapper } from '../../pizza-component-configuration/infrastructure/persistence/ComponentConfigurationPersistenceMapper.js';
import { PizzaSizeMapper } from '../../pizza-size-management/infrastructure/persistence/PizzaSizeMapper.js';
import { ProductRowMapper } from '../../product-management/infrastructure/persistence/ProductRowMapper.js';
import {
  AbstractStockQuantity,
  ProductId as StockProductId,
  StockId,
} from '../../stock-information-management/domain/model/values.js';
import { StockInformation } from '../../stock-information-management/domain/model/StockInformation.js';
import { CatalogueFacts } from '../domain/CatalogueFacts.js';
import { InvalidCatalogueData } from '../domain/InvalidCatalogueData.js';

const jsonArray = (value, label) => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed))
    throw new InvalidCatalogueData(`Catalogue query did not return ${label}`);
  return parsed;
};

const dates = (row) => ({
  ...row,
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
});

export class CataloguePersistenceMapper {
  static toFacts(rows) {
    try {
      if (!Array.isArray(rows) || rows.length !== 1)
        throw new InvalidCatalogueData(
          'Catalogue query must return one snapshot row',
        );
      const row = rows[0];
      const rootRows = jsonArray(row.roots, 'sellable roots');
      const productRows = jsonArray(row.products, 'Products');
      const products = productRows.map((product) =>
        ProductRowMapper.toDomain(product),
      );
      const productsById = new Map(
        products.map((product) => [product.getId().getValue(), product]),
      );
      const sizes = jsonArray(row.sizes, 'Pizza Sizes').map((size) =>
        PizzaSizeMapper.toDomain(size),
      );
      const sizesById = new Map(
        sizes.map((size) => [size.getId().getValue(), size]),
      );
      const categories = jsonArray(row.categories, 'Product Categories').map(
        (category) => ProductCategoryRowMapper.toDomain(dates(category)),
      );
      const allergens = jsonArray(row.allergens, 'Allergens').map((allergen) =>
        AllergenRowMapper.toDomain(dates(allergen)),
      );

      const configurations = jsonArray(
        row.component_size_configurations,
        'component-size configurations',
      ).map((configuration) => {
        const component = productsById.get(configuration.product_id);
        const size = sizesById.get(configuration.size_id);
        if (!component || !size)
          throw new InvalidCatalogueData(
            'Component-size configuration references missing data',
          );
        return ComponentConfigurationPersistenceMapper.toDomain(
          configuration,
          component,
          size,
        );
      });

      const stockRecords = jsonArray(row.stock_records, 'current stock').map(
        (stock) =>
          StockInformation.create(
            StockId.create(stock.stock_code),
            StockProductId.create(stock.product_id),
            AbstractStockQuantity.create(Number(stock.available_units)),
            new Date(stock.started_at),
            stock.ended_at === null ? null : new Date(stock.ended_at),
          ),
      );

      const roots = rootRows.map((root) => {
        const product = productsById.get(root.id);
        if (!product)
          throw new InvalidCatalogueData(
            `Catalogue root ${root.id} is missing from Products`,
          );
        return product;
      });

      return new CatalogueFacts({
        roots,
        products,
        categories,
        allergens,
        configurations,
        stockRecords,
        sizes,
      });
    } catch (error) {
      if (error instanceof InvalidCatalogueData) throw error;
      throw new InvalidCatalogueData('Stored catalogue data is invalid', {
        cause: error,
      });
    }
  }
}
