import type { Metric, MetricKey, MetricContext, FriendData, TopRepo } from "../domain/types.js";

const TopReposMetric: Metric<"topRepos"> = {
  key: "topRepos",
  compute(friends: FriendData[], ctx: MetricContext): TopRepo[] {
    const repos: TopRepo[] = [];
    for (const f of friends) {
      for (const r of f.topRepositories) {
        repos.push({
          owner: f.login,
          name: r.name,
          url: r.url,
          stars: r.stargazerCount,
          language: r.primaryLanguage?.name ?? null,
          color: r.primaryLanguage?.color ?? null,
        });
      }
    }
    return repos.sort((a, b) => b.stars - a.stars).slice(0, 5);
  },
};

export default TopReposMetric;