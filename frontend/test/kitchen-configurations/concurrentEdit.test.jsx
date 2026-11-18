/** @jest-environment jsdom */
import KitchenConfigurationEditorPage from '../../src/features/kitchen-configurations/pages/KitchenConfigurationEditorPage.jsx';
import { STALE_VERSION_MESSAGE } from '../../src/features/kitchen-configurations/kitchenConfigurationApi.js';
import {
  button,
  check,
  clickButton,
  detail,
  httpError,
  layout,
  mount,
  type,
} from './kitchenTestUtils.jsx';

/** Stateful in-memory API double: stores the record and checks the version like the back end. */
const clone = (value) => JSON.parse(JSON.stringify(value));

function statefulApi(initial) {
  let record = clone(initial);
  return {
    get record() {
      return record;
    },
    async getById() {
      return clone(record);
    },
    async update(_id, { name, content, version }) {
      if (version !== record.version)
        throw httpError(409, STALE_VERSION_MESSAGE);
      record = {
        ...record,
        name,
        content: clone(content),
        version: record.version + 1,
      };
      return clone(record);
    },
  };
}

let sessionA;
let sessionB;
beforeEach(() => {
  sessionA = mount();
  sessionB = mount();
});
afterEach(() => {
  sessionA.unmount();
  sessionB.unmount();
});

const textarea = (view) => view.container.querySelector('textarea');
const nameInput = (view) => view.container.querySelector('input:not([type])');
async function changeWidth(view, width) {
  const content = JSON.parse(textarea(view).value);
  content.kitchen.dimensions.width = width;
  await type(textarea(view), JSON.stringify(content, null, 2));
}

async function openBoth(api) {
  const initial = await api.getById();
  await sessionA.render(
    <KitchenConfigurationEditorPage api={api} mode="edit" initial={initial} />,
  );
  await sessionB.render(
    <KitchenConfigurationEditorPage api={api} mode="edit" initial={initial} />,
  );
}

describe('WEB06 concurrent edits (clarification 15)', () => {
  test('FT14 - A changes the width, B renames: both changes are stored', async () => {
    const api = statefulApi(detail({ content: layout() }));
    await openBoth(api);
    await changeWidth(sessionA, 14);
    await clickButton(sessionA.container, 'Save');
    expect(api.record.version).toBe(4);
    await type(nameInput(sessionB), 'Kitchen B');
    await clickButton(sessionB.container, 'Save');
    await clickButton(sessionB.container, 'Reload latest version');
    await clickButton(sessionB.container, 'Continue with the rebased version');
    await check(
      sessionB.container.querySelector('.kitchen-conflict__review input'),
    );
    await clickButton(sessionB.container, 'Save');
    expect(api.record).toMatchObject({ version: 5, name: 'Kitchen B' });
    expect(api.record.content.kitchen.dimensions.width).toBe(14);
  });

  test.each([
    ['Keep theirs', 14],
    ['Keep mine', 10],
  ])('FT15 - both change the width; %s', async (choice, expected) => {
    const api = statefulApi(detail({ content: layout() }));
    await openBoth(api);
    await changeWidth(sessionA, 14);
    await clickButton(sessionA.container, 'Save');
    await type(nameInput(sessionB), 'Kitchen B');
    await changeWidth(sessionB, 10);
    await clickButton(sessionB.container, 'Save');
    await clickButton(sessionB.container, 'Reload latest version');
    expect(
      button(sessionB.container, 'Continue with the rebased version').disabled,
    ).toBe(true);
    expect(button(sessionB.container, 'Save').disabled).toBe(true);
    await clickButton(sessionB.container, choice);
    await clickButton(sessionB.container, 'Continue with the rebased version');
    await check(
      sessionB.container.querySelector('.kitchen-conflict__review input'),
    );
    await clickButton(sessionB.container, 'Save');
    expect(api.record.version).toBe(5);
    expect(api.record.content.kitchen.dimensions.width).toBe(expected);
    expect(api.record.name).toBe('Kitchen B');
  });
});