export class SecurityAuditService {
  constructor(repository) {
    this.repository = repository;
  }

  search(criteria) {
    return this.repository.search(criteria);
  }
}
