export function customerToPayload(value) {
  return {
    name: value.name.trim(),
    phoneNumber: value.phoneNumber.trim(),
    email: value.email.trim(),
    dietaryRestrictions:
      typeof value.dietaryRestrictions === 'string'
        ? JSON.parse(value.dietaryRestrictions || '[]')
        : value.dietaryRestrictions,
    ...(value.userId ? { userId: value.userId.trim() } : {}),
  };
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
    userId: customer.userId ?? '',
  };
}
