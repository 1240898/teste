import { AccessDecision, evaluateAccess } from '../../src/app/navigation/accessPolicy.js';
import { getSection } from '../../src/app/navigation/navigationPolicy.js';

const auth = (status, roles = []) => ({
  status,
  hasAnyRole: (...required) =>
    status === 'authenticated' &&
    (required.length === 0 || required.some((role) => roles.includes(role))),
});

const catalogue = getSection('catalogue');
const login = getSection('login');
const stock = getSection('stock');
const account = getSection('account');
const productsEdit = getSection('productsEdit');

describe('WEB03 UT06: access decision table (section 3.2)', () => {
  test.each([
    [catalogue, auth('guest'), AccessDecision.ALLOW],
    [catalogue, auth('loading'), AccessDecision.ALLOW],
    [login, auth('authenticated', ['CUSTOMER']), AccessDecision.REDIRECT_HOME],
    [login, auth('denied'), AccessDecision.REDIRECT_HOME],
    [login, auth('loading'), AccessDecision.PENDING],
    [login, auth('guest'), AccessDecision.ALLOW],
    [stock, auth('loading'), AccessDecision.PENDING],
    [stock, auth('guest'), AccessDecision.LOGIN_REQUIRED],
    [stock, auth('logoutPending'), AccessDecision.LOGIN_REQUIRED],
    [stock, auth('denied'), AccessDecision.ACCOUNT_DENIED],
    [stock, auth('authenticated', ['CUSTOMER']), AccessDecision.FORBIDDEN],
    [stock, auth('authenticated', ['EMPLOYEE']), AccessDecision.FORBIDDEN],
    [stock, auth('authenticated', ['ADMINISTRATOR']), AccessDecision.FORBIDDEN],
    [stock, auth('authenticated', ['MANAGER']), AccessDecision.ALLOW],
    [
      stock,
      auth('authenticated', ['CUSTOMER', 'MANAGER']),
      AccessDecision.ALLOW,
    ],
    [account, auth('authenticated', ['CUSTOMER']), AccessDecision.ALLOW],
    [account, auth('guest'), AccessDecision.LOGIN_REQUIRED],
    [
      productsEdit,
      auth('authenticated', ['EMPLOYEE']),
      AccessDecision.FORBIDDEN,
    ],
    [productsEdit, auth('authenticated', ['MANAGER']), AccessDecision.ALLOW],
  ])('%#: %o', (section, state, expected) => {
    expect(evaluateAccess(section, state)).toBe(expected);
  });

  test('a protected section without a confirmed session never allows, even if hasAnyRole lies', () => {
    const lying = { status: 'guest', hasAnyRole: () => true };
    expect(evaluateAccess(stock, lying)).toBe(AccessDecision.LOGIN_REQUIRED);
    expect(evaluateAccess(stock, undefined)).toBe(
      AccessDecision.LOGIN_REQUIRED,
    );
  });
});