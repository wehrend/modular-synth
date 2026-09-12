import { supabase } from "./supabaseClient";
import type { PatchDocument } from "./serialize";
import { SCHEMA_VERSION } from "./serialize";
import i18n from "../i18n";

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
  if (!data) throw new Error(i18n.t("app.errors.presetNotFound", { id }));

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
    throw new Error(i18n.t("app.errors.patchNotFoundOrPrivate"));
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

/**
 * Bereinigt einen beliebigen String für die Verwendung als Label-Segment
 * im Storage-Dateinamen ("sampler-<n>-<label>-<ts>.<ext>") -- nur
 * alphanumerisch/Bindestrich/Unterstrich, da Storage-Pfade z.B. keine
 * Schrägstriche vertragen. Gemeinsam genutzt von Rename UND Upload, damit
 * beide Pfade garantiert demselben Namensschema folgen und nicht
 * auseinanderlaufen. Gibt null zurück, wenn nach der Bereinigung nichts
 * Verwertbares übrig bleibt (z.B. Eingabe bestand nur aus Sonderzeichen).
 */
export function sanitizeStorageLabel(input: string): string | null {
  const sanitized = input
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || null;
}

export async function uploadSamplerRecording(
  userId: string,
  instanceNumber: number,
  blob: Blob,
  fileExtension = "webm", // Tone.Recorder liefert meist webm
  contentType = "audio/webm",
  // Mittleres Namenssegment -- "autosave" für Mikro-/Line-Aufnahmen (siehe
  // Aufrufer in SamplerNode.tsx), bei Datei-Uploads stattdessen der
  // (bereinigte) Original-Dateiname, damit der Dateiname des Uploads schon
  // vor jedem manuellen Rename im selben Schema wie umbenannte Aufnahmen
  // erscheint. Fällt bei leerem/nicht sanitisierbarem Label ebenfalls auf
  // "autosave" zurück, statt einen ungültigen Pfad zu erzeugen.
  label = "autosave",
): Promise<string> {
  const safeLabel = sanitizeStorageLabel(label) ?? "autosave";

  // Eindeutiger Pfad pro Upload statt fixem Pfad + upsert: Supabase liefert
  // Storage-Objekte über ein CDN aus, dessen Cache-Key den Query-String
  // ignoriert -- der "?t=..." Cache-Buster unten wirkt zwar gegen den
  // Browser-Cache, aber NICHT gegen den CDN-Cache. Bei gleichem Pfad
  // bekommt man deshalb trotz erfolgreichem Überschreiben (upsert) noch
  // minutenlang die alte, gecachte Version ausgeliefert. Ein neuer Pfad
  // pro Aufnahme umgeht das Problem komplett, da es für den CDN eine
  // völlig neue Ressource ist.
  //
  // Der Timestamp allein sorgt schon für Eindeutigkeit pro Upload -- selbst
  // wenn zwei verschiedene Sampler-Module durch Löschen/Neuanlegen zufällig
  // dieselbe instanceNumber hätten, würde nie derselbe Dateiname entstehen,
  // da niemals zwei Uploads exakt dieselbe Millisekunde treffen.
  const filePath = `${userId}/sampler-${instanceNumber}-${safeLabel}-${Date.now()}.${fileExtension}`;

  const { error } = await supabase.storage
    .from("sampler-recordings")
    .upload(filePath, blob, { contentType });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from("sampler-recordings")
    .getPublicUrl(filePath);
  return data.publicUrl;
}

export type StorageRecording = {
  name: string;
  url: string;
  createdAt: string | null;
};

/**
 * Listet alle Aufnahmen, die im Storage-Ordner dieses Nutzers liegen --
 * unabhängig davon, ob sie in irgendeinem aktuell gespeicherten Preset
 * noch referenziert sind. Nötig, weil die App Storage-Dateien sonst nur
 * über die im Preset hinterlegte sampleUrl kennt -- eine Aufnahme, deren
 * Preset nie gespeichert oder später überschrieben wurde, wäre der App
 * sonst komplett unbekannt, obwohl die Datei physisch noch existiert.
 */
export async function listSamplerRecordings(
  userId: string,
): Promise<StorageRecording[]> {
  const { data, error } = await supabase.storage
    .from("sampler-recordings")
    .list(userId, { sortBy: { column: "created_at", order: "desc" } });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data
    .filter((entry) => entry.name !== ".emptyFolderPlaceholder")
    .map((entry) => {
      const { data: urlData } = supabase.storage
        .from("sampler-recordings")
        .getPublicUrl(`${userId}/${entry.name}`);
      return {
        name: entry.name,
        url: urlData.publicUrl,
        createdAt: entry.created_at ?? null,
      };
    });
}

/**
 * Benennt eine Aufnahme im Storage um -- ersetzt das aktuelle Label im
 * Dateinamen (egal ob "autosave" bei einer frischen Aufnahme oder ein
 * bereits vorher vergebenes eigenes Label) durch das gewünschte, neue
 * Label. Erneutes Umbenennen funktioniert also genauso wie das erste Mal,
 * z.B. "sampler-2-autosave-171234567.webm" -> "...-kick-..." -> "...-snare-...".
 *
 * NUR das Label ist frei editierbar -- die Instanznummer bleibt exakt
 * erhalten (Präfix "sampler-<n>-" wird 1:1 übernommen, nie vom Label-Input
 * beeinflusst), und der Timestamp wird bei jeder Umbenennung frisch neu
 * gesetzt (Date.now()), statt den alten Wert stehen zu lassen -- er ist
 * damit weder manuell editierbar noch einfach unverändert, sondern
 * spiegelt den Zeitpunkt der letzten Umbenennung.
 *
 * Ändert nur den Pfad/Namen, nicht den Dateiinhalt -- die alte URL wird
 * dadurch ungültig, die zurückgegebene neue URL muss im jeweiligen Slot
 * hinterlegt werden.
 */
export async function renameSamplerRecording(
  userId: string,
  currentUrl: string,
  newLabel: string,
): Promise<string> {
  const oldFilename = currentUrl.split("?")[0].split("/").pop();
  if (!oldFilename) throw new Error("Ungültige Datei-URL.");

  // Nur alphanumerisch/Bindestrich/Unterstrich zulassen -- Storage-Pfade
  // vertragen z.B. keine Schrägstriche, Leerzeichen sind zwar technisch
  // erlaubt, aber in URLs unhandlich. Dieselbe Bereinigung wie beim
  // Label-Segment eines Uploads (siehe sanitizeStorageLabel), damit beide
  // Pfade garantiert dasselbe Namensschema erzeugen.
  const sanitized = sanitizeStorageLabel(newLabel);
  if (!sanitized) throw new Error("Ungültiges Label.");

  // Präfix (Instanznummer) und Dateiendung extrahieren -- Label UND
  // Timestamp werden komplett verworfen und neu gesetzt, nicht nur das
  // Label wie ursprünglich.
  //
  // Zwei Namensschemata werden unterstützt: das aktuelle mit Label-Segment
  // ("sampler-<n>-<label>-<ts>.<ext>") und das ältere ohne
  // ("sampler-<n>-<ts>.<ext>", z.B. Aufnahmen von vor dem Label-Feature).
  // Beide führen zu einer echten Umbenennung -- ein stiller No-Op, der die
  // alte URL unverändert zurückgibt, wäre für den User nicht von einem
  // Erfolg zu unterscheiden.
  const labeledMatch = oldFilename.match(
    /^(sampler-\d+-).+-\d{12,}(\.[a-zA-Z0-9]+)$/,
  );
  const legacyMatch = oldFilename.match(
    /^(sampler-\d+-)\d{12,}(\.[a-zA-Z0-9]+)$/,
  );
  const match = labeledMatch ?? legacyMatch;
  if (!match) {
    throw new Error(
      `Dateiname entspricht nicht dem erwarteten Schema: ${oldFilename}`,
    );
  }
  const [, prefix, extension] = match;
  const newFilename = `${prefix}${sanitized}-${Date.now()}${extension}`;

  const oldPath = `${userId}/${oldFilename}`;
  const newPath = `${userId}/${newFilename}`;

  const { error } = await supabase.storage
    .from("sampler-recordings")
    .move(oldPath, newPath);

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from("sampler-recordings")
    .getPublicUrl(newPath);
  return data.publicUrl;
}
