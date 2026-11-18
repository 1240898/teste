const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const id = {
  type: 'integer',
  minimum: 1,
  maximum: 14,
  description: 'EU Regulation No. 1169/2011 allergen number',
  example: 1,
};
const name = {
  type: 'string',
  minLength: 1,
  maxLength: 100,
  description:
    'Descriptive name; surrounding whitespace is trimmed. Unique case-insensitively.',
  example: 'Gluten',
};
export const allergenSchemas = {
  RegisterAllergenRequest: object({ id, name }),
  UpdateAllergenRequest: object({ name }),
  AllergenResponse: object({
    id,
    name,
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  }),
};
const descriptions = {
  400: 'Invalid request (e.g. empty name or id outside 1..14)',
  401: 'Missing or invalid token',
  403: 'Manager role required',
  404: 'Allergen not found',
  409: 'Allergen id or name already exists, or allergen is referenced by existing business information',
  413: 'Request body too large',
  500: 'Internal server error; implementation details are withheld',
};
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 1, maximum: 14 },
};
const query = (name, description, schema) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
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
    withId = false,
    parameters = [],
  } = {},
) {
  const allParameters = [...(withId ? [idParameter] : []), ...parameters];
  return {
    operationId,
    summary,
    tags: ['Allergens'],
    security: publicRoute ? [] : [{ bearerAuth: [] }, { accessToken: [] }],
    ...(input
      ? { requestBody: { required: true, content: json(ref(input)) } }
      : {}),
    ...(allParameters.length ? { parameters: allParameters } : {}),
    responses: {
      [status]: {
        description:
          status === 201
            ? 'Allergen registered'
            : status === 204
              ? 'Allergen deleted'
              : 'Success',
        ...(output ? { content: json(output) } : {}),
        ...(status === 201
          ? {
              headers: {
                Location: {
                  description: 'Registered allergen resource',
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
export const allergenPaths = {
  '/allergens': {
    get: operation('listAllergens', 'List or search allergens', {
      publicRoute: true,
      output: { type: 'array', items: ref('AllergenResponse') },
      parameters: [
        query('name', 'Case-insensitive "contains" match on the name', {
          type: 'string',
          maxLength: 100,
        }),
        query('id', 'Exact match on the identifier', {
          type: 'integer',
          minimum: 1,
          maximum: 14,
        }),
      ],
      errors: [400],
    }),
    post: operation('registerAllergen', 'Register an allergen', {
      input: 'RegisterAllergenRequest',
      status: 201,
      output: ref('AllergenResponse'),
      errors: [400, 401, 403, 409, 413],
    }),
  },
  '/allergens/{id}': {
    get: operation('getAllergen', 'Get an allergen by identifier', {
      publicRoute: true,
      withId: true,
      output: ref('AllergenResponse'),
      errors: [400, 404],
    }),
    put: operation('updateAllergen', 'Rename an allergen', {
      withId: true,
      input: 'UpdateAllergenRequest',
      output: ref('AllergenResponse'),
      errors: [400, 401, 403, 404, 409, 413],
    }),
    delete: operation(
      'deleteAllergen',
      'Delete an allergen not referenced by products or dietary restrictions',
      { withId: true, status: 204, errors: [400, 401, 403, 404, 409] },
    ),
  },
};