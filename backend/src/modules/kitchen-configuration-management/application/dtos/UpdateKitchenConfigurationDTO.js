/** Body of PUT /kitchen-configurations/{id}: version = the one that was loaded (BR 12). */
export class UpdateKitchenConfigurationDTO {
  constructor({ name, content, version } = {}) {
    this.name = name;
    this.content = content;
    this.version = version;
  }
}