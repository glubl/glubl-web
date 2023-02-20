export class InvalidPairError extends Error {
  __proto__ = Error

  constructor(message: string = "Invalid keypair") {
    super(message);
    Object.setPrototypeOf(this, InvalidPairError.prototype);
  }

}

export class NotAuthenticated extends Error {
  constructor() {
    super("Not authenticated")
  }
}

export class SharedCreationFail extends Error {
  constructor() {
    super("Shared private key creation faied")
  }
}

export class HashFail extends Error {
  constructor() {
    super("Object hash failed")
  }
}