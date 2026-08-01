import { z } from 'zod'

/**
 * A Russian phone number after normalization: the country code is stripped, so
 * exactly 10 significant digits remain (area code `999` + 7 digits). Used by
 * {@link RU_PHONE_REGEX} to test the normalized form.
 */
const NORMALIZED_RU_PHONE_REGEX = /^9\d{9}$/

/**
 * Strips a Russian phone down to its 10 significant digits.
 *
 * Russian numbers arrive in many shapes — `+7 999 123-45-67`, `8 (999)
 * 123-45-67`, `89991234567` — so the format is normalized before validation:
 * drop every non-digit, then, if 11 digits long and the first digit is the
 * country/area code `7` or `8`, drop it. The result is the 10-digit national
 * significant number (NSN), e.g. `9991234567`.
 *
 * Returns the digits string (possibly empty / not 10 digits — validation is the
 * caller's job, e.g. {@link ruPhone}). Pure, no I/O.
 *
 * @example
 * normalizePhone('+7 999 123-45-67') // '9991234567'
 * normalizePhone('8 (999) 1234567')  // '9991234567'
 * normalizePhone('12345')            // '12345'
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) {
    return digits.slice(1)
  }
  return digits
}

/**
 * Zod schema for a Russian phone number.
 *
 * Accepts the user-facing form (`+7 ...`, `8 ...`, spaces, parentheses, dashes)
 * and validates it by normalizing to the 10-digit NSN and testing against the
 * mobile numbering plan (`9`-prefixed area code + 7 digits). Used identically by
 * the checkout form (live feedback), the server function (authoritative check)
 * and — transitively, via {@link createOrderDataSchema} — the API route, so the
 * rule lives in exactly one place and cannot drift across boundaries.
 *
 * The stored value is **not** normalized by the schema (it preserves what the
 * user typed); callers that want a canonical form should pass the value through
 * {@link normalizePhone} (or format it) before persistence.
 */
export const ruPhone = z
  .string()
  .trim()
  .min(1, 'Укажите номер телефона')
  .refine((value) => NORMALIZED_RU_PHONE_REGEX.test(normalizePhone(value)), {
    message: 'Укажите корректный номер телефона',
  })
