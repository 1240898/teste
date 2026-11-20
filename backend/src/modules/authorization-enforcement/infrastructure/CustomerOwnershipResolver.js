/** Resolves a Customer linked to the authenticated actor and compares IDs. */
export class CustomerOwnershipResolver {
  constructor(customerRepository) {
    if (typeof customerRepository?.findByUserId !== 'function')
      throw new TypeError('A customer repository is required');
    this.customerRepository = customerRepository;
  }

  async isOwner(actor, resourceId) {
    const customer = await this.customerRepository.findByUserId(actor.sub);
    return customer?.id?.getValue?.() === resourceId;
  }
}
