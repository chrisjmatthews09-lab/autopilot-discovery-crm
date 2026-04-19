import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc as fbGetDoc,
  getDocs,
  query,
  where,
  orderBy as fbOrderBy,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const requireUid = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

const collPath = (name) => `users/${requireUid()}/${name}`;

export async function createDoc(collectionName, data, explicitId = null) {
  const base = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (explicitId) {
    await setDoc(doc(db, collPath(collectionName), explicitId), base);
    return { id: explicitId, ...base };
  }
  const ref = await addDoc(collection(db, collPath(collectionName)), base);
  return { id: ref.id, ...base };
}

export async function getDoc(collectionName, id) {
  const snap = await fbGetDoc(doc(db, collPath(collectionName), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listDocs(collectionName, filters = [], orderByField = null) {
  const constraints = filters.map(([field, op, value]) => where(field, op, value));
  if (orderByField) {
    const [field, dir = 'asc'] = Array.isArray(orderByField) ? orderByField : [orderByField];
    constraints.push(fbOrderBy(field, dir));
  }
  const q = constraints.length
    ? query(collection(db, collPath(collectionName)), ...constraints)
    : collection(db, collPath(collectionName));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateDoc(collectionName, id, patch) {
  await fbUpdateDoc(doc(db, collPath(collectionName), id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDoc(collectionName, id) {
  await fbDeleteDoc(doc(db, collPath(collectionName), id));
}

export async function batchWrite(operations) {
  const batch = writeBatch(db);
  for (const op of operations) {
    const ref = doc(db, collPath(op.collection), op.id);
    if (op.type === 'set') batch.set(ref, { ...op.data, updatedAt: serverTimestamp() });
    else if (op.type === 'update') batch.update(ref, { ...op.data, updatedAt: serverTimestamp() });
    else if (op.type === 'delete') batch.delete(ref);
  }
  await batch.commit();
}
