import { supabase } from "@/lib/supabase";

export const DEFAULT_BRAND_COLOR = "#077E42";

/** Logos live in a private bucket; anyone may read, so sign a long-lived URL. */
export async function logoUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("logos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadLogo(userId, businessId, file) {
  const allowedMime = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
  ];
  if (!allowedMime.includes(file.type)) {
    throw new Error("Invalid image type. Please upload a PNG, JPG, WebP, or SVG file.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo file size exceeds 2MB limit.");
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${userId}/${businessId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function deleteLogo(path) {
  if (!path) return;
  try {
    await supabase.storage.from("logos").remove([path]);
  } catch (err) {
    console.warn("Could not remove orphaned logo:", err);
  }
}

export async function updateBranding(businessId, values) {
  const { error } = await supabase
    .from("businesses")
    .update(values)
    .eq("id", businessId);
  if (error) throw error;
}

export function slugify(name) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "queue"}-${suffix}`;
}

export async function fetchMyBusiness(userId) {
  if (!userId) return null;

  // 1. Direct check on businesses.owner_id (fast & 100% backwards compatible)
  const { data: directBiz, error: directErr } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (directBiz) return directBiz;

  // 2. Next check membership in business_members table
  try {
    const { data: memberRows, error: memberErr } = await supabase
      .from("business_members")
      .select("business_id, role, businesses(*)")
      .eq("user_id", userId)
      .limit(1);

    if (!memberErr && memberRows?.[0]?.businesses) {
      return memberRows[0].businesses;
    }
  } catch {
    // Ignore if business_members table is pending migration
  }

  return null;
}

export async function createBusiness(userId, name) {
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: userId,
      name: name.trim(),
      slug: slugify(name),
      brand_color: DEFAULT_BRAND_COLOR,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Idempotent execution of the PostgreSQL database onboarding state:
 * Profiles, Businesses, Business Members, Business Settings, Subscriptions.
 */
export async function executeDatabaseOnboarding({
  userId,
  businessName,
  address,
  businessType,
  phone,
  brandColor = DEFAULT_BRAND_COLOR,
}) {
  // 1. Try complete_business_onboarding RPC function first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "complete_business_onboarding",
      {
        p_name: businessName.trim(),
        p_address: address.trim(),
        p_business_type: businessType || null,
        p_phone: phone || null,
        p_brand_color: brandColor,
      }
    );

    if (!rpcError && rpcData?.business_id) {
      const { data: biz, error: fetchErr } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", rpcData.business_id)
        .single();
      if (!fetchErr && biz) return biz;
    }
  } catch (rpcEx) {
    console.warn("[Onboarding] RPC fallback:", rpcEx);
  }

  // 2. Fallback to direct relational operations
  const existingBiz = await fetchMyBusiness(userId);
  let business = existingBiz;

  if (!business) {
    const slug = slugify(businessName);
    const { data: newBiz, error: createErr } = await supabase
      .from("businesses")
      .insert({
        owner_id: userId,
        name: businessName.trim(),
        slug,
        address: address.trim(),
        brand_color: brandColor,
      })
      .select("*")
      .single();

    if (createErr) throw createErr;
    business = newBiz;
  } else {
    await supabase
      .from("businesses")
      .update({
        address: address.trim(),
        brand_color: brandColor,
      })
      .eq("id", business.id);
  }

  // Secondary relational tables with fail-safe upserts
  try {
    await supabase.from("profiles").upsert({
      id: userId,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    });
  } catch (_) {}

  try {
    await supabase.from("business_members").upsert(
      {
        business_id: business.id,
        user_id: userId,
        role: "owner",
      },
      { onConflict: "business_id,user_id" }
    );
  } catch (_) {}

  try {
    if (businessType) {
      await supabase.from("business_settings").upsert(
        {
          business_id: business.id,
          business_type: businessType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );
    }
  } catch (_) {}

  try {
    await supabase.from("subscriptions").upsert(
      {
        business_id: business.id,
        plan: "free",
        status: "active",
        billing_period: "monthly",
        amount: 0,
        currency: "INR",
      },
      { onConflict: "business_id" }
    );
  } catch (_) {}

  return business;
}

/**
 * Resilient multi-step onboarding orchestration:
 * 1. Establish database records
 * 2. Upload logo to storage if provided
 * 3. Update business record with logo_path (cleans up storage on failure)
 * 4. Verify access under RLS
 */
export async function completeOnboardingFlow({
  user,
  businessName,
  address,
  businessType,
  phone,
  logoFile,
  brandColor = DEFAULT_BRAND_COLOR,
}) {
  if (!user?.id) throw new Error("Authentication required to register business");

  // Step 1: Database workspace registration
  const business = await executeDatabaseOnboarding({
    userId: user.id,
    businessName,
    address,
    businessType,
    phone,
    brandColor,
  });

  if (!business?.id) {
    throw new Error("Failed to create business workspace. Please try again.");
  }

  // Step 2 & 3: Logo upload if provided
  let logoUploadWarning = null;
  if (logoFile) {
    let uploadedPath = null;
    try {
      uploadedPath = await uploadLogo(user.id, business.id, logoFile);
      const { error: linkErr } = await supabase
        .from("businesses")
        .update({ logo_path: uploadedPath })
        .eq("id", business.id);

      if (linkErr) {
        // Rollback uploaded logo file so no orphan file remains
        await deleteLogo(uploadedPath);
        logoUploadWarning =
          "Logo could not be linked, but your business workspace was created successfully.";
      } else {
        business.logo_path = uploadedPath;
      }
    } catch (logoErr) {
      if (uploadedPath) await deleteLogo(uploadedPath);
      logoUploadWarning =
        logoErr?.message || "Logo upload failed, but your business was registered.";
    }
  }

  // Step 4: Verify business is accessible under RLS
  const verifiedBiz = await fetchMyBusiness(user.id);
  if (!verifiedBiz) {
    throw new Error(
      "Business was created, but access could not be verified under security policies. Please refresh."
    );
  }

  return {
    business: verifiedBiz,
    logoWarning: logoUploadWarning,
  };
}

export async function fetchTickets(businessId) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("business_id", businessId)
    .order("number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Marks whoever is currently serving as served, then promotes the next waiting ticket. */
export async function callNext(business, tickets) {
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
export async function setPaused(businessId, paused) {
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
export async function skipNext(tickets) {
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

export async function setTicketStatus(id, status) {
  const { error } = await supabase
    .from("tickets")
    .update({
      status,
      served_at: status === "served" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function resetQueue(businessId) {
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

export async function getQueueInfo(slug) {
  const { data, error } = await supabase.rpc("get_queue_info", { p_slug: slug });
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function joinQueue(slug, name) {
  const { data, error } = await supabase.rpc("join_queue", {
    p_slug: slug,
    p_name: name,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) throw new Error("Could not join this queue");
  return row;
}

export async function getTicketStatus(ticketId) {
  const { data, error } = await supabase.rpc("get_ticket_status", {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}
