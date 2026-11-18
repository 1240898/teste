const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const name = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  description:
    'Descriptive name; surrounding whitespace is trimmed. Unique case-insensitively.',
  example: 'Beverages',
};
export const categorySchemas = {
  CreateCategoryRequest: object({ name }),
  UpdateCategoryRequest: object({ name }),
  CategoryResponse: object({
    id: { type: 'string', pattern: '^CAT-\\d{5,}$', example: 'CAT-00123' },
    name,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  }),
};
const descriptions = {
  400: 'Invalid request (e.g. empty name or malformed category id)',
  401: 'Missing or invalid token',
  403: 'Manager role required',
  404: 'Category not found',
  409: 'Category name already exists, or category is referenced by existing products',
  413: 'Request body too large',
  500: 'Internal server error; implementation details are withheld',
};
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^CAT-\\d{5,}$' },
};
const query = (name, description) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type: 'string', maxLength: 100 },
});
function operation(
  operationId,
  summary,
  {
    input,
    status = 200,
    output,
    errors = [],
    publicRoute = false,
    id = false,
    parameters = [],
  } = {},
) {
  const allParameters = [...(id ? [idParameter] : []), ...parameters];
  return {
    operationId,
    summary,
    tags: ['Product categories'],
    security: publicRoute ? [] : [{ bearerAuth: [] }, { accessToken: [] }],
    ...(input
      ? { requestBody: { required: true, content: json(ref(input)) } }
      : {}),
    ...(allParameters.length ? { parameters: allParameters } : {}),
    responses: {
      [status]: {
        description:
          status === 201
            ? 'Category created'
            : status === 204
              ? 'Category deleted'
              : 'Success',
        ...(output ? { content: json(output) } : {}),
        ...(status === 201
          ? {
              headers: {
                Location: {
                  description: 'Created category resource',
                  schema: { type: 'string' },
                },
              },
            }
          : {}),
      },
      ...Object.fromEntries(
        [...errors, 500].map((code) => [
          code,
          {
            description: descriptions[code],
            content: json(ref('ErrorResponse')),
          },
        ]),
      ),
    },
  };
}
export const categoryPaths = {
  '/categories': {
    get: operation('listCategories', 'List or search product categories', {
      publicRoute: true,
      output: { type: 'array', items: ref('CategoryResponse') },
      parameters: [
        query('name', 'Case-insensitive "contains" match on the name'),
        query('id', 'Case-insensitive "contains" match on the identifier'),
      ],
      errors: [400],
    }),
    post: operation('createCategory', 'Create a product category', {
      input: 'CreateCategoryRequest',
      status: 201,
      output: ref('CategoryResponse'),
      errors: [400, 401, 403, 409, 413],
    }),
  },
  '/categories/{id}': {
    get: operation('getCategory', 'Get a product category by identifier', {
      publicRoute: true,
      id: true,
      output: ref('CategoryResponse'),
      errors: [400, 404],
    }),
    put: operation('updateCategory', 'Rename a product category', {
      id: true,
      input: 'UpdateCategoryRequest',
      output: ref('CategoryResponse'),
      errors: [400, 401, 403, 404, 409, 413],
    }),
    delete: operation(
      'deleteCategory',
      'Delete a category that no product references',
      { id: true, status: 204, errors: [400, 401, 403, 404, 409] },
    ),
  },
};
