/**
 * CLAUDE.md §2.3: launch riwayah is fixed to Hafs 'an 'Asim. This is the
 * single allowed value until a future content-version ADR explicitly adds
 * another riwayah. No code should hardcode the string "Hafs 'an 'Asim"
 * outside this module.
 */
export const SUPPORTED_RIWAYAT = ["hafs_an_asim"] as const;

export type Riwayah = (typeof SUPPORTED_RIWAYAT)[number];

export const RIWAYAH_DISPLAY_NAME: Record<Riwayah, string> = {
  hafs_an_asim: "Hafs 'an 'Asim",
};

export function assertSupportedRiwayah(value: string): asserts value is Riwayah {
  if (!SUPPORTED_RIWAYAT.includes(value as Riwayah)) {
    throw new Error(`Unsupported riwayah "${value}". Only ${SUPPORTED_RIWAYAT.join(', ')} is launch-supported.`);
  }
}
