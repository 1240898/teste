
const base = '/predefined-pizzas';
const one = (id) => `${base}/${encodeURIComponent(id)}`;

const isAbort = (error, signal) => error?.kind === 'aborted' || signal?.aborted;

/**
 * The catalogue answered 404 for this pizza: read the product (staff view) to
 * tell the manager why it is not offered (WEB05 design, offer handling).
 * - missing:     the product no longer exists
 * - inactive:    the product is deactivated
 * - notSellable: the product is not marked as sellable
 * - notOffered:  active and sellable, but the catalogue returned no offer
 *                (the 404 does not tell the cause)
 */
async function offerStatusFromProduct(request, id, signal) {
  try {
    const product = await request('GET', `/products/${encodeURIComponent(id)}`, {
      signal,
    });
    if (!product?.isActive) return 'inactive';
    if (!product.isSellable) return 'notSellable';
    return 'notOffered';
  } catch (error) {
    if (isAbort(error, signal)) throw error;
    return error?.status === 404 ? 'missing' : 'error';
  }
}

export function createPredefinedPizzaApi(request) {
  return Object.freeze({
    listPizzaProducts: async (signal) => {
      const products = await request('GET', '/products', {
        query: { isSellable: 'true', isActive: 'true' },
        signal,
      });
      return (products ?? []).filter(
        (product) => product.pricingMode === 'COMPONENT_BASED',
      );
    },
    listComponents: (signal) =>
      request('GET', '/products', {
        query: { isPizzaComponent: 'true', isActive: 'true' },
        signal,
      }),
    list: async (_query, signal) => {
      const [pizzas, availableComponents] = await Promise.all([
        request('GET', base, { signal }),
        request('GET', '/products', {
          query: { isPizzaComponent: 'true' },
          signal,
        }),
      ]);
      const componentsById = new Map(
        (availableComponents ?? []).map((product) => [product.id, product]),
      );
      return Promise.all(
        (pizzas ?? []).map(async (pizza) => {
          let offer = null;
          let offerStatus = 'available';
          try {
            offer = await request('GET', `/catalogue/${encodeURIComponent(pizza.id)}`, {
              signal,
            });
          } catch (error) {
            if (isAbort(error, signal)) throw error;
            offerStatus =
              error?.status === 404
                ? await offerStatusFromProduct(request, pizza.id, signal)
                : 'error';
          }
          return {
            ...pizza,
            offer,
            offerStatus,
            components: (pizza.componentIds ?? [])
              .map((id) => componentsById.get(id))
              .filter(Boolean),
          };
        }),
      );
    },
    getById: (id, signal) => request('GET', one(id), { signal }),
    create: (body) => request('POST', base, { body }),
    replace: (id, body) =>
      request('PUT', `${one(id)}/default-configuration`, { body }),
  });
}
