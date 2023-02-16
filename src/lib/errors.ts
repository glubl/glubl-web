export class InvalidPairError extends Error {
  __proto__ = Error

  constructor(message: string = "Invalid keypair") {
    super(message);
    Object.setPrototypeOf(this, InvalidPairError.prototype);
  }

}