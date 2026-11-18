import '../src/shared/config/index.js';
import { createDatabase } from '../src/shared/persistence/postgres/index.js';
import { createProductManagementModule } from '../src/modules/product-management/index.js';
import { createStockModule } from '../src/modules/stock-information-management/index.js';
import { seedProductCategories } from '../src/modules/product-category-management/infrastructure/seedProductCategories.js';
import {
  describeAllergenSeedConflicts,
  seedAllergens,
} from '../src/modules/allergen-management/infrastructure/seedAllergens.js';

if (
  !new Set(['127.0.0.1', 'localhost', '::1']).has(process.env.PGHOST) ||
  process.env.PGDATABASE?.endsWith('_test') ||
  process.env.NODE_ENV === 'production'
) {
  console.error(
    'BCK09 demo bootstrap only runs against a local, non-test database.',
  );
  process.exit(1);
}

const authMiddleware = { verifyToken: (_req, _res, next) => next() };
const fixtures = [
  {
    name: 'BCK09 Local Test Product',
    description: 'Active local fixture for BCK09 stock management tests',
    active: true,
    initialUnits: 10,
  },
  {
    name: 'BCK09 Local Inactive Test Product',
    description: 'Inactive local fixture for BCK09 stock management tests',
    active: false,
    initialUnits: 5,
  },
  {
    name: 'BCK09 Local Untracked Test Product',
    description: 'Local fixture ready to start BCK09 stock tracking',
    active: true,
    track: false,
  },
];

async function ensureProduct(database, productService, categoryId, fixture) {
  const { rows } = await database.query(
    'SELECT id FROM products WHERE name = $1 AND description = $2 ORDER BY id LIMIT 1',
    [fixture.name, fixture.description],
  );
  let product;
  if (rows[0]) {
    product = await productService.getProductById(rows[0].id);
  } else {
    product = await productService.createProduct({
      name: fixture.name,
      description: fixture.description,
      categoryId,
      isSellable: true,
      isPizzaComponent: false,
      isStockControlled: false,
      pizzaComponentTypeId: null,
      allergenIds: [],
      pricingMode: 'FIXED',
      basePrice: 1.99,
    });
  }

  if (fixture.active && !product.isActive) {
    product = await productService.activateProduct(product.id);
  } else if (!fixture.active && product.isActive) {
    await productService.deactivateProduct(product.id);
    product = await productService.getProductById(product.id);
  }
  return product;
}

async function ensureCurrentStock(
  database,
  stockService,
  productId,
  initialUnits,
) {
  const { rows } = await database.query(
    `SELECT stock_code, available_units FROM stock_information
     WHERE product_id = $1 AND ended_at IS NULL`,
    [productId],
  );
  if (rows[0]) {
    return {
      stockId: rows[0].stock_code,
      productId,
      availableUnits: Number(rows[0].available_units),
      reused: true,
    };
  }
  return {
    ...(await stockService.startTracking({ productId, initialUnits })),
    reused: false,
  };
}

let database;
try {
  database = createDatabase();
  await database.verify();

  const seeded = await database.withTransaction(async (client) => {
    const transaction = { query: (sql, values) => client.query(sql, values) };
    return {
      allergens: await seedAllergens(transaction),
      categories: await seedProductCategories(transaction),
    };
  });
  if (seeded.allergens.conflicts.length) {
    describeAllergenSeedConflicts(seeded.allergens.conflicts).forEach((line) =>
      console.warn(`WARNING: ${line}`),
    );
  }

  const { rows: categories } = await database.query(
    'SELECT id FROM product_categories WHERE lower(name) = lower($1) ORDER BY id LIMIT 1',
    ['Pizza Ingredients'],
  );
  if (!categories[0])
    throw new Error('Pizza Ingredients category is unavailable');

  const stockModule = createStockModule({ database, authMiddleware });
  const productModule = createProductManagementModule({
    database,
    authMiddleware,
    stockProvisioning: stockModule.stockProvisioning,
  });

  console.log(
    `BCK09 test data ready in local database "${process.env.PGDATABASE}".`,
  );
  for (const fixture of fixtures) {
    const product = await ensureProduct(
      database,
      productModule.productService,
      categories[0].id,
      fixture,
    );
    if (fixture.track === false) {
      console.log(
        `Ready to start tracking: Product ${product.id}; no current stock period.`,
      );
      continue;
    }
    const stock = await ensureCurrentStock(
      database,
      stockModule.service,
      product.id,
      fixture.initialUnits,
    );
    console.log(
      `${fixture.active ? 'Active' : 'Inactive'} Product: ${product.id}; Stock: ${stock.stockId}; current units: ${stock.availableUnits}${stock.reused ? ' (existing stock unchanged)' : ''}`,
    );
  }
} catch (error) {
  console.error(`BCK09 demo bootstrap failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database?.close();
}
