import type { Metric, MetricKey, MetricContext, FriendData, KPIs } from "../domain/types.js";

const KPIsMetric: Metric<"kpis"> = {
  key: "kpis",
  compute(friends: FriendData[], ctx: MetricContext): KPIs {
    const commits30d = friends.reduce((sum, f) => sum + f.totalCommitContributions, 0);
    const activeNow = friends.filter((f) =>
      f.repositories.some((r) => {
        const pushed = new Date(r.pushedAt).getTime();
        return pushed > Date.now() - 30 * 60 * 1000;
      })
    ).length;
    const languageSet = new Set<string>();
    for (const f of friends) {
      for (const r of f.repositories) {
        if (r.primaryLanguage) languageSet.add(r.primaryLanguage.name);
        for (const l of r.languages) languageSet.add(l.node.name);
      }
    }
    return {
      commits30d,
      activeNow,
      languages: languageSet.size,
      friendsCount: friends.length,
    };
  },
};

export default KPIsMetric;