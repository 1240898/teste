import { jest } from '@jest/globals';
import { PostgresSecurityAuditRepository } from '../../../src/modules/authorization-enforcement/infrastructure/PostgresSecurityAuditRepository.js';

describe('PostgresSecurityAuditRepository', () => {
  test('persists only the privacy-safe audit event fields', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresSecurityAuditRepository({ query });
    const event = {
      requestId: 'c8a7b8ec-2a9f-4d9d-a407-29aec3ab9c01',
      timestamp: '2026-11-12T10:00:00.000Z',
      outcome: 'FORBIDDEN',
      method: 'GET',
      routeTemplate: '/products/:id',
      statusCode: 403,
      actorId: 'USR-00001',
      actorRoles: ['CUSTOMER'],
    };

    await repository.save(event);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO security_audit_logs'),
      [
        event.requestId,
        event.timestamp,
        event.outcome,
        event.method,
        event.routeTemplate,
        event.statusCode,
        event.actorId,
        event.actorRoles,
      ],
    );
  });

  test('uses bound values for filters and returns paginated results', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            request_id: 'c8a7b8ec-2a9f-4d9d-a407-29aec3ab9c01',
            occurred_at: new Date('2026-11-12T10:00:00.000Z'),
            outcome: 'FORBIDDEN',
            method: 'GET',
            route_template: '/products/:id',
            status_code: 403,
            actor_id: 'USR-00001',
            actor_roles: ['CUSTOMER'],
          },
        ],
      });
    const repository = new PostgresSecurityAuditRepository({ query });
    const result = await repository.search({
      limit: 10,
      offset: 5,
      outcome: 'FORBIDDEN',
      actorId: 'USR-00001',
    });

    expect(query.mock.calls[0][1]).toEqual(['FORBIDDEN', 'USR-00001']);
    expect(query.mock.calls[1][1]).toEqual(['FORBIDDEN', 'USR-00001', 10, 5]);
    expect(result).toMatchObject({
      total: 1,
      limit: 10,
      offset: 5,
      items: [
        {
          outcome: 'FORBIDDEN',
          routeTemplate: '/products/:id',
          statusCode: 403,
        },
      ],
    });
  });
});
