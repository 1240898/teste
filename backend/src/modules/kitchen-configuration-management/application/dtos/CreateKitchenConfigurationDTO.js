/** Body of POST /kitchen-configurations (create and import, SD 1). */
export class CreateKitchenConfigurationDTO {
  constructor({ name, content } = {}) {
    this.name = name;
    this.content = content;
  }
}