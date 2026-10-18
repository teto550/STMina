// Which section an account belongs to, and what to do when it opens the other one. Pure: the section of the DEVICE is a parameter
// (core/section.ts reads it from the page), so this can be tested and used anywhere.
import { canOpenSection, sectionOfGender } from '@/core/access-config';
import type { Access, Section } from '@/types/access';

interface SectionFields { gender?: string; section?: string }

/**
 * The section an ACCOUNT belongs to: its gender decides (female -> girls, male -> boys). Accounts created before the gender field
 * existed fall back to the older `section` field, and a missing value means boys, like the old data.
 */
export function accountSection(data: SectionFields | null | undefined): Section {
  if (data?.gender === 'male' || data?.gender === 'female') {
    return sectionOfGender(data.gender);
  }
  return data?.section === 'girls' ? 'girls' : 'boys';
}

export type SectionCheck = { action: 'ok' } | { action: 'redirect'; target: Section } | { action: 'deny'; target: Section };

/**
 *  'ok'       admin, or the account belongs to this device's section
 *  'redirect' switch the device to the account's own section and reload (the first time)
 *  'deny'     we already tried that once and it did not stick: do not let the account in
 * With role-based access the sections of the person's classes decide; otherwise the account's gender does.
 */
export function checkAccountSection(role: string, data: SectionFields | null | undefined, redirectedTo: string | null, access: Access | null, deviceSection: Section): SectionCheck {
  if (role === 'admin') {
    return { action: 'ok' };
  }
  const fromRoles = !!access && access.sections.length > 0;
  if (access && fromRoles && canOpenSection(access, deviceSection)) {
    return { action: 'ok' };
  }
  const mine: Section = access && fromRoles ? (access.sections[0] ?? 'boys') : accountSection(data);
  if (mine === deviceSection) {
    return { action: 'ok' };
  }
  return redirectedTo === mine ? { action: 'deny', target: mine } : { action: 'redirect', target: mine };
}
