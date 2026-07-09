// EIS-505: Kunden-Level-Routing bei Auftragseingang
//
// Level 0 (Starter)          -> offener Pool. 12h "First-Match-Boost": in diesem Fenster nur für
//                                Mitarbeiter mit employee_tier premium_flex/senior_crew sichtbar,
//                                danach für alle Level-0-fähigen Helfer (offener Pool).
// Level 1 (Trust) / 2 (Premium) -> Direct-Push an den festen Stamm-Mitarbeiter des Kunden. Fehlt einer,
//                                oder lehnt er ab/ist krank, wird der Auftrag zur manuellen Eskalation
//                                an den Gebietsleiter markiert (escalation_status).
import { query, dbConnected } from '../db/pool';

export const BOOST_WINDOW_HOURS = 12;
export const PREMIUM_TIERS = ['premium_flex', 'senior_crew'];

export interface RoutingDecision {
  assigned_user_id: string | null;
  customer_level: number;
  promoter_id: string | null;
  boost_visible_until: string | null;
  escalation_status: string | null;
}

function toMysqlDatetime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

// Determines where a newly created assignment should go based on the customer's level.
// Falls back to an open-pool assignment when the DB (and therefore customer level data) is unavailable.
export async function routeNewAssignment(customerId: string): Promise<RoutingDecision> {
  if (!dbConnected) {
    return { assigned_user_id: null, customer_level: 0, promoter_id: null, boost_visible_until: null, escalation_status: null };
  }
  const res = await query('SELECT level, promoter_id, stamm_user_id FROM customers WHERE id = ?', [customerId]);
  const customer = res.rows[0];
  const level = customer ? Number(customer.level) || 0 : 0;
  const promoter_id = customer?.promoter_id ?? null;

  if (level === 0) {
    const boostUntil = toMysqlDatetime(new Date(Date.now() + BOOST_WINDOW_HOURS * 60 * 60 * 1000));
    return { assigned_user_id: null, customer_level: 0, promoter_id, boost_visible_until: boostUntil, escalation_status: null };
  }

  // Level 1/2: Direct-Push an festen Stamm-Mitarbeiter
  const stammUserId: string | null = customer?.stamm_user_id || null;
  return {
    assigned_user_id: stammUserId,
    customer_level: level,
    promoter_id,
    boost_visible_until: null,
    escalation_status: stammUserId ? null : 'needs_manual_assignment',
  };
}

// Permanently links a customer to a promoter by code — set once at order intake, never overwritten
// afterwards (so the commission split stays consistent across the customer's lifetime).
export async function linkPromoterToCustomer(customerId: string, promoterCode: string | undefined | null): Promise<string | null> {
  if (!dbConnected || !promoterCode) return null;
  const code = String(promoterCode).trim();
  if (!code) return null;
  const promoterRes = await query('SELECT id FROM promoters WHERE code = ? AND active = TRUE', [code]);
  const promoter = promoterRes.rows[0];
  if (!promoter) return null;
  await query('UPDATE customers SET promoter_id = ? WHERE id = ? AND promoter_id IS NULL', [promoter.id, customerId]);
  const fresh = await query('SELECT promoter_id FROM customers WHERE id = ?', [customerId]);
  return fresh.rows[0]?.promoter_id ?? null;
}

// Employees who may self-assign/see a Level-0 order still inside its First-Match-Boost window.
export function canSeeBoostedAssignment(employeeTier: string | null | undefined): boolean {
  return !!employeeTier && PREMIUM_TIERS.includes(employeeTier);
}

export function isBoostActive(boostVisibleUntil: string | null | undefined): boolean {
  if (!boostVisibleUntil) return false;
  return new Date(boostVisibleUntil.replace(' ', 'T') + 'Z').getTime() > Date.now();
}
