import {
  SECTIONS,
  findSectionByPath,
  getVisibleSections,
  isSectionEnabled,
} from '../../src/app/navigation/navigationPolicy.js';

const modules = {
  kitchenConfigurations: () => Promise.resolve({ default: () => null }),
};
const auth = (...roles) => ({
  status: 'authenticated',
  hasAnyRole: (...allowed) => allowed.some((role) => roles.includes(role)),
});

describe('WEB06 navigation (FT08, ALN-3)', () => {
  test('the section is enabled by its loader and covers new / :configurationId', () => {
    const section = SECTIONS.find(
      (item) => item.id === 'kitchenConfigurations',
    );
    expect(isSectionEnabled(section, {})).toBe(false);
    expect(isSectionEnabled(section, modules)).toBe(true);
    for (const path of [
      '/kitchen/configurations',
      '/kitchen/configurations/new',
      '/kitchen/configurations/KCF-00002',
    ])
      expect(findSectionByPath(path)).toMatchObject({
        id: 'kitchenConfigurations',
        roles: ['MANAGER'],
      });
  });

  test('only the Manager sees it in the menu', () => {
    const visible = (who) =>
      getVisibleSections(who, { modules }).some(
        (item) => item.id === 'kitchenConfigurations',
      );
    expect(visible(auth('MANAGER'))).toBe(true);
    expect(visible(auth('EMPLOYEE'))).toBe(false);
    expect(visible(auth('CUSTOMER'))).toBe(false);
    expect(visible({ status: 'guest' })).toBe(false);
  });
});