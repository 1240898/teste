import { KNOWN_ROLES } from '../../src/features/authentication/services/session/authApi.js';
import { hasAnyRole } from '../../src/features/authentication/state/authSession.js';
import { AccessDecision, evaluateAccess } from '../../src/app/navigation/accessPolicy.js';
import {
  SECTIONS,
  SectionAccess,
  allSections,
  findSectionByPath,
  getSection,
  getVisibleSections,
  isSafeReturnPath,
  isSectionEnabled,
} from '../../src/app/navigation/navigationPolicy.js';

const guest = { status: 'guest', hasAnyRole: () => false };
function signedIn(...roles) {
  const session = { status: 'authenticated', user: { roles } };
  return { ...session, hasAnyRole: (...r) => hasAnyRole(session, r) };
}
const allModules = {
  kitchenViewer: () => {},
  kitchenConfigurations: () => {},
  planning: () => {},
};

// WEB03 Table 1 plus the AA05 Administrator-only security audit section.
// Guest-only sections are excluded.
const TABLE_1 = {
  GUEST: ['catalogue', 'privacyNotice'],
  CUSTOMER: ['catalogue', 'privacyNotice', 'account', 'myPrivacy'],
  EMPLOYEE: [
    'catalogue',
    'privacyNotice',
    'account',
    'products',
    'kitchenViewer',
  ],
  MANAGER: [
    'catalogue',
    'privacyNotice',
    'account',
    'products',
    'customers',
    'categories',
    'allergens',
    'pizzaSizes',
    'componentTypes',
    'predefinedPizzas',
    'stock',
    'kitchenViewer',
    'kitchenConfigurations',
    'planning',
  ],
  ADMINISTRATOR: [
    'catalogue',
    'privacyNotice',
    'account',
    'users',
    'securityAudit',
  ],
};

// Menu the SPA renders today (getVisibleSections), with every lazy module
// supplied: Table 1 restricted to the sections that are implemented and
// enabled, plus the guest-only entry points for Guest. Pages still owned by
// other stories (WEB05 management pages, GDP "my privacy") are disabled (D8).
const ENABLED_MENU = {
  GUEST: ['catalogue', 'privacyNotice', 'registration'],
  CUSTOMER: ['catalogue', 'privacyNotice', 'account'],
  EMPLOYEE: ['catalogue', 'privacyNotice', 'account', 'kitchenViewer'],
  MANAGER: [
    'catalogue',
    'privacyNotice',
    'account',
    'kitchenViewer',
    'kitchenConfigurations',
    'planning',
  ],
  ADMINISTRATOR: [
    'catalogue',
    'privacyNotice',
    'account',
    'users',
    'securityAudit',
  ],
};

const authFor = (role) => (role === 'GUEST' ? guest : signedIn(role));
const menuIds = (auth) =>
  getVisibleSections(auth, { modules: allModules }).map(({ id }) => id);

function allowedTopLevel(auth) {
  return SECTIONS.filter(
    (section) =>
      section.access !== SectionAccess.GUEST_ONLY &&
      evaluateAccess(section, auth) === AccessDecision.ALLOW,
  ).map(({ id }) => id);
}

describe('WEB03 navigation policy', () => {
  test('UT01: known roles only, unique ids and paths, children never widen their parent', () => {
    const sections = allSections();
    expect(new Set(sections.map(({ id }) => id)).size).toBe(sections.length);
    expect(new Set(sections.map(({ path }) => path)).size).toBe(
      sections.length,
    );
    for (const section of sections) {
      expect(section.roles.every((role) => KNOWN_ROLES.includes(role))).toBe(
        true,
      );
      for (const child of section.children) {
        if (section.roles.length > 0)
          expect(
            child.roles.length > 0 &&
              child.roles.every((role) => section.roles.includes(role)),
          ).toBe(true);
      }
    }
  });

    test.each(Object.entries(TABLE_1))(
    'UT02a: %s is allowed exactly the sections of Table 1 (role decision, enabled or not)',
    (role, expected) => {
      expect(allowedTopLevel(authFor(role))).toEqual(expected);
    },
  );

  test.each(Object.entries(ENABLED_MENU))(
    'UT02b: getVisibleSections() gives %s exactly its enabled Table 1 sections',
    (role, expected) => {
      const auth = authFor(role);
      const visible = menuIds(auth);
      // The rendered menu is the expected one...
      expect(visible).toEqual(expected);
      // ...and is exactly Table 1 restricted to enabled sections: nothing
      // outside the role's row, and no enabled section of the row is hidden.
      const guestOnly = SECTIONS.filter(
        (section) =>
          role === 'GUEST' &&
          section.menu &&
          section.access === SectionAccess.GUEST_ONLY,
      ).map(({ id }) => id);
      const enabledRow = TABLE_1[role].filter((id) =>
        isSectionEnabled(getSection(id), allModules),
      );
      expect(new Set(visible)).toEqual(new Set([...enabledRow, ...guestOnly]));
    },
  );

  test('UT02c: Guest menu contains the public catalogue and privacy notice (BR 4)', () => {
    expect(menuIds(guest)).toEqual(
      expect.arrayContaining(['catalogue', 'privacyNotice']),
    );
    expect(getSection('catalogue').enabled).toBe(true);
    expect(getSection('privacyNotice').enabled).toBe(true);
  });

  test('AA05: only Administrator can see and open the security audit section', () => {
    expect(menuIds(signedIn('ADMINISTRATOR'))).toContain('securityAudit');
    expect(menuIds(signedIn('MANAGER'))).not.toContain('securityAudit');
    expect(getSection('securityAudit').roles).toEqual(['ADMINISTRATOR']);
    expect(findSectionByPath('/admin/security-audit').id).toBe('securityAudit');
  });

  test.each([
    [
      ['CUSTOMER', 'MANAGER'],
      ['CUSTOMER', 'MANAGER'],
    ],
    [
      ['EMPLOYEE', 'MANAGER'],
      ['EMPLOYEE', 'MANAGER'],
    ],
    [
      ['ADMINISTRATOR', 'MANAGER'],
      ['ADMINISTRATOR', 'MANAGER'],
    ],
  ])('UT03: %j gets the union of its roles', (roles, columns) => {
    const union = new Set(columns.flatMap((role) => TABLE_1[role]));
    expect(new Set(allowedTopLevel(signedIn(...roles)))).toEqual(union);
  });

  test.each(['loading', 'guest', 'denied', 'logoutPending'])(
    'UT04: with status %s only public (and guest-only) entries are visible, whatever the roles',
    (status) => {
      const auth = {
        status,
        user: { roles: ['MANAGER'] },
        hasAnyRole: () => true,
      };
      const visible = getVisibleSections(auth, { modules: allModules });
      expect(
        visible.every((section) => section.access !== SectionAccess.PROTECTED),
      ).toBe(true);
            expect(visible.map(({ id }) => id)).toEqual(
        status === 'guest'
          ? ['catalogue', 'privacyNotice', 'registration']
          : ['catalogue', 'privacyNotice'],
      );
    },
  );

  test.each([
    ['/kitchen/viewer', true],
    ['/manage/products/PROD-00123/edit', true],
    ['/admin/users', true],
    ['//evil.example', false],
    ['https://evil.example/x', false],
    ['/\\evil.example', false],
    ['/kitchen/viewer?x=1', false],
    ['/kitchen/../admin/users', false],
    ['/unknown', false],
    ['/login', false],
    ['/register', false],
    ['javascript:alert(1)', false],
    [null, false],
  ])('UT05: isSafeReturnPath(%j) is %s', (value, expected) => {
    expect(isSafeReturnPath(value)).toBe(expected);
  });

  test('UT07: disabled sections and modules without a loader are neither visible nor matched as enabled', () => {
    const manager = signedIn('MANAGER');
    expect(getVisibleSections(manager).map(({ id }) => id)).toEqual([
      'catalogue', 'privacyNotice', 'account',
    ]);
    expect(
      getVisibleSections(manager, { modules: { planning: () => {} } }).map(
        ({ id }) => id,
      ),
    ).toEqual(['catalogue', 'privacyNotice', 'account', 'planning']);
    expect(getSection('myPrivacy').enabled).toBe(false);
    expect(getSection('users').enabled).toBe(true);
    expect(getSection('stock').enabled).toBe(true);
  });

    test('several roles give the union of the enabled menus, in declared order', () => {
    expect(menuIds(signedIn('CUSTOMER', 'MANAGER'))).toEqual(
      ENABLED_MENU.MANAGER,
    );
    expect(menuIds(signedIn('ADMINISTRATOR', 'EMPLOYEE'))).toEqual([
      'catalogue',
      'privacyNotice',
      'account',
      'kitchenViewer',
      'users',
      'securityAudit',
    ]);
  });

  test('finds the most specific section for a path (child before parent)', () => {
    expect(findSectionByPath('/manage/products').id).toBe('products');
    expect(findSectionByPath('/manage/products/new').id).toBe('productsEdit');
    expect(findSectionByPath('/account/password').id).toBe('accountPassword');
    expect(findSectionByPath('/kitchen/configurations/12').id).toBe(
      'kitchenConfigurations',
    );
    expect(findSectionByPath('/nowhere')).toBeNull();
  });
});
