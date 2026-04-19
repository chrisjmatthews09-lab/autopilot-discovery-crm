import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy as fbOrderBy } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export function useCollection(collectionName, { filters = [], orderBy = null, enabled = true } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtersKey = JSON.stringify(filters);
  const orderKey = JSON.stringify(orderBy);

  useEffect(() => {
    if (!enabled || !auth.currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const uid = auth.currentUser.uid;
    const constraints = filters.map(([f, op, v]) => where(f, op, v));
    if (orderBy) {
      const [f, dir = 'asc'] = Array.isArray(orderBy) ? orderBy : [orderBy];
      constraints.push(fbOrderBy(f, dir));
    }
    const ref = collection(db, `users/${uid}/${collectionName}`);
    const q = constraints.length ? query(ref, ...constraints) : ref;

    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;

  }, [collectionName, filtersKey, orderKey, enabled]);

  return { data, loading, error };
}
