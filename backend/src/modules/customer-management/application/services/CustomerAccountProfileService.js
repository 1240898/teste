import { AppError } from '../../../../shared/errors/AppError.js';
import { Customer } from '../../domain/model/Customer.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  LinkedUserId,
} from '../../domain/model/values.js';

/**
 * GDP01 (gap G2): creates the customer record of a new local account, inside the
 * registration transaction. Exposed to the authentication module through its
 * `customerProfiles` port; the composition root wires it in.
 */
export class CustomerAccountProfileService {
  constructor(repository) {
    this.repository = repository;
  }

  /** Validates the phone number before the account is persisted (HTTP 400). */
  validatePhoneNumber(email, phoneNumber) {
    ContactInfo.create(email, phoneNumber);
  }

  async createForNewAccount({ userId, name, email, phoneNumber }, tx = null) {
    const contact = ContactInfo.create(email, phoneNumber);
    const existing = await this.repository.findByEmail(
      contact.email.getValue(),
      tx,
    );
    if (existing) {
      if (existing.userId) throw new AppError('Email already registered', 409);
      // A record created by the Manager for this e-mail is left untouched: the
      // registrant has not yet proven control of the e-mail. It is linked when the
      // activated account completes its profile (POST /customers/me).
      return null;
    }
    const customer = Customer.create(
      CustomerId.create(await this.repository.nextId(tx)),
      CustomerName.create(name),
      contact,
      [],
      LinkedUserId.create(userId),
    );
    return this.repository.save(customer, tx);
  }
}