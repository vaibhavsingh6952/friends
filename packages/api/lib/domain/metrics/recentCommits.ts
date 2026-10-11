import type { Metric, MetricKey, MetricContext, FriendData, RecentCommit } from "../domain/types.js";

const RecentCommitsMetric: Metric<"recentCommits"> = {
  key: "recentCommits",
  compute(friends: FriendData[], ctx: MetricContext): RecentCommit[] {
    const commits: RecentCommit[] = [];
    for (const f of friends) {
      for (const r of f.repositories) {
        if (!r.defaultBranchRef?.target?.nodes) continue;
        for (const c of r.defaultBranchRef.target.nodes) {
          if (c.author.user?.login === f.login) {
            const pushedRecently = new Date(r.pushedAt).getTime() > Date.now() - 30 * 60 * 1000;
            commits.push({
              login: f.login,
              avatarUrl: f.avatarUrl,
              repo: r.name,
              message: c.messageHeadline,
              url: c.url,
              committedAt: c.committedDate,
              live: pushedRecently,
            });
          }
        }
      }
    }
    return commits
      .sort((a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime())
      .slice(0, 5);
  },
};

export default RecentCommitsMetric;