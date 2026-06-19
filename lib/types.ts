/** Shared data shapes safe to import from both server and client components. */

/** The single report/invoice issuer (who is billing), shown on reports + PDF. */
export type IssuerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  vat: string;
  address: string;
  iban: string;
};

export const ISSUER_KEYS = [
  "issuerFirstName",
  "issuerLastName",
  "issuerEmail",
  "issuerCompany",
  "issuerVat",
  "issuerAddress",
  "issuerIban",
] as const;
