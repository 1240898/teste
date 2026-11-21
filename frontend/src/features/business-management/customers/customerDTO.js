function parseRestrictions(value) {
  return typeof value === 'string' ? JSON.parse(value || '[]') : value;
}

export function customerToPayload(value, editing = false, baseForm = null) {
  const restrictions = parseRestrictions(value.dietaryRestrictions);
  const restrictionsChanged =
    !editing ||
    !baseForm ||
    JSON.stringify(restrictions) !==
      JSON.stringify(parseRestrictions(baseForm.dietaryRestrictions));

  return {
    name: value.name.trim(),
    phoneNumber: value.phoneNumber.trim(),
    email: value.email.trim(),
    ...(restrictionsChanged ? { dietaryRestrictions: restrictions } : {}),
    ...(restrictionsChanged && restrictions?.length && value.healthDataConsent
      ? { healthDataConsent: true }
      : {}),
    ...(value.userId ? { userId: value.userId.trim() } : {}),
  };
}

export function validateCustomerPayload(payload) {
  if (payload.dietaryRestrictions?.length && payload.healthDataConsent !== true)
    return 'managementCustomerConsentRequired';
  return null;
}

export function customerToForm(customer) {
  return {
    name: customer.name ?? '',
    phoneNumber: customer.phoneNumber ?? '',
    email: customer.email ?? '',
    dietaryRestrictions: JSON.stringify(
      customer.dietaryRestrictions ?? [],
      null,
      2,
    ),
    healthDataConsent: false,
    userId: customer.userId ?? '',
  };
}
