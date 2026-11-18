/**
 * The 14 allergens of EU Regulation No. 1169/2011 (Annex II). They bound the range of
 * AllergenId (domain model: AllergenId ..> EUAllergenType). The manager still chooses
 * the descriptive name shown to customers.
 */
export const EUAllergenType = Object.freeze({
  1: 'GLUTEN',
  2: 'CRUSTACEANS',
  3: 'EGGS',
  4: 'FISH',
  5: 'PEANUTS',
  6: 'SOYBEANS',
  7: 'MILK',
  8: 'NUTS',
  9: 'CELERY',
  10: 'MUSTARD',
  11: 'SESAME',
  12: 'SULPHITES',
  13: 'LUPIN',
  14: 'MOLLUSCS',
});

export const MIN_ALLERGEN_ID = 1;
export const MAX_ALLERGEN_ID = 14;