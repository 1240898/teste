import { CustomerResponseDTO } from '../dtos/CustomerDTO.js';
export class CustomerResponseMapper {
  static toDTO(customer) {
    return new CustomerResponseDTO({
      id: customer.id.getValue(),
      name: customer.name.getValue(),
      phoneNumber: customer.contactInfo.phoneNumber.getValue(),
      email: customer.contactInfo.email.getValue(),
      dietaryRestrictions: customer.dietaryRestrictions.map((x) => x.toJSON()),
      userId: customer.userId?.getValue() ?? null,
      active: customer.active,
    });
  }
  static toDTOList(customers) {
    return customers.map(CustomerResponseMapper.toDTO);
  }
}
