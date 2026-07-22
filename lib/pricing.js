// Only styles with a fixed single-amount price ("$180") can be paid online
// in full. Ranges ("$70–$150"), "from $100" and quote pricing depend on the
// consultation, so they settle in person (Zelle or cash).
export function onlinePrice(service) {
  if (!service) return 0;
  const m = String(service.price).trim().match(/^\$(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}
