import { AppError } from '../../../../shared/errors/AppError.js';

export function validatePassword(password, { status = 400 } = {}) {
  const characterCount =
    typeof password === 'string' ? Array.from(password).length : 0;
  const meetsCharacterClasses =
    typeof password === 'string' &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
  if (
    typeof password !== 'string' ||
    characterCount < 12 ||
    Buffer.byteLength(password, 'utf8') > 72 ||
    password.includes('\0') ||
    !meetsCharacterClasses
  )
    throw new AppError(
      'Password must contain at least 12 characters, an uppercase letter, a lowercase letter, a digit and a special character, and at most 72 UTF-8 bytes',
      status,
    );
}

export function validatePasswordChange(
  currentPassword,
  newPassword,
  { status = 422 } = {},
) {
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string')
    throw new AppError('Invalid password change request', status);
  const previous = Array.from(currentPassword);
  const next = Array.from(newPassword);
  let previousRow = Array.from(
    { length: next.length + 1 },
    (_, index) => index,
  );

  for (let row = 1; row <= previous.length; row += 1) {
    const currentRow = [row];
    for (let column = 1; column <= next.length; column += 1) {
      const substitutionCost = previous[row - 1] === next[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        previousRow[column] + 1,
        currentRow[column - 1] + 1,
        previousRow[column - 1] + substitutionCost,
      );
    }
    previousRow = currentRow;
  }

  if (previousRow[next.length] < 4)
    throw new AppError(
      'The new password must differ from the current password by at least four characters',
      status,
    );
}
