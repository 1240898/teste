const security = [{ bearerAuth: [] }, { accessToken: [] }];
const accessErrors = {
  401: { description: 'Missing or invalid session credentials' },
  403: { description: 'Account cannot access the application' },
};
const tags = ['Shared Resources'];
const nameParameter = {
  name: 'name',
  in: 'path',
  required: true,
  schema: { type: 'string' },
};
const binary = {
  'application/octet-stream': {
    schema: { type: 'string', format: 'binary' },
  },
};
const notFound = { description: 'Shared document not found' };
const publication = {
  tags,
  security,
  parameters: [
    nameParameter,
    {
      name: 'X-Confirm-Shared-Publication',
      in: 'header',
      required: true,
      description:
        'Confirms that the document can be read by all active accounts.',
      schema: { type: 'string', enum: ['true'] },
    },
  ],
  requestBody: {
    required: true,
    description: 'PDF, DOCX or TXT file up to 10 MiB.',
    content: binary,
  },
};
const publicationErrors = {
  ...accessErrors,
  400: {
    description:
      'Invalid document name or file, or missing publication confirmation',
  },
  413: { description: 'Document is too large' },
  415: { description: 'Expected application/octet-stream' },
};

export const sharedResourcesPaths = {
  '/shared-resources': {
    get: {
      operationId: 'listSharedResources',
      summary: 'List shared restaurant documents',
      tags,
      security,
      responses: {
        200: {
          description: 'List of shared documents',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name'],
                      properties: { name: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        ...accessErrors,
      },
    },
  },
  '/shared-resources/{name}': {
    get: {
      operationId: 'downloadSharedResource',
      summary: 'Download a shared restaurant document',
      tags,
      security,
      parameters: [nameParameter],
      responses: {
        200: {
          description: 'Document returned as an attachment',
          content: binary,
        },
        ...accessErrors,
        404: notFound,
      },
    },
    post: {
      ...publication,
      operationId: 'publishSharedResource',
      summary: 'Publish a new document as an administrator',
      responses: {
        201: { description: 'Document published' },
        ...publicationErrors,
        409: { description: 'A document with the same name already exists' },
      },
    },
    put: {
      ...publication,
      operationId: 'replaceSharedResource',
      summary: 'Replace an existing document as an administrator',
      responses: {
        204: { description: 'Document replaced' },
        ...publicationErrors,
        404: notFound,
      },
    },
    delete: {
      operationId: 'deleteSharedResource',
      summary: 'Delete a shared document as an administrator',
      tags,
      security,
      parameters: [nameParameter],
      responses: {
        204: { description: 'Document deleted' },
        ...accessErrors,
        404: notFound,
      },
    },
  },
};
