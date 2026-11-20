
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});

const errorResponse = {
  description: 'Error response',
  content: json(ref('ErrorResponse')),
};

export const catalogueSchemas = {
  CatalogueCategory: object({
    id: { type: 'string', example: 'CAT-00123' },
    name: { type: 'string', example: 'Pizzas' },
  }),
  CatalogueAllergen: object({
    id: { type: 'integer', minimum: 1, maximum: 14, example: 1 },
    name: { type: 'string', example: 'Gluten' },
  }),
  CatalogueMoney: object({
    amount: { type: 'string', pattern: '^\\d+\\.\\d{2}$', example: '8.50' },
    currency: { type: 'string', enum: ['EUR'] },
  }),
  CatalogueComponent: object({
    id: { type: 'string', pattern: '^PROD-\\d{5,}$' },
    name: { type: 'string' },
    pizzaComponentTypeId: { type: 'string' },
  }),
  CataloguePizzaSize: object({
    sizeId: { type: 'string', pattern: '^PSIZE-\\d{4,}$' },
    sizeName: { type: 'string' },
    price: ref('CatalogueMoney'),
    available: { type: 'boolean' },
  }),
  CataloguePizza: object({
    defaultComponents: {
      type: 'array',
      items: ref('CatalogueComponent'),
    },
    sizes: { type: 'array', items: ref('CataloguePizzaSize') },
  }),
  CatalogueProduct: object({
    id: { type: 'string', pattern: '^PROD-\\d{5,}$' },
    name: { type: 'string' },
    description: { type: 'string' },
    available: { type: 'boolean' },
    isPizzaComponent: { type: 'boolean' },
    category: ref('CatalogueCategory'),
    price: { allOf: [ref('CatalogueMoney')], nullable: true },
    allergens: { type: 'array', items: ref('CatalogueAllergen') },
    pizza: { allOf: [ref('CataloguePizza')], nullable: true },
  }),
};

// WEB03 (ALN-1): public operations; an empty list overrides any global security.
const security = [];
const responses = (successDescription, errors) => ({
  200: {
    description: successDescription,
    content: json({
      type: 'array',
      items: ref('CatalogueProduct'),
    }),
  },
  ...Object.fromEntries(errors.map((code) => [code, errorResponse])),
  500: errorResponse,
});

export const cataloguePaths = {
  '/catalogue': {
    get: {
      operationId: 'listCatalogue',
      summary: 'List or search sellable catalogue products',
      tags: ['Product catalogue'],
      security,
      parameters: [
        {
          name: 'componentName',
          in: 'query',
          required: false,
          description:
            'Exact full component name match, case-insensitive. Returns sellable component products and sellable pizzas containing the component.',
          schema: { type: 'string', minLength: 1, maxLength: 100 },
        },
        {
          name: 'componentIds',
          in: 'query',
          required: false,
          description: 'Comma-separated component Product IDs. A result must contain every selected component.',
          schema: { type: 'string', example: 'PROD-00001,PROD-00002' },
        },
        {
          name: 'excludeComponentIds',
          in: 'query',
          required: false,
          description: 'Comma-separated component Product IDs. Results containing any selected component are omitted.',
          schema: { type: 'string', example: 'PROD-00003' },
        },
        {
          name: 'excludeAllergenIds',
          in: 'query',
          required: false,
          description: 'Comma-separated allergen IDs. Results containing any selected allergen are omitted.',
          schema: { type: 'string', example: '1,7' },
        },
      ],
      responses: responses('Catalogue products', [400]),
    },
  },
  '/catalogue/{productId}': {
    get: {
      operationId: 'getCatalogueProduct',
      summary: 'Get one sellable catalogue product',
      tags: ['Product catalogue'],
      security,
      parameters: [
        {
          name: 'productId',
          in: 'path',
          required: true,
          schema: { type: 'string', pattern: '^PROD-\\d{5,}$' },
        },
      ],
      responses: {
        200: {
          description: 'Catalogue product details',
          content: json(ref('CatalogueProduct')),
        },
        ...Object.fromEntries(
          [400, 404].map((code) => [code, errorResponse]),
        ),
        500: errorResponse,
      },
    },
  },
};
