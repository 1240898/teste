import { CreateProductDTO } from './CreateProductDTO.js';

/**
 * Input of PUT /api/v1/products/:id. Full-replacement semantics: same fields as
 * create. `isActive` is not editable here (DELETE / PATCH .../activate).
 */
export class UpdateProductDTO extends CreateProductDTO {}