import {
  ELEMENT_TYPES,
  KitchenWall,
  LIMITS,
  PROCEDURAL_SHAPES,
} from '../domain/model/KitchenLayoutFormat.js';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (
  properties,
  required = Object.keys(properties),
  extra = {},
) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
  ...extra,
});
const vector = (description) =>
  object(
    { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
    ['x', 'y', 'z'],
    { description },
  );
const error = (description) => ({
  description,
  content: json(ref('KitchenConfigurationError')),
});
const security = [{ bearerAuth: [] }, { accessToken: [] }];
const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^KCF-\\d{5,}$', example: 'KCF-00002' },
};
const textureId = {
  type: 'string',
  description: 'Id of a TEXTURE asset (GET /kitchen-assets)',
};
const common = {
  401: error('Missing, invalid or expired token'),
  403: error('Authenticated without the required role'),
};

const material = object(
  {
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    roughness: { type: 'number', minimum: 0, maximum: 1 },
    metalness: { type: 'number', minimum: 0, maximum: 1 },
    colorMapAssetId: textureId,
    roughnessMapAssetId: textureId,
    normalMapAssetId: textureId,
    bumpMapAssetId: textureId,
  },
  [],
  {
    description:
      'Texture set = colour map AND at least one roughness / normal / bump map (BR 18). Required for procedural objects; for ASSET models required when the model has embeddedTextureSet = false, then applied to every mesh.',
  },
);

export const kitchenConfigurationSchemas = {
  KitchenLayout: {
    type: 'object',
    description: `Kitchen layout, schemaVersion 1 (usWEB06 3.4.1). Metres and degrees, Y-up, origin at the centre of the floor, -Z = NORTH. Unknown properties are rejected. ${LIMITS.maxElements} elements at most.`,
    additionalProperties: false,
    required: ['schemaVersion', 'units', 'kitchen', 'assemblyLine', 'elements'],
    properties: {
      schemaVersion: { type: 'integer', enum: [1] },
      units: { type: 'string', enum: ['meters'] },
      kitchen: object({
        dimensions: object({
          width: { type: 'number', minimum: 2, maximum: 100 },
          depth: { type: 'number', minimum: 2, maximum: 100 },
          height: { type: 'number', minimum: 2, maximum: 10 },
        }),
        floor: object({ material }),
        walls: object({ material }),
      }),
      assemblyLine: object({ wall: { type: 'string', enum: KitchenWall } }),
      elements: {
        type: 'array',
        maxItems: LIMITS.maxElements,
        items: object(
          {
            id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' },
            name: { type: 'string', minLength: 1, maxLength: 80 },
            category: { type: 'string', enum: ['EQUIPMENT', 'ASSEMBLY_LINE'] },
            type: {
              type: 'string',
              enum: [
                ...new Set([
                  ...ELEMENT_TYPES.EQUIPMENT,
                  ...ELEMENT_TYPES.ASSEMBLY_LINE,
                ]),
              ],
            },
            model: {
              type: 'object',
              description:
                'ASSET: { source, assetId (MODEL) } | PROCEDURAL: { source, shape, size {x,y,z} 0.01-50 m }',
              properties: {
                source: { type: 'string', enum: ['ASSET', 'PROCEDURAL'] },
                assetId: { type: 'string' },
                shape: { type: 'string', enum: PROCEDURAL_SHAPES },
                size: vector('Metres'),
              },
            },
            placement: object({
              position: vector(
                'Base point (bottom centre), inside the kitchen',
              ),
              rotation: vector('Degrees, -360 to 360'),
              scale: vector('0.01 to 100 per axis'),
            }),
            material,
          },
          ['id', 'category', 'type', 'model', 'placement'],
        ),
      },
    },
  },
  ValidationIssue: object(
    {
      path: { type: 'string', example: '/elements/4/placement/scale/y' },
      code: { type: 'string', example: 'INVALID_SCALE' },
      message: { type: 'string', example: 'y must be between 0.01 and 100' },
      params: {
        type: 'object',
        description: 'Values used to translate the message (i18n by code).',
      },
    },
    ['path', 'code', 'message'],
  ),
  KitchenConfigurationError: object({
    error: object(
      {
        message: { type: 'string' },
        status: { type: 'integer' },
        details: { type: 'array', items: ref('ValidationIssue') },
      },
      ['message', 'status'],
    ),
  }),
  KitchenConfigurationCreateRequest: object({
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 80,
      example: 'Compact kitchen',
    },
    content: ref('KitchenLayout'),
  }),
  KitchenConfigurationUpdateRequest: object({
    name: { type: 'string', minLength: 3, maxLength: 80 },
    content: ref('KitchenLayout'),
    version: {
      type: 'integer',
      minimum: 1,
      description: 'Version that was loaded (optimistic concurrency).',
    },
  }),
  KitchenConfigurationSummary: object({
    id: { type: 'string', example: 'KCF-00002' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    version: { type: 'integer' },
    elementCount: { type: 'integer' },
    updatedAt: { type: 'string', format: 'date-time' },
    activatedAt: { type: 'string', format: 'date-time', nullable: true },
  }),
  KitchenConfigurationDetail: object({
    id: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    version: { type: 'integer' },
    content: ref('KitchenLayout'),
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    activatedAt: { type: 'string', format: 'date-time', nullable: true },
  }),
  ActiveKitchenConfiguration: object({
    id: { type: 'string' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['ACTIVE'] },
    version: { type: 'integer' },
    activatedAt: { type: 'string', format: 'date-time' },
    content: ref('KitchenLayout'),
    assets: {
      type: 'object',
      description: 'Only the referenced assets, keyed by asset id.',
      additionalProperties: object({
        kind: { type: 'string', enum: ['MODEL', 'TEXTURE'] },
        format: { type: 'string', example: 'glb' },
        url: { type: 'string', format: 'uri' },
      }),
    },
  }),
  KitchenActivationResult: object({
    activeConfiguration: ref('KitchenConfigurationSummary'),
    previousActiveConfigurationId: { type: 'string', nullable: true },
  }),
  KitchenValidationReport: object({
    valid: { type: 'boolean' },
    issues: { type: 'array', items: ref('ValidationIssue') },
  }),
  KitchenAsset: object(
    {
      id: { type: 'string', example: 'AST-MDL-OVEN-DOME-01' },
      kind: { type: 'string', enum: ['MODEL', 'TEXTURE'] },
      format: { type: 'string', example: 'glb' },
      description: { type: 'string' },
      size: vector('Model size at scale 1 (metres); models only'),
      embeddedTextureSet: {
        type: 'boolean',
        description: 'Models only: false = a material override is required.',
      },
      url: { type: 'string', format: 'uri' },
    },
    ['id', 'kind', 'format', 'description', 'url'],
  ),
};

const tags = ['Kitchen configurations'];

export const kitchenConfigurationPaths = {
  '/kitchen-configurations': {
    get: {
      tags,
      summary: 'List kitchen configurations (without content)',
      operationId: 'listKitchenConfigurations',
      security,
      description: 'Role: MANAGER.',
      responses: {
        200: {
          description: 'Summaries',
          content: json({
            type: 'array',
            items: ref('KitchenConfigurationSummary'),
          }),
        },
        ...common,
      },
    },
    post: {
      tags,
      summary: 'Create or import a kitchen configuration (stored INACTIVE)',
      operationId: 'createKitchenConfiguration',
      security,
      description:
        'Role: MANAGER. Nothing is stored when the content is invalid.',
      requestBody: {
        required: true,
        content: json(ref('KitchenConfigurationCreateRequest')),
      },
      responses: {
        201: {
          description:
            'Created; Location header points to the new configuration',
          content: json(ref('KitchenConfigurationDetail')),
        },
        400: error('Malformed JSON, invalid envelope or invalid name'),
        ...common,
        409: error('A kitchen configuration with this name already exists'),
        413: error('Request body too large (100 KB)'),
        422: error('The kitchen configuration content is invalid (details)'),
      },
    },
  },
  '/kitchen-configurations/active': {
    get: {
      tags,
      summary:
        'Active kitchen configuration with resolved asset URLs (viewer endpoint)',
      operationId: 'getActiveKitchenConfiguration',
      security,
      description:
        'Roles: MANAGER, EMPLOYEE. The only source of the layout used by the 3D viewer (VIS01 contract 3.4.5). Cache-Control: no-store.',
      responses: {
        200: {
          description: 'Active configuration',
          content: json(ref('ActiveKitchenConfiguration')),
        },
        ...common,
                404: {
          description:
            'No active kitchen configuration: details[0].code = NO_ACTIVE_CONFIGURATION (VIS-ALN-1). A 404 without that code is not this case.',
          content: {
            'application/json': {
              schema: ref('KitchenConfigurationError'),
              example: {
                error: {
                  message: 'No active kitchen configuration',
                  status: 404,
                  details: [
                    {
                      path: '',
                      code: 'NO_ACTIVE_CONFIGURATION',
                      message: 'No active kitchen configuration',
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
  '/kitchen-configurations/validation': {
    post: {
      tags,
      summary: 'Validate content without storing it (dry run)',
      operationId: 'validateKitchenConfiguration',
      security,
      description: 'Role: MANAGER.',
      requestBody: {
        required: true,
        content: json(object({ content: { type: 'object' } })),
      },
      responses: {
        200: {
          description: 'Validation report',
          content: json(ref('KitchenValidationReport')),
        },
        400: error('Invalid request body'),
        ...common,
        413: error('Request body too large (100 KB)'),
      },
    },
  },
  '/kitchen-configurations/{id}': {
    parameters: [idParameter],
    get: {
      tags,
      summary: 'Consult a kitchen configuration with its content',
      operationId: 'getKitchenConfiguration',
      security,
      description: 'Role: MANAGER.',
      responses: {
        200: {
          description: 'Configuration',
          content: json(ref('KitchenConfigurationDetail')),
        },
        400: error('Invalid id'),
        ...common,
        404: error('Kitchen configuration not found'),
      },
    },
    put: {
      tags,
      summary: 'Replace name and content (also of the active configuration)',
      operationId: 'updateKitchenConfiguration',
      security,
      description:
        'Role: MANAGER. Validated before it is stored; the status is not changed. A stale version answers 409 and nothing is overwritten.',
      requestBody: {
        required: true,
        content: json(ref('KitchenConfigurationUpdateRequest')),
      },
      responses: {
        200: {
          description: 'Updated (version + 1)',
          content: json(ref('KitchenConfigurationDetail')),
        },
        400: error('Invalid id, envelope or name'),
        ...common,
        404: error('Kitchen configuration not found'),
        409: error('Stale version or duplicate name'),
        413: error('Request body too large (100 KB)'),
        422: error('The kitchen configuration content is invalid (details)'),
      },
    },
    delete: {
      tags,
      summary: 'Delete an inactive kitchen configuration',
      operationId: 'deleteKitchenConfiguration',
      security,
      description: 'Role: MANAGER.',
      responses: {
        204: { description: 'Deleted' },
        400: error('Invalid id'),
        ...common,
        404: error('Kitchen configuration not found'),
        409: error('The active kitchen configuration cannot be deleted'),
      },
    },
  },
  '/kitchen-configurations/{id}/activation': {
    parameters: [idParameter],
    post: {
      tags,
      summary:
        'Activate a configuration (previous active becomes inactive, one transaction)',
      operationId: 'activateKitchenConfiguration',
      security,
      description:
        'Role: MANAGER. Re-validates the content, the catalogue and the asset files before any status change.',
      responses: {
        200: {
          description: 'Activated (or already active and still valid)',
          content: json(ref('KitchenActivationResult')),
        },
        400: error('Invalid id'),
        ...common,
        404: error('Kitchen configuration not found'),
        409: error('Another activation was in progress'),
        422: error('The kitchen configuration content is invalid (details)'),
      },
    },
  },
  '/kitchen-assets': {
    get: {
      tags: ['Kitchen assets'],
      summary: 'List the kitchen asset catalogue (read-only)',
      operationId: 'listKitchenAssets',
      security,
      description: 'Role: MANAGER.',
      responses: {
        200: {
          description: 'Catalogue',
          content: json({ type: 'array', items: ref('KitchenAsset') }),
        },
        ...common,
      },
    },
  },
  '/kitchen-assets/files/{path}': {
    get: {
      tags: ['Kitchen assets'],
      summary: 'Static model or texture file (public, read-only)',
      operationId: 'getKitchenAssetFile',
      parameters: [
        {
          name: 'path',
          in: 'path',
          required: true,
          schema: { type: 'string', example: 'models/oven-dome-01.glb' },
        },
      ],
      responses: {
        200: { description: 'File content' },
        404: { description: 'File not found' },
      },
    },
  },
};