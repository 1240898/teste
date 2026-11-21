import { AppError } from '../../../../shared/errors/AppError.js';
import { Customer } from '../../domain/model/Customer.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  DietaryRestriction,
  HealthDataConsent,
  LinkedUserId,
  CustomerSearchCriteria,
} from '../../domain/model/values.js';
import { CustomerResponseMapper } from '../mapping/CustomerResponseMapper.js';

// GDP01 / AA02 clarification: a Customer account without a customer record (e.g. the
// first Google sign-in) must provide its phone number before using customer features.
export const CUSTOMER_PROFILE_REQUIRED = 'Customer profile not completed';

const found = (c) => {
  if (!c) throw new AppError('Customer not found', 404);
  return c;
};
// Each restriction may relate to one BCK04 allergen (allergenId 1..14, optional).
const toRestrictions = (values) =>
  (values ?? []).map((x) =>
    DietaryRestriction.create(x.name, x.description, x.allergenId),
  );
async function validateUserLink(
  repository,
  userDirectory,
  userId,
  email,
  customerId,
  { allowInactive = false, tx } = {},
) {
  const user = await userDirectory.findById(userId, tx);
  if (!user) throw new AppError('Referenced user not found', 400);
  // An existing link to an account awaiting activation (local registration) is kept.
  if (!user.active && !allowInactive)
    throw new AppError('Referenced user must be active', 400);
  if (!user.roles.includes('CUSTOMER'))
    throw new AppError('Referenced user must have the CUSTOMER role', 400);
  if (user.email.toLowerCase() !== email)
    throw new AppError('Customer email must match the linked user email', 400);
  const linked = await repository.findByUserId(userId, tx);
  if (linked && linked.id.getValue() !== customerId)
    throw new AppError('User already linked to another customer', 409);
}
export class CustomerService {
  constructor(repository, userDirectory, allergenCatalogue = null) {
    Object.assign(this, { repository, userDirectory, allergenCatalogue });
  }
  async create(dto) {
    const name = CustomerName.create(dto.name),
      contact = ContactInfo.create(dto.email, dto.phoneNumber);
    if (await this.repository.existsByEmail(contact.email.getValue()))
      throw new AppError('Email already registered', 409);
    let userId = null;
    if (dto.userId != null) {
      await validateUserLink(
        this.repository,
        this.userDirectory,
        dto.userId,
        contact.email.getValue(),
      );
      userId = LinkedUserId.create(dto.userId);
    }
    const restrictions = toRestrictions(dto.dietaryRestrictions);
    // GDP01: the Manager records the customer's explicit consent (Art. 9(2)(a)).
    const consent =
      dto.healthDataConsent === true
        ? HealthDataConsent.grant()
        : HealthDataConsent.none();
    const customer = Customer.create(
      CustomerId.create(await this.repository.nextId()),
      name,
      contact,
      restrictions,
      userId,
      consent,
    );
    return CustomerResponseMapper.toDTO(await this.repository.save(customer));
  }
  async update(id, dto) {
    const saved = await this.repository.update(
      CustomerId.create(id),
      async (record, tx) => {
        const customer = found(record);
        const name = CustomerName.create(dto.name);
        const contact = ContactInfo.create(dto.email, dto.phoneNumber);
        const other = await this.repository.findByEmail(
          contact.email.getValue(),
          tx,
        );
        if (other && other.id.getValue() !== customer.id.getValue())
          throw new AppError('Email already registered', 409);
        customer.updateName(name);
        customer.updateContactInfo(contact);
        if (dto.healthDataConsent === true) customer.giveHealthDataConsent();
        if (dto.healthDataConsent === false)
          customer.withdrawHealthDataConsent();
        if (dto.dietaryRestrictions !== undefined)
          customer.replaceDietaryRestrictions(
            toRestrictions(dto.dietaryRestrictions),
          );
        if (dto.userId == null) customer.unlinkUser();
        else {
          const sameLink =
            customer.userId?.getValue() === dto.userId.trim().toUpperCase();
          await validateUserLink(
            this.repository,
            this.userDirectory,
            dto.userId,
            contact.email.getValue(),
            customer.id.getValue(),
            { allowInactive: sameLink, tx },
          );
          customer.linkUser(LinkedUserId.create(dto.userId));
        }
        return customer;
      },
    );
    return CustomerResponseMapper.toDTO(saved);
  }
  async getById(id, actor) {
    const customerId = CustomerId.create(id);
    const isManager = actor?.roles?.includes('MANAGER') === true;
    const customer = isManager
      ? await this.repository.findById(customerId)
      : await this.repository.findByIdAndUserId(customerId, actor?.sub);
    if (!customer) {
      const error = new AppError('Customer not found', 404);
      if (!isManager) error.authorizationOutcome = 'OWNERSHIP_DENIED';
      throw error;
    }
    return CustomerResponseMapper.toDTO(customer);
  }
  async search(criteria) {
    return CustomerResponseMapper.toDTOList(
      await this.repository.search(
        CustomerSearchCriteria.create(criteria).getValue(),
      ),
    );
  }
  async deactivate(id) {
    await this.repository.update(CustomerId.create(id), (record) => {
      const customer = found(record);
      customer.deactivate();
      return customer;
    });
  }
  async activate(id) {
    await this.repository.update(CustomerId.create(id), (record) => {
      const customer = found(record);
      customer.activate();
      return customer;
    });
  }

  async getMine(actor) {
    return CustomerResponseMapper.toDTO(await this.#mine(actor));
  }

  /**
   * Completes the profile of an account without a customer record (AA02 first
   * sign-in). A record the Manager created earlier for the same e-mail is linked:
   * the caller is an active account, so control of that e-mail was already proven
   * (activation invitation or verified Google e-mail).
   */
  async completeMine(actor, dto) {
    if (await this.repository.findByUserId(actor.sub))
      throw new AppError('Customer profile already exists', 409);
    const user = await this.userDirectory.findById(actor.sub);
    if (!user?.active) throw new AppError('Account not found', 404);
    const contact = ContactInfo.create(user.email, dto.phoneNumber);
    const existing = await this.repository.findByEmail(
      contact.email.getValue(),
    );
    if (existing) {
      const saved = await this.repository.update(existing.id, (record) => {
        const customer = found(record);
        if (customer.userId)
          throw new AppError('User already linked to another customer', 409);
        if (customer.contactInfo.email.getValue() !== contact.email.getValue())
          throw new AppError(
            'Customer email changed; retry profile completion',
            409,
          );
        customer.updateContactInfo(contact);
        customer.linkUser(LinkedUserId.create(actor.sub));
        return customer;
      });
      return CustomerResponseMapper.toDTO(saved);
    }
    const customer = Customer.create(
      CustomerId.create(await this.repository.nextId()),
      CustomerName.create(user.name),
      contact,
      [],
      LinkedUserId.create(actor.sub),
    );
    return CustomerResponseMapper.toDTO(await this.repository.save(customer));
  }

  /** Name and phone number; the e-mail stays the account's e-mail. */
  async updateMine(actor, dto) {
    const customer = await this.#mine(actor);
    const name = CustomerName.create(dto.name);
    const contact = ContactInfo.create(
      customer.contactInfo.email.getValue(),
      dto.phoneNumber,
    );
    const saved = await this.repository.updateOwnedContact(
      customer.id,
      actor.sub,
      name,
      contact.phoneNumber,
    );
    if (!saved) throw new AppError(CUSTOMER_PROFILE_REQUIRED, 404);
    return CustomerResponseMapper.toDTO(saved);
  }

  async updateMyAllergens(actor, dto) {
    const current = await this.#mine(actor);
    const ids = [...new Set(dto.allergenIds ?? [])];
    const hasConsent = dto.healthDataConsent === true;
    if (!hasConsent && ids.length)
      throw new AppError(
        'Explicit consent is required to store allergen or dietary information',
        400,
      );
    const allergens = hasConsent
      ? await this.allergenCatalogue.findByIds(ids)
      : [];
    if (allergens.length !== ids.length)
      throw new AppError('Referenced allergen not found', 400);
    const saved = await this.repository.update(current.id, (customer) => {
      if (customer?.userId?.getValue() !== actor.sub)
        throw new AppError(CUSTOMER_PROFILE_REQUIRED, 404);
      if (hasConsent) {
        customer.giveHealthDataConsent();
        customer.replaceAllergenRestrictions(
          [...allergens]
            .sort((a, b) => a.id - b.id)
            .map((a) => DietaryRestriction.create(a.name, null, a.id)),
        );
      } else {
        customer.withdrawHealthDataConsent();
      }
      return customer;
    });
    return CustomerResponseMapper.toDTO(saved);
  }

  async #mine(actor) {
    const customer = await this.repository.findByUserId(actor.sub);
    if (!customer) throw new AppError(CUSTOMER_PROFILE_REQUIRED, 404);
    return customer;
  }
}
