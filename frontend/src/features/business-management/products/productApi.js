const base = '/products';
const one = (id) => `${base}/${encodeURIComponent(id)}`;
export function createProductApi(request) {
  return Object.freeze({
    listCategories: (signal) => request('GET', '/categories', { signal }),
    listAllergens: (signal) => request('GET', '/allergens', { signal }),
    listComponentTypes: (signal) =>
      request('GET', '/pizza-component-types', { signal }),
    listCompositionProducts: (signal) =>
      request('GET', base, {
        query: { isPizzaComponent: 'true', isActive: 'true' },
        signal,
      }),
    list: async (query, signal) => {
      // Reference data is cached only for this list read. A later refresh must
      // re-read components so direct and derived allergens cannot go stale.
      const referenceCache = new Map();
      const resolve = async (product, path = new Set()) => {
        if (path.has(product.id)) return [];
        const nextPath = new Set(path).add(product.id);
        const allergens = new Set();
        for (const component of product.compositionItems ?? []) {
          let childPromise = referenceCache.get(component.productId);
          if (!childPromise) {
            childPromise = request('GET', one(component.productId), { signal });
            referenceCache.set(component.productId, childPromise);
          }
          const child = await childPromise;
          (child.allergenIds ?? []).forEach((id) => allergens.add(id));
          (await resolve(child, nextPath)).forEach((id) => allergens.add(id));
        }
        return [...allergens].sort((a, b) => a - b);
      };
      const normalizedQuery = {
        ...query,
        ...(Array.isArray(query?.excludeAllergenIds)
          ? { excludeAllergenIds: query.excludeAllergenIds.join(',') }
          : {}),
      };
      const products = await request('GET', base, {
        query: normalizedQuery,
        signal,
      });
      return Promise.all(
        (products ?? []).map(async (product) => ({
          ...product,
          derivedAllergenIds: await resolve(product),
        })),
      );
    },
    getById: (id, signal) => request('GET', one(id), { signal }),
    create: (body) => request('POST', base, { body }),
    update: (id, body) => request('PUT', one(id), { body }),
    deactivate: (id) => request('DELETE', one(id)),
    activate: (id) => request('PATCH', `${one(id)}/activate`),
  });
}
