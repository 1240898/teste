import { AppError } from '../../../../shared/errors/AppError.js';
import { Customer } from '../../domain/model/Customer.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  DietaryRestriction,
  LinkedUserId,
  CustomerSearchCriteria,
} from '../../domain/model/values.js';
import { CustomerResponseMapper } from '../mapping/CustomerResponseMapper.js';
const found = (c) => {
  if (!c) throw new AppError('Customer not found', 404);
  return c;
};
// Each restriction may relate to one BCK04 allergen (allergenId 1..14, optional).
const toRestrictions = (values) =>
  (values ?? []).map((x) =>
    DietaryRestriction.create(x.name, x.description, x.allergenId),
  );
async function validateUserLink(repository, userDirectory, userId, email, customerId) {
  const user = await userDirectory.findById(userId);
  if (!user) throw new AppError('Referenced user not found', 400);
  if (!user.active)
    throw new AppError('Referenced user must be active', 400);
  if (!user.roles.includes('CUSTOMER'))
    throw new AppError('Referenced user must have the CUSTOMER role', 400);
  if (user.email.toLowerCase() !== email)
    throw new AppError('Customer email must match the linked user email', 400);
  const linked = await repository.findByUserId(userId);
  if (linked && linked.id.getValue() !== customerId)
    throw new AppError('User already linked to another customer', 409);
}
export class CustomerService {
  constructor(repository, userDirectory) {
    Object.assign(this, { repository, userDirectory });
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
    const customer = Customer.create(
      CustomerId.create(await this.repository.nextId()),
      name,
      contact,
      restrictions,
      userId,
    );
    return CustomerResponseMapper.toDTO(await this.repository.save(customer));
  }
  async update(id, dto) {
    const customer = found(
      await this.repository.findById(CustomerId.create(id)),
    );
    const name = CustomerName.create(dto.name),
      contact = ContactInfo.create(dto.email, dto.phoneNumber);
    const other = await this.repository.findByEmail(contact.email.getValue());
    if (other && other.id.getValue() !== customer.id.getValue())
      throw new AppError('Email already registered', 409);
    customer.updateName(name);
    customer.updateContactInfo(contact);
    customer.replaceDietaryRestrictions(toRestrictions(dto.dietaryRestrictions));
    if (dto.userId == null) customer.unlinkUser();
    else {
      await validateUserLink(
        this.repository,
        this.userDirectory,
        dto.userId,
        contact.email.getValue(),
        customer.id.getValue(),
      );
      customer.linkUser(LinkedUserId.create(dto.userId));
    }
    return CustomerResponseMapper.toDTO(await this.repository.save(customer));
  }
  async getById(id) {
    return CustomerResponseMapper.toDTO(
      found(await this.repository.findById(CustomerId.create(id))),
    );
  }
  async search(criteria) {
    return CustomerResponseMapper.toDTOList(
      await this.repository.search(
        CustomerSearchCriteria.create(criteria).getValue(),
      ),
    );
  }
  async deactivate(id) {
    const c = found(await this.repository.findById(CustomerId.create(id)));
    c.deactivate();
    await this.repository.save(c);
  }
  async activate(id) {
    const c = found(await this.repository.findById(CustomerId.create(id)));
    c.activate();
    await this.repository.save(c);
  }
}