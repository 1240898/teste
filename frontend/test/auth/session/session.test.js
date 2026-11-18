import { renderToStaticMarkup } from 'react-dom/server';
import SessionPanel from '../../../src/features/authentication/components/SessionPanel.jsx';
import { LocaleContext } from '../../../src/shared/locale/localeContext.js';
import { translate } from '../../../src/shared/locale/messages.js';
import {
  roleLabels,
  signedInMessage,
  SIGNED_OUT_MESSAGE,
  SIGN_IN_TEXTS,
} from '../../../src/features/authentication/session.js';

const session = {
  accessToken: 'token',
  tokenType: 'Bearer',
  user: {
    id: 'USR-00042',
    name: 'Ana Silva',
    email: 'ana.silva@gmail.com',
    roles: ['CUSTOMER'],
  },
};

function renderInEnglish(panel) {
  return renderToStaticMarkup(
    <LocaleContext.Provider
      value={{ t: (key, values) => translate('en-GB', key, values) }}
    >
      {panel}
    </LocaleContext.Provider>,
  );
}

describe('AA02 signed-in feedback in the SPA', () => {
  it('shows Table 1 role names instead of internal values', () => {
    expect(roleLabels(['CUSTOMER'])).toEqual(['Customer']);
    expect(roleLabels(['MANAGER', 'EMPLOYEE'])).toEqual([
      'LaPrizza Manager',
      'Restaurant Staff',
    ]);
    expect(roleLabels(['ADMINISTRATOR'])).toEqual(['Administrator']);
    expect(roleLabels(['UNKNOWN'])).toEqual(['UNKNOWN']);
    expect(roleLabels()).toEqual([]);
  });

  it('renders who is signed in and the role; logout lives in the header', () => {
    const html = renderInEnglish(<SessionPanel session={session} />);
    expect(html).toContain(signedInMessage(session.user));
    expect(html).toContain('You are signed in as Ana Silva.');
    expect(html).toContain('ana.silva@gmail.com');
    expect(html).toContain('Customer');
    expect(html).not.toContain('Log out');
    expect(html).not.toContain('Change password');
    expect(html).not.toContain('token');
  });

  it('offers password change for a session with a local credential', () => {
    const html = renderInEnglish(
      <SessionPanel
        session={{ ...session, hasLocalCredential: true }}
        onChangePassword={() => {}}
      />,
    );
    expect(html).toContain('Change password');
  });

  it('explains Google registration and logout scope', () => {
    expect(SIGN_IN_TEXTS.googleHint).toMatch(/created automatically/);
    expect(SIGNED_OUT_MESSAGE).toMatch(/logged out of LaPrizza/);
    expect(SIGNED_OUT_MESSAGE).toMatch(/Google account/);
  });
});
