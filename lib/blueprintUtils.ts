export function stripLevelSuffix(s: string): string {
  return typeof s === 'string' ? s.replace(/_lvl_\d+$/i, '') : s;
}

export function stripItemTierSuffix(s: string): string {
  return typeof s === 'string'
    ? s
        .replace(/_(advanced|superior|extreme)_item$/i, '')
        .replace(/_item$/i, '')
    : s;
}

export function weaponSynonym(id: string): string {
  const map: Record<string, string> = { flamer: 'flamethrower' };
  return map[id] || id;
}
