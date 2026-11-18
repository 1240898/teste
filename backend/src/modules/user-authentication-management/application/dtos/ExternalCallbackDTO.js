/** AA02: callback input validated by the API schema before reaching the controller. */
export class ExternalCallbackDTO {
  constructor({ code, state }) {
    this.code = code;
    this.state = state;
  }
}