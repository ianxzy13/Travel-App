export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function whatsappDirectUrl(phone: string, text: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}
