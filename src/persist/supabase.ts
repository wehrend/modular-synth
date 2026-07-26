import { supabase } from "../supabaseClient";
import type { PatchDocument } from "./serialize";
import { SCHEMA_VERSION } from "./serialize";

export type PresetRow = {
  id: string;
  name: string;
  graph: PatchDocument;
  updated_at: string;
};

export async function listPresets(userId: string): Promise<PresetRow[]> {
  const { data, error } = await supabase
    .from("patches")
    .select("id, name, graph, updated_at")
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

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.from("patches").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
