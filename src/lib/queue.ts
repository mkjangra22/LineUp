import { supabase } from "@/lib/supabase";

export type Ticket = {
  id: string;
  business_id: string;
  number: number;
  customer_name: string;
  status: "waiting" | "serving" | "served" | "skipped";
  created_at: string;
  served_at: string | null;
};

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  now_serving: number;
  paused: boolean;
  brand_color: string;
  logo_path: string | null;
  welcome_message: string | null;
  created_at: string;
};

export const DEFAULT_BRAND_COLOR = "#c05621";

/** Logos live in a private bucket; anyone may read, so sign a long-lived URL. */
export async function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("logos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadLogo(userId: string, businessId: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${userId}/${businessId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function updateBranding(
  businessId: string,
  values: Partial<Pick<Business, "name" | "brand_color" | "logo_path" | "welcome_message">>,
) {
  const { error } = await supabase
    .from("businesses")
    .update(values)
    .eq("id", businessId);
  if (error) throw error;
}


export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "queue"}-${suffix}`;
}

export async function fetchMyBusiness(userId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Business | null) ?? null;
}

export async function createBusiness(userId: string, name: string) {
  const { data, error } = await supabase
    .from("businesses")
    .insert({ owner_id: userId, name: name.trim(), slug: slugify(name) })
    .select("*")
    .single();
  if (error) throw error;
  return data as Business;
}

export async function fetchTickets(businessId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("business_id", businessId)
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

/** Marks whoever is currently serving as served, then promotes the next waiting ticket. */
export async function callNext(business: Business, tickets: Ticket[]) {
  const current = tickets.find((t) => t.status === "serving");
  if (current) {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "served", served_at: new Date().toISOString() })
      .eq("id", current.id);
    if (error) throw error;
  }

  const next = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => a.number - b.number)[0];
  if (!next) return null;

  const { error: upErr } = await supabase
    .from("tickets")
    .update({ status: "serving" })
    .eq("id", next.id);
  if (upErr) throw upErr;

  const { error: bizErr } = await supabase
    .from("businesses")
    .update({ now_serving: next.number })
    .eq("id", business.id);
  if (bizErr) throw bizErr;

  return next;
}

/** Pause / resume: while paused, the public join page refuses new tickets. */
export async function setPaused(businessId: string, paused: boolean) {
  const { error } = await supabase
    .from("businesses")
    .update({ paused })
    .eq("id", businessId);
  if (error) throw error;
}

/**
 * Skips the next waiting number without serving it (no-show).
 * Leaves whoever is currently being served untouched.
 */
export async function skipNext(tickets: Ticket[]) {
  const next = tickets
    .filter((t) => t.status === "waiting")
    .sort((a, b) => a.number - b.number)[0];
  if (!next) return null;
  const { error } = await supabase
    .from("tickets")
    .update({ status: "skipped" })
    .eq("id", next.id);
  if (error) throw error;
  return next;
}

export async function setTicketStatus(id: string, status: Ticket["status"]) {
  const { error } = await supabase
    .from("tickets")
    .update({
      status,
      served_at: status === "served" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function resetQueue(businessId: string) {
  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("business_id", businessId);
  if (error) throw error;
  const { error: bizErr } = await supabase
    .from("businesses")
    .update({ now_serving: 0 })
    .eq("id", businessId);
  if (bizErr) throw bizErr;
}

/* ---------- public (no login) ---------- */

export type QueueInfo = {
  business_name: string;
  now_serving: number;
  waiting_count: number;
  paused: boolean;
  brand_color: string;
  logo_path: string | null;
  welcome_message: string | null;
};


export async function getQueueInfo(slug: string) {
  const { data, error } = await supabase.rpc("get_queue_info", { p_slug: slug });
  if (error) throw error;
  return ((data as QueueInfo[] | null) ?? [])[0] ?? null;
}

export type JoinResult = {
  ticket_id: string;
  ticket_number: number;
  business_name: string;
};

export async function joinQueue(slug: string, name: string) {
  const { data, error } = await supabase.rpc("join_queue", {
    p_slug: slug,
    p_name: name,
  });
  if (error) throw error;
  const row = ((data as JoinResult[] | null) ?? [])[0];
  if (!row) throw new Error("Could not join this queue");
  return row;
}

export type TicketStatus = {
  ticket_number: number;
  customer_name: string;
  status: Ticket["status"];
  now_serving: number;
  people_ahead: number;
  business_name: string;
};

export async function getTicketStatus(ticketId: string) {
  const { data, error } = await supabase.rpc("get_ticket_status", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return ((data as TicketStatus[] | null) ?? [])[0] ?? null;
}
