/** Application port for checking whether an actor owns a resource. */
export class IOwnershipResolver {
  async isOwner(_actor, _resourceId) {
    throw new Error('Not implemented');
  }
}
