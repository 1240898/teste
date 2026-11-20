const products = '/products';
const configs = (productId) =>
  `${products}/${encodeURIComponent(productId)}/component-configurations`;
const one = (productId, sizeId) =>
  `${configs(productId)}/${encodeURIComponent(sizeId)}`;
export function createComponentConfigurationApi(request) {
  return Object.freeze({
    listProducts: (signal) =>
      request('GET', '/products', {
        query: { isPizzaComponent: 'true', isActive: 'true' },
        signal,
      }),
    listSizes: (signal) =>
      request('GET', '/pizza-sizes', { query: { active: 'true' }, signal }),
    list: async (query, signal) => {
      if (!query?.productId) return [];
      const value = await request('GET', configs(query.productId), { signal });
      return Array.isArray(value) ? value : [];
    },
    getById: async (key) => {
      const [productId, sizeId] = key.split('|');
      const items = await request('GET', configs(productId));
      return items.find((item) => item.sizeId === sizeId);
    },
    create: ({ productId, sizeId, ...body }) =>
      request('POST', one(productId, sizeId), { body }),
    update: (key, body) => {
      const [productId, sizeId] = key.split('|');
      return request('PATCH', one(productId, sizeId), { body });
    },
  });
}
