import { createDoc, updateDoc, deleteDoc } from './firestore';

export async function createTag({ label, color = '#78716C', scope = 'any' }) {
  const id = `tag-${Date.now()}`;
  return createDoc('tags', { label, color, scope }, id);
}

export async function renameTag(id, label) {
  await updateDoc('tags', id, { label });
}

export async function recolorTag(id, color) {
  await updateDoc('tags', id, { color });
}

export async function changeTagScope(id, scope) {
  await updateDoc('tags', id, { scope });
}

export async function removeTag(id) {
  await deleteDoc('tags', id);
}
