import { matchPath } from 'react-router';
import { moduleRoutes } from './moduleRoutes.js';

// WEB03 (D1, BR 1): single source of the section -> path -> roles mapping
// (Table 1). The same entries build the menu, the routes and the tests, so a
// hidden option and a protected route can never disagree.

export const SectionAccess = Object.freeze({
  PUBLIC: 'public',
  GUEST_ONLY: 'guestOnly',
  PROTECTED: 'protected',
});

export const SectionGroup = Object.freeze({
  PUBLIC: 'PUBLIC',
  MY_ACCOUNT: 'MY_ACCOUNT',
  RESTAURANT_MANAGEMENT: 'RESTAURANT_MANAGEMENT',
  KITCHEN: 'KITCHEN',
  PLANNING: 'PLANNING',
  ADMINISTRATION: 'ADMINISTRATION',
});

// Where the layout shows the entry: the account / registration links live in
// the top-right corner of the header, every other section in the side menu.
export const SectionPlacement = Object.freeze({
  HEADER: 'header',
  SIDEBAR: 'sidebar',
});

const MODULE_GROUPS = Object.freeze({
  kitchenViewer: SectionGroup.KITCHEN,
  kitchenConfigurations: SectionGroup.KITCHEN,
  planning: SectionGroup.PLANNING,
});

const MODULE_OWNERS = Object.freeze({
  kitchenViewer: 'VIS01',
  kitchenConfigurations: 'WEB06',
  planning: 'WEB07',
});

const { PUBLIC, GUEST_ONLY, PROTECTED } = SectionAccess;
const MANAGER = ['MANAGER'];

function section({
  id,
  path,
  labelKey = id,
  group,
  access = PROTECTED,
  roles = [],
  owner,
  enabled = false,
  menu = true,
  childPaths = [],
  children = [],
  module = false,
  placement = SectionPlacement.SIDEBAR,
}) {
  return Object.freeze({
    id,
    path,
    labelKey,
    group,
    access,
    roles: Object.freeze([...roles]),
    owner,
    enabled,
    menu,
    module,
    placement,
    childPaths: Object.freeze([...childPaths]),
    children: Object.freeze(
      children.map((child) =>
        section({ group, access, menu: false, owner, ...child }),
      ),
    ),
  });
}

/**
 * Sections whose page is not implemented yet keep their Table 1 roles but stay
 * disabled (D8): they are neither shown nor routable until their owner story
 * enables them. Lazy modules (WEB01) are enabled when a loader is supplied.
 */
export const SECTIONS = Object.freeze([
  section({
    id: 'catalogue',
    path: '/catalogue',
    group: SectionGroup.PUBLIC,
    access: PUBLIC,
    owner: 'WEB03',
    enabled: true,
    childPaths: [':productId'],
  }),
  section({
    id: 'privacyNotice',
    path: '/privacy',
    group: SectionGroup.PUBLIC,
    access: PUBLIC,
    owner: 'WEB03',
    enabled: true,
  }),
  section({
    id: 'login',
    path: '/login',
    labelKey: 'signInTitle',
    group: SectionGroup.PUBLIC,
    access: GUEST_ONLY,
    owner: 'AA01',
    enabled: true,
    menu: false,
  }),
  section({
    id: 'registration',
    path: '/register',
    labelKey: 'createAccount',
    group: SectionGroup.PUBLIC,
    access: GUEST_ONLY,
    owner: 'AA01',
    enabled: true,
    placement: SectionPlacement.HEADER,
  }),
  section({
    id: 'account',
    path: '/account',
    group: SectionGroup.MY_ACCOUNT,
    owner: 'AA04',
    enabled: true,
    placement: SectionPlacement.HEADER,
    children: [
      { id: 'accountPassword', path: '/account/password', enabled: true },
    ],
  }),
  section({
    id: 'myPrivacy',
    path: '/account/privacy',
    group: SectionGroup.MY_ACCOUNT,
    roles: ['CUSTOMER'],
    owner: 'GDP01',
    enabled: true,
  }),
  section({
    id: 'sharedResources',
    path: '/documents',
    group: SectionGroup.MY_ACCOUNT,
    owner: 'SYS04',
    enabled: true,
  }),
  section({
    id: 'products',
    path: '/manage/products',
    group: SectionGroup.RESTAURANT_MANAGEMENT,
    roles: ['MANAGER', 'EMPLOYEE'],
    owner: 'WEB05',
    enabled: true,
    module: true,
    childPaths: [
      'new',
      ':productId/edit',
      ':productId/component-configurations',
    ],
    children: [
      {
        id: 'productsEdit',
        path: '/manage/products/new',
        roles: MANAGER,
      },
      {
        id: 'productEdit',
        path: '/manage/products/:productId/edit',
        roles: MANAGER,
      },
      {
        id: 'productComponentConfigurations',
        path: '/manage/products/:productId/component-configurations',
        roles: MANAGER,
      },
    ],
  }),
  ...[
    ['customers', '/manage/customers'],
    ['categories', '/manage/categories'],
    ['allergens', '/manage/allergens'],
    ['pizzaSizes', '/manage/pizza-sizes'],
    ['componentTypes', '/manage/pizza-component-types'],
    ['predefinedPizzas', '/manage/predefined-pizzas'],
    ['stock', '/manage/stock'],
  ].map(([id, path]) =>
    section({
      id,
      path,
      group: SectionGroup.RESTAURANT_MANAGEMENT,
      roles: MANAGER,
      owner: 'WEB05',
      enabled: true,
      module: true,
    }),
  ),
  ...moduleRoutes.map(({ id, path, labelKey, roles, childPaths }) =>
    section({
      id,
      path,
      labelKey,
      group: MODULE_GROUPS[id] ?? SectionGroup.KITCHEN,
      roles,
      owner: MODULE_OWNERS[id],
      childPaths,
      module: true,
    }),
  ),
  section({
    id: 'users',
    path: '/admin/users',
    labelKey: 'userManagement',
    group: SectionGroup.ADMINISTRATION,
    roles: ['ADMINISTRATOR'],
    owner: 'AA06',
    enabled: true,
  }),
  section({
    id: 'securityAudit',
    path: '/admin/security-audit',
    labelKey: 'securityAudit',
    group: SectionGroup.ADMINISTRATION,
    roles: ['ADMINISTRATOR'],
    owner: 'AA05',
    enabled: true,
  }),
]);

/** Every declared section, children included (used by tests and lookups). */
export function allSections(sections = SECTIONS) {
  return sections.flatMap((entry) => [entry, ...allSections(entry.children)]);
}

export function getSection(id) {
  const found = allSections().find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown navigation section: ${id}`);
  return found;
}

/** A lazy module is enabled by its loader; other sections by their flag. */
export function isSectionEnabled(entry, modules = {}) {
  return entry.module
    ? typeof modules[entry.id] === 'function'
    : entry.enabled === true;
}

export function matchesSection({ path, childPaths = [] }, pathname) {
  return Boolean(
    matchPath(path, pathname) ||
    childPaths.some((child) => matchPath(`${path}/${child}`, pathname)),
  );
}

/** Most specific declared section for a path (children before parents). */
export function findSectionByPath(pathname, sections = SECTIONS) {
  for (const entry of sections) {
    const child = findSectionByPath(pathname, entry.children);
    if (child) return child;
    if (matchesSection(entry, pathname)) return entry;
  }
  return null;
}

/**
 * BR 2 / BR 3: menu entries for the current state. Roles are trusted only when
 * AuthProvider confirmed them through GET /auth/me (status "authenticated");
 * several roles give the union of their sections.
 */
export function getVisibleSections(auth, { modules = {} } = {}) {
  const status = auth?.status;
  return SECTIONS.filter((entry) => {
    if (!entry.menu || !isSectionEnabled(entry, modules)) return false;
    if (entry.access === PUBLIC) return true;
    if (entry.access === GUEST_ONLY) return status === 'guest';
    return (
      status === 'authenticated' &&
      typeof auth.hasAnyRole === 'function' &&
      auth.hasAnyRole(...entry.roles)
    );
  });
}

/**
 * D6 / BR 8: returnTo may only be a relative internal path of a known,
 * non guest-only section. No scheme, no "//", no query or fragment.
 */
export function isSafeReturnPath(value) {
  if (typeof value !== 'string' || !/^\/(?!\/)[^\\\s?#]*$/.test(value))
    return false;
  let url;
  try {
    url = new URL(value, 'http://laprizza.invalid');
  } catch {
    return false;
  }
  if (url.origin !== 'http://laprizza.invalid' || url.pathname !== value)
    return false;
  const target = findSectionByPath(value);
  return Boolean(target && target.access !== GUEST_ONLY);
}
