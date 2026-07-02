export function hex(color: string, opacity: number): string {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0')
}
