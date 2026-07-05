export const UNNAMED_CAMPSITE_NAME = "Unnamed campsite";

export function isUnnamedCampsite(name: string): boolean {
  return name === UNNAMED_CAMPSITE_NAME;
}

export function getDisplayName(campsite: { name: string; region: string | null; state: string | null }): string {
  if (!isUnnamedCampsite(campsite.name)) return campsite.name;
  if (campsite.region) return `Campsite in ${campsite.region}`;
  if (campsite.state) return `Campsite in ${campsite.state}`;
  return UNNAMED_CAMPSITE_NAME;
}
