import { isIP } from "node:net";

const UNKNOWN = "unknown";
const LONGEST_READABLE_ADDRESS = 64;

// The unit a sign-in or face limit counts as "one client". An IPv6 customer normally controls a
// whole /64 (billions of addresses), so counting exact addresses would give an attacker a fresh
// limit for every address they pick; counting the /64 closes that. IPv4 is kept as is, and every
// spelling of an IPv4-mapped IPv6 address is the same client as its plain IPv4 form. Ports,
// brackets and zone ids are dropped; anything unreadable shares the single "unknown" key, so a
// caller can neither pick their own key nor make the table grow with free text.
export function networkOf(address: string | undefined): string {
  const text = readableAddress(address);
  if (text === null) return UNKNOWN;
  if (isIP(text) === 4) return text;

  const groups = ipv6Groups(text);
  const isMappedIpv4 =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIpv4) return dotted(groups[6], groups[7]);

  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(":")}::/64`;
}

function readableAddress(raw: string | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  if (text.length === 0 || text.length > LONGEST_READABLE_ADDRESS) return null;

  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(text);
  if (bracketed) text = bracketed[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(text)) text = text.slice(0, text.lastIndexOf(":"));

  text = text.split("%")[0];
  return isIP(text) === 0 ? null : text;
}

const dotted = (high: number, low: number) =>
  `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;

// The eight 16-bit groups of a valid IPv6 address, including the "::" and dotted-IPv4 forms.
function ipv6Groups(address: string): number[] {
  let text = address.toLowerCase();
  const tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number);
    text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, rest] = text.split("::");
  const headGroups = head ? head.split(":") : [];
  const restGroups = rest ? rest.split(":") : [];
  const zeros = rest === undefined ? 0 : 8 - headGroups.length - restGroups.length;
  return [...headGroups, ...new Array(zeros).fill("0"), ...restGroups].map((group) =>
    parseInt(group, 16),
  );
}
