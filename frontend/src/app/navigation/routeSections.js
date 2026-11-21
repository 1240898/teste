// WEB03 (D1): route section references stay centralized in navigation policy.
import { getSection } from './navigationPolicy.js';

export const registrationSection = getSection('registration');
export const accountSection = getSection('account');
export const passwordSection = getSection('accountPassword');
export const passwordPath = passwordSection.path;
export const usersSection = getSection('users');
export const auditSection = getSection('securityAudit');
export const sharedResourcesSection = getSection('sharedResources');
export const catalogueSection = getSection('catalogue');
export const privacySection = getSection('privacyNotice');

// GDP01: the Customer's own data and consents.
export const myDataSection = getSection('myPrivacy');
