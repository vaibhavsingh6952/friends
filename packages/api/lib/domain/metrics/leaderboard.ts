import type { Metric, MetricKey, MetricContext, FriendData, TopCommitter } from "../domain/types.js";

const TopCommittersMetric: Metric<"topCommitters"> = {
  key: "topCommitters",
  compute(friends: FriendData[], ctx: MetricContext): TopCommitter[] {
    return friends
      .map((f) => ({
        login: f.login,
        name: f.name,
        avatarUrl: f.avatarUrl,
        url: f.url,
        commits30d: f.totalCommitContributions,
      }))
      .sort((a, b) => b.commits30d - a.commits30d || a.login.localeCompare(b.login))
      .slice(0, 5);
  },
};

export default TopCommittersMetric;