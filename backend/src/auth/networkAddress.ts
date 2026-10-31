import { isIPv6 } from "node:net";

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

// The unit a sign-in or face limit counts as "one client". An IPv6 customer normally controls a
// whole /64 (billions of addresses), so counting exact addresses would give an attacker a fresh
// limit for every address they pick; counting the /64 closes that. IPv4 is kept as is, and an
// IPv4-mapped IPv6 address is the same client as its plain IPv4 form.
export function networkOf(address: string | undefined): string {
  if (!address) return "unknown";

  const mapped = IPV4_MAPPED.exec(address);
  if (mapped) return mapped[1];

  const withoutZone = address.split("%")[0].toLowerCase();
  if (!isIPv6(withoutZone)) return address.toLowerCase();

  return `${firstFourGroups(withoutZone).join(":")}::/64`;
}

function firstFourGroups(address: string): string[] {
  const [head, tail] = address.split("::");
  const headGroups = head ? head.split(":") : [];
  const groups =
    tail === undefined
      ? headGroups
      : [
          ...headGroups,
          ...new Array(Math.max(0, 8 - headGroups.length - (tail ? tail.split(":").length : 0))).fill("0"),
          ...(tail ? tail.split(":") : []),
        ];
  return groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16));
}
