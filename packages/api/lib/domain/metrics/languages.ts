import type { Metric, MetricKey, MetricContext, FriendData, LanguageMix, LanguageOfWeek } from "../domain/types.js";

const LanguagesMetric: Metric<"languages"> = {
  key: "languages",
  compute(friends: FriendData[], ctx: MetricContext): LanguageMix[] {
    const bytesByLang = new Map<string, { bytes: number; color: string }>();
    for (const f of friends) {
      for (const r of f.repositories) {
        for (const l of r.languages) {
          const existing = bytesByLang.get(l.node.name) ?? { bytes: 0, color: l.node.color ?? "#cccccc" };
          existing.bytes += l.size;
          bytesByLang.set(l.node.name, existing);
        }
        if (r.primaryLanguage) {
          const existing = bytesByLang.get(r.primaryLanguage.name) ?? { bytes: 0, color: r.primaryLanguage.color ?? "#cccccc" };
          existing.bytes += 1;
          bytesByLang.set(r.primaryLanguage.name, existing);
        }
      }
    }
    const total = Array.from(bytesByLang.values()).reduce((sum, v) => sum + v.bytes, 0);
    const sorted = Array.from(bytesByLang.entries())
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, 8);
    const top8Bytes = sorted.reduce((sum, [, v]) => sum + v.bytes, 0);
    const otherBytes = total - top8Bytes;
    const result: LanguageMix[] = sorted.map(([name, v]) => ({
      name,
      color: v.color,
      bytes: v.bytes,
      share: total > 0 ? v.bytes / total : 0,
    }));
    if (otherBytes > 0) {
      result.push({ name: "Other", color: "#cccccc", bytes: otherBytes, share: total > 0 ? otherBytes / total : 0 });
    }
    return result;
  },
};

const LanguageOfWeekMetric: Metric<"languageOfWeek"> = {
  key: "languageOfWeek",
  compute(friends: FriendData[], ctx: MetricContext): LanguageOfWeek | null {
    const bytesByLang = new Map<string, { bytes: number; color: string }>();
    for (const f of friends) {
      for (const r of f.repositories) {
        const pushed = new Date(r.pushedAt).getTime();
        if (pushed < Date.now() - 7 * 86400000) continue;
        for (const l of r.languages) {
          const existing = bytesByLang.get(l.node.name) ?? { bytes: 0, color: l.node.color ?? "#cccccc" };
          existing.bytes += l.size;
          bytesByLang.set(l.node.name, existing);
        }
        if (r.primaryLanguage) {
          const existing = bytesByLang.get(r.primaryLanguage.name) ?? { bytes: 0, color: r.primaryLanguage.color ?? "#cccccc" };
          existing.bytes += 1;
          bytesByLang.set(r.primaryLanguage.name, existing);
        }
      }
    }
    if (bytesByLang.size === 0) return null;
    const top = Array.from(bytesByLang.entries()).sort((a, b) => b[1].bytes - a[1].bytes)[0];
    return { name: top[0], color: top[1].color };
  },
};

export { LanguagesMetric, LanguageOfWeekMetric };