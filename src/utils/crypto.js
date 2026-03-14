export const generateId = () => crypto.randomUUID();
export const generateSalt = () => crypto.randomUUID();

export const hashPassword = async (password, salt) => {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]
  );
  const buffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const comparePasswords = async (plainPassword, hashedPassword, salt) => {
  const attempt = await hashPassword(plainPassword, salt);
  return attempt === hashedPassword;
};