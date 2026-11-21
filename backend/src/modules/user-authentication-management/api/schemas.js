import Joi from 'joi';

const email = Joi.string()
  .trim()
  .lowercase()
  .max(254)
  .email({ tlds: { allow: false } })
  .required();
const password = Joi.string()
  .min(1)
  .max(72)
  .required()
  .custom((value, helpers) =>
    Buffer.byteLength(value, 'utf8') <= 72 && !value.includes('\0')
      ? value
      : helpers.error('any.invalid'),
  );
const newPassword = password
  .min(12)
  .custom((value, helpers) =>
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
      ? value
      : helpers.error('any.invalid'),
  );
const passwordCandidate = Joi.string()
  .min(1)
  .max(72)
  .required()
  .custom((value, helpers) =>
    Buffer.byteLength(value, 'utf8') <= 72 && !value.includes('\0')
      ? value
      : helpers.error('any.invalid'),
  );
const activationMethod = Joi.string().valid('LOCAL', 'EXTERNAL');
const activationToken = Joi.string()
  .length(43)
  .pattern(/^[A-Za-z0-9_-]+$/)
  .required();
export const schemas = {
  register: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    email,
    password: newPassword,
    marketingConsent: Joi.boolean().strict().default(false),
    // required in the customer record (client clarification).
    phoneNumber: Joi.string().trim().max(32).required(),
  }).unknown(false),
   // GDP01 (G4): the authenticated user gives or withdraws marketing consent.
  marketingConsent: Joi.object({
    marketingConsent: Joi.boolean().strict().required(),
  }).unknown(false),
  login: Joi.object({ email, password }).unknown(false),
  recoveryRequest: Joi.object({ email }).unknown(false),
  recoveryComplete: Joi.object({
    linkToken: Joi.string().min(1).max(256).required(),
    newPassword: passwordCandidate,
  }).unknown(false),
  passwordChange: Joi.object({
    currentPassword: passwordCandidate,
    newPassword: passwordCandidate,
  }).unknown(false),
  // AA02: Google redirect values forwarded by the SPA; unknown fields rejected.
  googleCallback: Joi.object({
    code: Joi.string().min(1).max(2048).required(),
    state: Joi.string()
      .min(16)
      .max(256)
      .pattern(/^[A-Za-z0-9_-]+$/)
      .required(),
  }).unknown(false),
  roles: Joi.object({
    roles: Joi.array()
      .items(
        Joi.string().valid('ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'),
      )
      .required(),
  }).unknown(false),
  inviteWorker: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    email,
    role: Joi.string()
      .valid('ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER')
      .required(),
    activationMethod: activationMethod.required(),
  }).unknown(false),
  invitationReplacement: Joi.object({
    activationMethod,
  }).unknown(false),
  userList: Joi.object({
    includeInactive: Joi.boolean().truthy('true').falsy('false').default(false),
  }).unknown(false),
  activation: Joi.object({
    active: Joi.boolean().valid(true).required(),
  }).unknown(false),
  activationInvitation: Joi.object({ token: activationToken }).unknown(false),
  localActivation: Joi.object({
    token: activationToken,
    password: passwordCandidate.optional(),
  }).unknown(false),
};
