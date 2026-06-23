// Month parsing lookups
const dutchMonths = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const dutchMonthsShort = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const englishMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const englishMonthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function getMonthFromString(monthStr: string): number | null {
  const m = monthStr.toLowerCase().trim();
  const di = dutchMonths.indexOf(m);
  if (di !== -1) return di + 1;
  const dsi = dutchMonthsShort.indexOf(m);
  if (dsi !== -1) return dsi + 1;
  const ei = englishMonths.indexOf(m);
  if (ei !== -1) return ei + 1;
  const esi = englishMonthsShort.indexOf(m);
  if (esi !== -1) return esi + 1;

  if (m === 'mrt' || m === 'maart') return 3;
  if (m === 'mei' || m === 'may') return 5;
  if (m === 'okt' || m === 'oct' || m === 'oktober' || m === 'october') return 10;
  return null;
}

export function standardizeDateStr(rawDate: string): string {
  let sanitized = rawDate.replace(/[.\-]/g, '/');
  const parts = sanitized.split('/');
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    if (day.length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (year.length === 2) {
      year = '20' + year;
    }
    const yStr = year;
    const mStr = month.padStart(2, '0');
    const dStr = day.padStart(2, '0');
    try {
      const parsedDate = new Date(`${yStr}-${mStr}-${dStr}T00:00:00`);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    } catch {}
  }
  return rawDate;
}

export function fixDateAndTimestamp(dateStr: string, timeStr: string, digestYear: number) {
  const today = new Date();
  let day = today.getDate();
  let month = today.getMonth() + 1;
  let year = digestYear || today.getFullYear();
  let hour = 12;
  let min = 0;

  let fixedDateStr = dateStr;
  let fixedTimestamp = today.toISOString();

  try {
    if (timeStr) {
      const tParts = timeStr.replace(/\s*[aApP][mM]/, '').split(':');
      hour = parseInt(tParts[0]) || 12;
      min = parseInt(tParts[1] || '0') || 0;
      if (timeStr.toLowerCase().includes('pm') && hour < 12) hour += 12;
      if (timeStr.toLowerCase().includes('am') && hour === 12) hour = 0;
    }

    const cleanStr = dateStr.toLowerCase().replace(/,/g, ' ').trim();
    if (cleanStr === 'today' || cleanStr === 'vandaag') {
      const baseDate = digestYear ? new Date(digestYear, today.getMonth(), today.getDate()) : today;
      day = baseDate.getDate();
      month = baseDate.getMonth() + 1;
      year = baseDate.getFullYear();
    } else if (cleanStr === 'yesterday' || cleanStr === 'gisteren') {
      const baseDate = digestYear ? new Date(digestYear, today.getMonth(), today.getDate()) : today;
      const yesterday = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
      day = yesterday.getDate();
      month = yesterday.getMonth() + 1;
      year = yesterday.getFullYear();
    } else {
      const parts = cleanStr.split(/[\s/\-.]+/).filter(Boolean);
      if (parts.length === 2) {
        const mVal0 = getMonthFromString(parts[0]);
        if (mVal0 !== null) {
          month = mVal0;
          day = parseInt(parts[1]) || today.getDate();
        } else {
          const mVal1 = getMonthFromString(parts[1]);
          if (mVal1 !== null) {
            month = mVal1;
            day = parseInt(parts[0]) || today.getDate();
          } else {
            const p0 = parseInt(parts[0]);
            const p1 = parseInt(parts[1]);
            if (!isNaN(p0) && !isNaN(p1)) {
              if (p0 > 12) {
                day = p0;
                month = p1;
              } else if (p1 > 12) {
                day = p1;
                month = p0;
              } else {
                day = p0;
                month = p1;
              }
            }
          }
        }
      } else if (parts.length === 3) {
        if (parseInt(parts[0]) > 1000) {
          year = parseInt(parts[0]);
          const mVal = getMonthFromString(parts[1]);
          month = mVal !== null ? mVal : (parseInt(parts[1]) || 1);
          day = parseInt(parts[2]) || 1;
        } else {
          let parsedYear = parseInt(parts[2]);
          if (!isNaN(parsedYear)) {
            if (parsedYear < 100) parsedYear += 2000;
            year = parsedYear;
          }
          const mVal = getMonthFromString(parts[1]);
          month = mVal !== null ? mVal : (parseInt(parts[1]) || 1);
          day = parseInt(parts[0]) || 1;
        }
      }
    }

    const dObj = new Date(year, month - 1, day, hour, min, 0);
    if (!isNaN(dObj.getTime())) {
      fixedTimestamp = dObj.toISOString();
      const yStr = year.toString();
      const mStr = month.toString().padStart(2, '0');
      const dStr = day.toString().padStart(2, '0');
      fixedDateStr = standardizeDateStr(`${yStr}-${mStr}-${dStr}`);
    }
  } catch (e) {
    // ignore
  }

  return { fixedDateStr, fixedTimestamp };
}
