/** Input validated by the API schema before reaching the controller. */
export class RegisterUserDTO {
  constructor({ name, email, password, marketingConsent = false, phoneNumber }) {
    this.name = name;
    this.email = email;
    this.password = password;
    this.marketingConsent = marketingConsent;
    // stored in the customer record created with the account.
    this.phoneNumber = phoneNumber;
  }
}
