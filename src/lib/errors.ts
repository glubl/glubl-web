export class InvalidPairError extends Error {
  __proto__ = Error

  constructor(message: string = "Invalid keypair") {
    super(message);
    Object.setPrototypeOf(this, InvalidPairError.prototype);
  }

}

export class HashFail extends Error {
  constructor() {
    super("Object hash failed")
  }
}

export class SignFail extends Error {
  constructor() {
    super("Message signing failed")
  }
}

export class VerifyFail extends Error {
  constructor() {
    super("Sign verification failed")
  }
}

export class EncryptionFail extends Error {
  constructor() {
    super("Message encryption failed")
  }
}

export class DecriptionFail extends Error {
  constructor() {
    super("Message decyption failed")
  }
}

export class SharedCreationFail extends Error {
  constructor() {
    super("Shared key creation failed")
  }
}

export class Unauthenticated extends Error {
  constructor() {
    super("Not authenticated")
  }
}

export class ProfileNotSet extends Error {
  constructor() {
    super("User profile is not yet configured")
  }
}