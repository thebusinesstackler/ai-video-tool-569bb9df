/**
 * Character Identity Lock — appends a deterministic block to every keyframe + video prompt
 * so the same face, age, wardrobe, and hair persist across every scene.
 *
 * Used by MovieSceneCreator. Pass in the StoryBible and the list of character names
 * present in the scene (from `charactersInScene`).
 */

export interface LockableCharacter {
  name: string;
  age?: string;
  appearance?: string;
  wardrobe?: string;
  gender?: string;
  assignedTwinId?: string;
}

export interface AITwinLite {
  id: string;
  reference_images?: string[] | null;
}

export function buildCharacterLockBlock(
  characters: LockableCharacter[] | undefined,
  charactersInScene: string[] | undefined
): string {
  if (!characters?.length || !charactersInScene?.length) return "";
  const present = characters.filter((c) =>
    charactersInScene.some((n) => n.toLowerCase() === c.name.toLowerCase())
  );
  if (!present.length) return "";

  const lines = present.map((c) => {
    const bits = [
      c.age ? `${c.age}` : "",
      c.appearance ? c.appearance : "",
      c.wardrobe ? `wardrobe: ${c.wardrobe}` : "",
    ].filter(Boolean).join(", ");
    return `• ${c.name}${bits ? ` — ${bits}` : ""}`;
  });

  return [
    "",
    "CHARACTER LOCK (must remain identical across every shot — same face, same hair, same outfit):",
    ...lines,
    "",
  ].join("\n");
}

/** Pick the best reference image for a character (first AI Twin reference image if assigned). */
export function pickCharacterReferenceImage(
  character: LockableCharacter | undefined,
  twins: AITwinLite[] | undefined
): string | null {
  if (!character?.assignedTwinId || !twins?.length) return null;
  const twin = twins.find((t) => t.id === character.assignedTwinId);
  return twin?.reference_images?.[0] || null;
}
