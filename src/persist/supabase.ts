import { supabase } from "./supabaseClient";
import type { PatchDocument } from "./serialize";
import { SCHEMA_VERSION } from "./serialize";

export type PresetRow = {
  id: string;
  name: string;
  description: string | null;
  graph: PatchDocument;
  is_public: boolean;
  updated_at: string;
};

export async function listPresets(userId: string): Promise<PresetRow[]> {
  const { data, error } = await supabase
    .from("patches")
    .select("id, name, description, graph, is_public, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PresetRow[];
}

export async function savePreset(
  userId: string,
  name: string,
  description: string | null,
  graph: PatchDocument,
  thumbnailBlob: Blob | null,
): Promise<string> {
  const id = crypto.randomUUID();

  let thumbnail_url: string | null = null;
  if (thumbnailBlob) {
    thumbnail_url = await uploadPatchThumbnail(userId, id, thumbnailBlob);
  }

  const { error } = await supabase.from("patches").insert({
    id,
    user_id: userId,
    name,
    description,
    graph,
    schema_version: SCHEMA_VERSION,
    thumbnail_url,
  });

  if (error) throw new Error(error.message);
  return id;
}

export async function overwritePreset(
  id: string,
  userId: string,
  graph: PatchDocument,
  thumbnailBlob: Blob | null,
): Promise<void> {
  let thumbnail_url: string | undefined;
  if (thumbnailBlob) {
    thumbnail_url = await uploadPatchThumbnail(userId, id, thumbnailBlob);
  }

  const { error } = await supabase
    .from("patches")
    .update({
      graph,
      schema_version: SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
      ...(thumbnail_url ? { thumbnail_url } : {}),
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
  description: string | null;
  thumbnail_url: string | null;
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
    .select("id, name, description, thumbnail_url, updated_at")
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

export async function uploadPatchThumbnail(
  userId: string,
  patchId: string,
  blob: Blob,
): Promise<string> {
  const filePath = `${userId}/${patchId}.png`;

  const { error } = await supabase.storage
    .from("patch-thumbnails")
    .upload(filePath, blob, { upsert: true, contentType: "image/png" });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from("patch-thumbnails")
    .getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`; // Cache-Buster, wie beim Avatar
}

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  created_at: string;
};

export async function loadProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, avatar_url, website, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
