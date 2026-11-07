
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KEY_VERSION = 1;
const PBKDF2_ITERATIONS = 600000;

// Convert bytes into Base64 for database storage.
function toBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

// Convert Base64 back into bytes.
function fromBase64(value) {
  const binary = atob(value);

  return Uint8Array.from(binary, (char) =>
    char.charCodeAt(0)
  );
}

// Generate cryptographically secure random bytes.
function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

// Import an AES-256-GCM key.
async function importAESKey(rawKey) {
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Derive a document-password key using PBKDF2.
async function derivePasswordKey(password, salt) {
  const passwordMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Derive an independent key from the recovery key.
async function deriveRecoveryWrappingKey(recoveryKey, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    recoveryKey,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("PrivateTextVault-Recovery-v1"),
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt a string using AES-GCM.
async function encryptText(text, key, additionalData) {
  const iv = randomBytes(12);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    encoder.encode(text)
  );

  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

// Decrypt a string using AES-GCM.
async function decryptText(
  ciphertext,
  iv,
  key,
  additionalData
) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(iv),
      additionalData: encoder.encode(additionalData),
      tagLength: 128,
    },
    key,
    fromBase64(ciphertext)
  );

  return decoder.decode(decrypted);
}

// Generate a document recovery key.
export function generateRecoveryKey() {
  return toBase64(randomBytes(32));
}

// Create a new encrypted document.
export async function encryptDocument({
  title,
  content,
  password,
  recoveryKey,
}) {
  if (!title || !password || !recoveryKey) {
    throw new Error(
      "Title, password and recovery key are required."
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Document password must contain at least 8 characters."
    );
  }

  const rawRecoveryKey = fromBase64(recoveryKey);

  if (rawRecoveryKey.length !== 32) {
    throw new Error("Invalid recovery key.");
  }

  // Generate a unique AES-256 document encryption key.
  const rawDocumentKey = randomBytes(32);
  const documentKey = await importAESKey(rawDocumentKey);

  // Encrypt title.
  const encryptedTitle = await encryptText(
    title,
    documentKey,
    `PTV:${KEY_VERSION}:title`
  );

  // Encrypt content.
  const encryptedContent = await encryptText(
    JSON.stringify(content),
    documentKey,
    `PTV:${KEY_VERSION}:content`
  );

  // Wrap document key with password.
  const passwordSalt = randomBytes(16);

  const passwordKey = await derivePasswordKey(
    password,
    passwordSalt
  );

  const passwordWrappedKey = await encryptText(
    toBase64(rawDocumentKey),
    passwordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  // Independently wrap document key with recovery key.
  const recoverySalt = randomBytes(16);

  const recoveryWrappingKey = await deriveRecoveryWrappingKey(
    rawRecoveryKey,
    recoverySalt
  );

  const recoveryWrappedKey = await encryptText(
    toBase64(rawDocumentKey),
    recoveryWrappingKey,
    `PTV:${KEY_VERSION}:recovery-wrap`
  );

  return {
    encrypted_title: encryptedTitle.ciphertext,
    encrypted_content: encryptedContent.ciphertext,

    title_iv: encryptedTitle.iv,
    content_iv: encryptedContent.iv,

    password_salt: toBase64(passwordSalt),
    password_wrapped_key: passwordWrappedKey.ciphertext,
    password_wrap_iv: passwordWrappedKey.iv,

    recovery_salt: toBase64(recoverySalt),
    recovery_wrapped_key: recoveryWrappedKey.ciphertext,
    recovery_wrap_iv: recoveryWrappedKey.iv,

    key_version: KEY_VERSION,
  };
}

// Open an encrypted document using its password.
export async function decryptDocument(row, password) {
  if (row.key_version !== KEY_VERSION) {
    throw new Error("Unsupported encryption version.");
  }

  const passwordKey = await derivePasswordKey(
    password,
    fromBase64(row.password_salt)
  );

  const rawDocumentKeyBase64 = await decryptText(
    row.password_wrapped_key,
    row.password_wrap_iv,
    passwordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  const documentKey = await importAESKey(
    fromBase64(rawDocumentKeyBase64)
  );

  const title = await decryptText(
    row.encrypted_title,
    row.title_iv,
    documentKey,
    `PTV:${KEY_VERSION}:title`
  );

  const contentJSON = await decryptText(
    row.encrypted_content,
    row.content_iv,
    documentKey,
    `PTV:${KEY_VERSION}:content`
  );

  return {
    title,
    content: JSON.parse(contentJSON),
  };
}

// Update an existing document while preserving its
// original password and recovery key.
export async function updateEncryptedDocument(
  row,
  { title, content, password }
) {
  if (row.key_version !== KEY_VERSION) {
    throw new Error("Unsupported encryption version.");
  }

  if (!title?.trim() || !password) {
    throw new Error(
      "Title and document password are required."
    );
  }

  // Derive the existing password key.
  const passwordKey = await derivePasswordKey(
    password,
    fromBase64(row.password_salt)
  );

  // Unlock the existing document encryption key.
  const rawDocumentKeyBase64 = await decryptText(
    row.password_wrapped_key,
    row.password_wrap_iv,
    passwordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  const documentKey = await importAESKey(
    fromBase64(rawDocumentKeyBase64)
  );

  // Encrypt updated title using a fresh IV.
  const encryptedTitle = await encryptText(
    title.trim(),
    documentKey,
    `PTV:${KEY_VERSION}:title`
  );

  // Encrypt updated content using a fresh IV.
  const encryptedContent = await encryptText(
    JSON.stringify(content),
    documentKey,
    `PTV:${KEY_VERSION}:content`
  );

  // Return only fields that need updating.
  // Existing password and recovery key wrappers are preserved.
  return {
    title: title.trim(),

    encrypted_title: encryptedTitle.ciphertext,
    encrypted_content: encryptedContent.ciphertext,

    title_iv: encryptedTitle.iv,
    content_iv: encryptedContent.iv,
  };
}

// Recover an encrypted document using its recovery key.
export async function recoverDocument(row, recoveryKey) {
  if (row.key_version !== KEY_VERSION) {
    throw new Error("Unsupported encryption version.");
  }

  const rawRecoveryKey = fromBase64(recoveryKey);

  if (rawRecoveryKey.length !== 32) {
    throw new Error("Invalid recovery key.");
  }

  const recoveryWrappingKey = await deriveRecoveryWrappingKey(
    rawRecoveryKey,
    fromBase64(row.recovery_salt)
  );

  const rawDocumentKeyBase64 = await decryptText(
    row.recovery_wrapped_key,
    row.recovery_wrap_iv,
    recoveryWrappingKey,
    `PTV:${KEY_VERSION}:recovery-wrap`
  );

  const documentKey = await importAESKey(
    fromBase64(rawDocumentKeyBase64)
  );

  const title = await decryptText(
    row.encrypted_title,
    row.title_iv,
    documentKey,
    `PTV:${KEY_VERSION}:title`
  );

  const contentJSON = await decryptText(
    row.encrypted_content,
    row.content_iv,
    documentKey,
    `PTV:${KEY_VERSION}:content`
  );

  return {
    title,
    content: JSON.parse(contentJSON),
  };
}


export async function changeDocumentPassword(
  row,
  oldPassword,
  newPassword
) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must contain at least 8 characters.");
  }

  const oldPasswordKey = await derivePasswordKey(
    oldPassword,
    fromBase64(row.password_salt)
  );

  const rawDocumentKeyBase64 = await decryptText(
    row.password_wrapped_key,
    row.password_wrap_iv,
    oldPasswordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  const newSalt = randomBytes(16);

  const newPasswordKey = await derivePasswordKey(
    newPassword,
    newSalt
  );

  const newWrappedKey = await encryptText(
    rawDocumentKeyBase64,
    newPasswordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  return {
    password_salt: toBase64(newSalt),
    password_wrapped_key: newWrappedKey.ciphertext,
    password_wrap_iv: newWrappedKey.iv,
  };
}

export async function resetDocumentPasswordWithRecoveryKey(
  row,
  recoveryKey,
  newPassword
) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must contain at least 8 characters.");
  }

  const rawRecoveryKey = fromBase64(recoveryKey);

  if (rawRecoveryKey.length !== 32) {
    throw new Error("Invalid recovery key.");
  }

  const recoveryWrappingKey = await deriveRecoveryWrappingKey(
    rawRecoveryKey,
    fromBase64(row.recovery_salt)
  );

  const rawDocumentKeyBase64 = await decryptText(
    row.recovery_wrapped_key,
    row.recovery_wrap_iv,
    recoveryWrappingKey,
    `PTV:${KEY_VERSION}:recovery-wrap`
  );

  const newSalt = randomBytes(16);

  const newPasswordKey = await derivePasswordKey(
    newPassword,
    newSalt
  );

  const newWrappedKey = await encryptText(
    rawDocumentKeyBase64,
    newPasswordKey,
    `PTV:${KEY_VERSION}:password-wrap`
  );

  return {
    password_salt: toBase64(newSalt),
    password_wrapped_key: newWrappedKey.ciphertext,
    password_wrap_iv: newWrappedKey.iv,
  };
}
