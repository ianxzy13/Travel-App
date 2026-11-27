/**
 * Where guests reply. When the couple's website is published (and has no
 * password), every RSVP link opens that website with the guest's own reply
 * form in its RSVP section. Otherwise it opens the plain RSVP page (/r/CODE).
 */
export type RsvpHome = { slug: string; website: boolean };

/** One household's personal RSVP link. */
export function guestRsvpLink(siteUrl: string, code: string, home: RsvpHome, lang?: string) {
  if (home.website) {
    return `${siteUrl}/w/${home.slug}?code=${code}${lang ? `&lang=${lang}` : ""}#rsvp`;
  }
  return `${siteUrl}/r/${code}${lang ? `?lang=${lang}` : ""}`;
}

/** The link for everyone ("find your invitation by name"). */
export function rsvpPageLink(siteUrl: string, home: RsvpHome) {
  return home.website ? `${siteUrl}/w/${home.slug}#rsvp` : `${siteUrl}/rsvp/${home.slug}`;
}
