import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const HASH_PREFIX = "scrypt";

/** Derives a scrypt key using the configured work factors and resolves to a Buffer. */
function deriveScryptKey(password: string, salt: Buffer, keyLength: number, cost: number, blockSize: number, parallelization: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: cost,
        r: blockSize,
        p: parallelization
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      }
    );
  });
}

/**
 * Hashes a plaintext password with scrypt and returns a self-contained encoded string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveScryptKey(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION
  );

  return [
    HASH_PREFIX,
    SCRYPT_COST.toString(),
    SCRYPT_BLOCK_SIZE.toString(),
    SCRYPT_PARALLELIZATION.toString(),
    salt.toString("hex"),
    derivedKey.toString("hex")
  ].join("$");
}

/**
 * Verifies a plaintext password against a stored scrypt-encoded password hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [prefix, cost, blockSize, parallelization, saltHex, hashHex] = storedHash.split("$");

  if (
    prefix !== HASH_PREFIX ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !saltHex ||
    !hashHex
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const storedDerivedKey = Buffer.from(hashHex, "hex");
  const derivedKey = await deriveScryptKey(
    password,
    salt,
    storedDerivedKey.length,
    Number(cost),
    Number(blockSize),
    Number(parallelization)
  );

  if (derivedKey.length !== storedDerivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedDerivedKey);
}
