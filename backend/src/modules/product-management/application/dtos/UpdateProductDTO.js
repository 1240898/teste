import { CreateProductDTO } from './CreateProductDTO.js';

/**
 * Input of PUT /api/v1/products/:id. Full-replacement semantics plus the
 * version read by the editor, used to reject stale writes.
 */
export class UpdateProductDTO extends CreateProductDTO {
  constructor(props = {}) {
    super(props);
    this.expectedUpdatedAt = props.expectedUpdatedAt;
  }
}
