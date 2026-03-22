import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const HASH_PREFIX = "scrypt";

/**
 * Hashes a plaintext password with scrypt and returns a self-contained encoded string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION
  })) as Buffer;

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
  const derivedKey = (await scrypt(password, salt, storedDerivedKey.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization)
  })) as Buffer;

  if (derivedKey.length !== storedDerivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedDerivedKey);
}
