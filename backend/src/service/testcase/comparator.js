// src/service/testcase/comparator.js
/**
 * Comparator: basic implementations for typical comparison policies.
 * - exact: strict === on normalized primitives or JSON.stringify for objects
 * - trim: trim strings then compare
 * - numeric: numeric compare with tolerance
 * - json: deep-equal after canonicalization (sort keys)
 * - regex: expected treated as regex pattern (string)
 *
 * Note: This is intentionally simple — extend for your needs.
 */

function isObject(obj) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

function canonicalize(obj) {
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (isObject(obj)) {
    const keys = Object.keys(obj).sort();
    const out = {};
    for (const k of keys) out[k] = canonicalize(obj[k]);
    return out;
  }
  return obj;
}

export default class Comparator {
  static normalize(v, type = 'exact') {
    if (typeof v === 'string') {
      if (type === 'trim') return v.trim();
      if (type === 'numeric') {
        const n = Number(v);
        return Number.isFinite(n) ? n : v;
      }
      // default keep string
      return v;
    }
    // object canonicalize for json
    if (isObject(v) || Array.isArray(v)) {
      return canonicalize(v);
    }
    return v;
  }

  static compareSingle(actual, expected, type = 'exact', opts = {}) {
    try {
      if (type === 'exact') {
        const na = Comparator.normalize(actual, 'exact');
        const ne = Comparator.normalize(expected, 'exact');
        // for objects/arrays do JSON compare
        if ((isObject(na) || Array.isArray(na)) || (isObject(ne) || Array.isArray(ne))) {
          return JSON.stringify(na) === JSON.stringify(ne);
        }
        return na === ne;
      }
      if (type === 'trim') {
        return String(actual).trim() === String(expected).trim();
      }
      if (type === 'numeric') {
        const a = Number(actual);
        const b = Number(expected);
        const tol = typeof opts.tolerance === 'number' ? opts.tolerance : 1e-9;
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
        return Math.abs(a - b) <= tol;
      }
      if (type === 'json') {
        const ca = Comparator.normalize(actual, 'json');
        const ce = Comparator.normalize(expected, 'json');
        return JSON.stringify(ca) === JSON.stringify(ce);
      }
      if (type === 'regex') {
        const pattern = typeof expected === 'string' ? expected : String(expected);
        const re = new RegExp(pattern);
        return re.test(String(actual));
      }
      // default fallback to exact
      return Comparator.compareSingle(actual, expected, 'exact', opts);
    } catch (e) {
      return false;
    }
  }

  // compare arrays element-wise, returns boolean all-match
  static compare(actualArr = [], expectedArr = [], type = 'exact', opts = {}) {
    // allow actualArr or actual scalar
    const aList = Array.isArray(actualArr) ? actualArr : [actualArr];
    const eList = Array.isArray(expectedArr) ? expectedArr : [expectedArr];
    if (aList.length !== eList.length) return false;
    for (let i = 0; i < eList.length; i++) {
      if (!Comparator.compareSingle(aList[i], eList[i], type, opts)) return false;
    }
    return true;
  }

  // partial compare: returns { passedCount, total }
  static partialCompare(actualArr = [], expectedArr = [], type = 'exact', opts = {}) {
    const aList = Array.isArray(actualArr) ? actualArr : [actualArr];
    const eList = Array.isArray(expectedArr) ? expectedArr : [expectedArr];
    let passed = 0;
    const total = eList.length;
    for (let i = 0; i < eList.length; i++) {
      if (i < aList.length && Comparator.compareSingle(aList[i], eList[i], type, opts)) passed++;
    }
    return { passedCount: passed, total };
  }
}
