import assert from "node:assert/strict";
import { networkOf } from "../src/auth/networkAddress";

function ipv4IsKeptAsIs() {
  assert.equal(networkOf("203.0.113.5"), "203.0.113.5");
  assert.notEqual(networkOf("203.0.113.5"), networkOf("203.0.113.6"));
}

function aMappedIpv4IsTheSameClientAsThePlainOne() {
  assert.equal(networkOf("::ffff:203.0.113.5"), networkOf("203.0.113.5"));
  assert.equal(networkOf("::FFFF:203.0.113.5"), "203.0.113.5");
}

function everyAddressInOneIpv6Slash64IsOneNetwork() {
  const a = networkOf("2001:db8:1:2::1");
  assert.equal(networkOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), a);
  assert.equal(networkOf("2001:0DB8:0001:0002:0:0:0:9"), a, "case and leading zeros");
  assert.equal(networkOf("2001:db8:1:2:ffff:ffff:ffff:ffff"), a);
}

function differentSlash64NetworksStayApart() {
  assert.notEqual(networkOf("2001:db8:1:2::1"), networkOf("2001:db8:1:3::1"));
  assert.notEqual(networkOf("2001:db8:1:2::1"), networkOf("2001:db8:2:2::1"));
}

function shortFormsExpandBeforeCutting() {
  assert.equal(networkOf("::1"), networkOf("0:0:0:0:0:0:0:1"));
  assert.equal(networkOf("2001:db8::1"), networkOf("2001:db8:0:0::7"));
  assert.notEqual(networkOf("2001:db8::1"), networkOf("2001:db8:0:1::1"));
}

function aZoneSuffixIsIgnored() {
  assert.equal(networkOf("fe80::1%eth0"), networkOf("fe80::1"));
}

function missingOrUnreadableAddressesShareOneUnknownBucket() {
  assert.equal(networkOf(undefined), "unknown");
  assert.equal(networkOf(""), "unknown");
  assert.equal(networkOf("not-an-address"), "not-an-address");
}

ipv4IsKeptAsIs();
aMappedIpv4IsTheSameClientAsThePlainOne();
everyAddressInOneIpv6Slash64IsOneNetwork();
differentSlash64NetworksStayApart();
shortFormsExpandBeforeCutting();
aZoneSuffixIsIgnored();
missingOrUnreadableAddressesShareOneUnknownBucket();
console.log("networkAddress tests passed");
