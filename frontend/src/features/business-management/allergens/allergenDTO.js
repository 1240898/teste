export const allergenToPayload = (value, editing) =>
  editing
    ? { name: value.name.trim() }
    : { id: Number(value.id), name: value.name.trim() };
