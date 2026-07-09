// EIS-505: Provisions-Split bei bezahlten Rechnungen
// Ohne Promoter: 60% Helfer / 40% Helferchen
// Mit Promoter:  60% Helfer / 35% Helferchen / 5% Promoter

export interface CommissionSplit {
  helper_pct: number;
  helferchen_pct: number;
  promoter_pct: number | null;
  helper_amount: number;
  helferchen_amount: number;
  promoter_amount: number | null;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeCommissionSplit(totalAmount: number, hasPromoter: boolean): CommissionSplit {
  const amount = Math.max(0, totalAmount);
  const helper_pct = 60;
  const helferchen_pct = hasPromoter ? 35 : 40;
  const promoter_pct = hasPromoter ? 5 : null;

  const helper_amount = round2(amount * helper_pct / 100);
  const promoter_amount = hasPromoter ? round2(amount * (promoter_pct as number) / 100) : null;
  // Helferchen gets the remainder so the three parts always sum exactly to the total (rounding-safe).
  const helferchen_amount = round2(amount - helper_amount - (promoter_amount ?? 0));

  return { helper_pct, helferchen_pct, promoter_pct, helper_amount, helferchen_amount, promoter_amount };
}
