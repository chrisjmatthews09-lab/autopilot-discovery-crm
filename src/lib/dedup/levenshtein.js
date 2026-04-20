export function levenshteinDistance(a, b) {
  const s1 = a == null ? '' : String(a);
  const s2 = b == null ? '' : String(b);
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  let prev = new Array(s2.length + 1);
  let curr = new Array(s2.length + 1);
  for (let j = 0; j <= s2.length; j++) prev[j] = j;

  for (let i = 1; i <= s1.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1.charCodeAt(i - 1) === s2.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[s2.length];
}

export function similarityPercent(a, b) {
  const s1 = a == null ? '' : String(a);
  const s2 = b == null ? '' : String(b);
  if (s1 === '' && s2 === '') return 100;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}
