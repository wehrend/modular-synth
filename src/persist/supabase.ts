import { supabase } from "../supabaseClient";
import type { PatchDocument } from "./serialize";
import { SCHEMA_VERSION } from "./serialize";

export type PresetRow = {
  id: string;
  name: string;
  graph: PatchDocument;
  is_public: boolean;
  updated_at: string;
};

export async function listPresets(userId: string): Promise<PresetRow[]> {
  const { data, error } = await supabase
    .from("patches")
    .select("id, name, graph, is_public, updated_at")
    .select("id, name, graph, is_public, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PresetRow[];
}

export async function savePreset(
  userId: string,
  name: string,
  graph: PatchDocument,
): Promise<void> {
  const { data, error } = await supabase.from("patches").insert({
    user_id: userId,
    name,
    graph,
    schema_version: SCHEMA_VERSION,
  });
  console.log("savePreset result:", { data, error }); // ← temporär
  if (error) throw new Error(error.message);
}

export async function overwritePreset(
  id: string,
  graph: PatchDocument,
): Promise<void> {
  const { error } = await supabase
    .from("patches")
    .update({
      graph,
      schema_version: SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// persist/supabase.ts, ergänzen

export async function loadPresetById(id: string): Promise<PatchDocument> {
  const { data, error } = await supabase
    .from("patches")
    .select("graph")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Preset mit ID "${id}" nicht gefunden.`);

  return data.graph as PatchDocument;
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.from("patches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function togglePublic(
  id: string,
  isPublic: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("patches")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type DiscoverProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type DiscoverPatch = {
  id: string;
  name: string;
  updated_at: string;
};

/** Alle Profile, die mindestens einen öffentlichen Patch haben. */
export async function listDiscoverableProfiles(): Promise<DiscoverProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, patches!inner(id)")
    .eq("patches.is_public", true);
  if (error) throw new Error(error.message);

  const seen = new Map<string, DiscoverProfile>();
  for (const row of data ?? []) {
    seen.set(row.id, {
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }
  return [...seen.values()];
}

export async function listPublicPatchesForUser(
  userId: string,
): Promise<DiscoverPatch[]> {
  const { data, error } = await supabase
    .from("patches")
    .select("id, name, updated_at")
    .eq("user_id", userId)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadPublicPatch(id: string): Promise<PatchDocument> {
  const { data, error } = await supabase
    .from("patches")
    .select("graph")
    .eq("id", id)
    .eq("is_public", true)
    .single();
  if (error || !data)
    throw new Error("Patch nicht gefunden oder nicht öffentlich.");
  return data.graph as PatchDocument;
}
