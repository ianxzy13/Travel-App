/** Name of the cookie that remembers a website password (one per site). */
export const siteCookie = (slug: string) => `vow_site_${slug.replace(/[^a-z0-9-]/g, "")}`;
