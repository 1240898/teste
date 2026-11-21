export class ICustomerRepository {
  async nextId() {
    throw new Error('Not implemented');
  }
  async findById() {
    throw new Error('Not implemented');
  }
  async findByIdAndUserId(id, userId) {
    void id;
    void userId;
    throw new Error('Not implemented');
  }
  async findByEmail() {
    throw new Error('Not implemented');
  }
  async existsByEmail() {
    throw new Error('Not implemented');
  }
  async findByUserId() {
    throw new Error('Not implemented');
  }
  async save() {
    throw new Error('Not implemented');
  }
  async update() {
    throw new Error('Not implemented');
  }
  async updateOwnedContact() {
    throw new Error('Not implemented');
  }
  async search() {
    throw new Error('Not implemented');
  }
  async isReferencedByOtherEntities() {
    throw new Error('Not implemented');
  }
}
