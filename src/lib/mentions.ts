export interface MentionableUser {
  id: string;
  name: string;
  email: string;
}

interface MentionKey {
  key: string;
  userId: string;
}

/**
 * Builds the set of textual handles that may follow an "@" for a given member: the full email,
 * the email local part, the full name, and the first name when it is unambiguous.
 */
function buildKeys(members: MentionableUser[]): MentionKey[] {
  const keys: MentionKey[] = [];
  const firstNameOwners = new Map<string, Set<string>>();

  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    const name = member.name.trim().toLowerCase();
    if (email.length > 0) {
      keys.push({ key: email, userId: member.id });
      const localPart = email.split("@")[0];
      if (localPart.length > 1) keys.push({ key: localPart, userId: member.id });
    }
    if (name.length > 0) {
      keys.push({ key: name, userId: member.id });
      const collapsed = name.replace(/\s+/g, "");
      if (collapsed !== name) keys.push({ key: collapsed, userId: member.id });

      const firstName = name.split(/\s+/)[0];
      if (firstName.length > 1) {
        const owners = firstNameOwners.get(firstName) ?? new Set<string>();
        owners.add(member.id);
        firstNameOwners.set(firstName, owners);
      }
    }
  }

  for (const [firstName, owners] of firstNameOwners) {
    if (owners.size === 1) {
      const [userId] = [...owners];
      keys.push({ key: firstName, userId });
    }
  }

  // Longest first so "@sara tester" wins over "@sara".
  return keys.sort((a, b) => b.key.length - a.key.length);
}

function isWordCharacter(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

export function findMentionedUserIds(body: string, members: MentionableUser[]): string[] {
  if (body.length === 0 || members.length === 0) return [];

  const keys = buildKeys(members);
  const lower = body.toLowerCase();
  const mentioned = new Set<string>();

  for (let index = 0; index < lower.length; index += 1) {
    if (lower[index] !== "@") continue;
    // Skip the "@" inside an email that is not itself a mention.
    if (isWordCharacter(lower[index - 1])) continue;

    const rest = lower.slice(index + 1);
    const match = keys.find(
      (candidate) =>
        rest.startsWith(candidate.key) && !isWordCharacter(rest[candidate.key.length]),
    );
    if (match) mentioned.add(match.userId);
  }

  return [...mentioned];
}
