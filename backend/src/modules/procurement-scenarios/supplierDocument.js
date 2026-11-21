import { InputError } from '../planning-inputs/domain/InputError.js';
import { supplierDocumentSchema } from '../planning-inputs/api/supplierDocumentSchema.js';

export function inspectSupplierDocument(document, products) {
  const { error } = supplierDocumentSchema
    .required()
    .validate(document, { convert: false });
  if (error) {
    const issue = error.details[0];
    throw new InputError(
      'INVALID_SUPPLIER_DOCUMENT',
      issue.message,
      422,
      issue.path.join('.'),
    );
  }
  const references = new Map(
    products.map((product) => [product.productId, product]),
  );
  const suppliers = new Set(document.suppliers.map((supplier) => supplier.id));
  const offered = new Set();
  for (const [index, line] of document.products.entries()) {
    const path = 'products.' + index;
    const product = references.get(line.productId);
    if (!product)
      throw new InputError(
        'UNKNOWN_PRODUCT',
        'Choose a product from the export.',
        422,
        path + '.productId',
        line.productId,
      );
    if (product.stockUnit !== line.stockUnit)
      throw new InputError(
        'INCOMPATIBLE_UNITS',
        'Use the exported stock unit.',
        422,
        path + '.stockUnit',
        line.productId,
      );
    for (const [i, offer] of line.offers.entries()) {
      if (!suppliers.has(offer.supplierId))
        throw new InputError(
          'UNKNOWN_SUPPLIER',
          'List this supplier in the suppliers array.',
          422,
          path + '.offers.' + i + '.supplierId',
          offer.supplierId,
        );
      offered.add(line.productId);
    }
  }
  return products.filter((product) => !offered.has(product.productId));
}
