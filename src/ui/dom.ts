/** Tiny DOM helpers. Text always goes in as text (never innerHTML). */
type Attrs = Readonly<Record<string, string>>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

/**
 * Splits a translated template on one `{slot}` and puts `slot` in its place, so a styled piece
 * (a <code>) can sit inside a sentence whose word order differs per locale.
 */
export function withSlot(template: string, slot: string, node: Node): (Node | string)[] {
  const marker = `{${slot}}`;
  const at = template.indexOf(marker);
  if (at < 0) return [template];
  return [template.slice(0, at), node, template.slice(at + marker.length)];
}
