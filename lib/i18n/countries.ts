const COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB",
  "BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI","KH","CM",
  "CA","CV","CF","TD","CL","CN","CO","KM","CG","CR","HR","CU","CY","CZ","DK",
  "DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI","FR","GA",
  "GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN",
  "ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KW","KG","LA",
  "LV","LB","LS","LR","LY","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH",
  "MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL",
  "NZ","NI","NE","NG","KP","MK","NO","OM","PK","PW","PA","PG","PY","PE","PH",
  "PL","PT","QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS",
  "SC","SL","SG","SK","SI","SB","SO","ZA","KR","SS","ES","LK","SD","SR","SE",
  "CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV","UG",
  "UA","AE","GB","US","UY","UZ","VU","VE","VN","YE","ZM","ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

function countryEmoji(cc: string): string {
  return [...cc.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join("");
}

export function getCountries(locale: string): { code: string; name: string; flag: string }[] {
  let dn: Intl.DisplayNames;
  try {
    dn = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    dn = new Intl.DisplayNames(["en"], { type: "region" });
  }
  return COUNTRY_CODES.map((code) => ({
    code,
    name: dn.of(code) ?? code,
    flag: countryEmoji(code),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}
