export interface SiweMessageParams {
  /** EIP-55 checksummed address. Wallet-provided addresses already satisfy this. */
  address: string;
  domain: string;
  uri: string;
  nonce: string;
  chainId: number;
  statement?: string;
  version?: string;
  issuedAt?: Date;
  expirationTime?: Date;
  notBefore?: Date;
  requestId?: string;
  resources?: string[];
}

const toTimestamp = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, "Z");

/**
 * Builds an EIP-4361 (Sign-In with Ethereum) message.
 *
 * The address is emitted verbatim: the spec requires EIP-55 checksum casing,
 * and computing it here would cost a keccak dependency the SDK does not
 * otherwise carry. Pass the address your wallet connector gave you.
 */
export const buildSiweMessage = (params: SiweMessageParams): string => {
  const {
    address,
    domain,
    uri,
    nonce,
    chainId,
    statement,
    version = "1",
    issuedAt = new Date(),
    expirationTime,
    notBefore,
    requestId,
    resources,
  } = params;

  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement ? `${statement}\n` : "",
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${toTimestamp(issuedAt)}`,
  ];

  if (expirationTime) {
    lines.push(`Expiration Time: ${toTimestamp(expirationTime)}`);
  }
  if (notBefore) {
    lines.push(`Not Before: ${toTimestamp(notBefore)}`);
  }
  if (requestId) {
    lines.push(`Request ID: ${requestId}`);
  }
  if (resources?.length) {
    lines.push("Resources:");
    for (const resource of resources) {
      lines.push(`- ${resource}`);
    }
  }

  return lines.join("\n");
};
