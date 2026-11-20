export const pizzaSizeToPayload = ({ name }, editing) => ({
  name: name.trim(),
  ...(editing ? {} : {}),
});
export const pizzaSizeToForm = (size) => ({ name: size.name ?? '' });
