import type { Metric, MetricKey, MetricContext, FriendData, Streak } from "../domain/types.js";

function computeStreak(weeks: FriendData["contributionCalendar"]["weeks"], now: Date): { current: number; best365: number; last30: number[] } {
  const days: { date: string; count: number }[] = [];
  for (const w of weeks) {
    for (const d of w.contributionDays) {
      days.push(d);
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = now.toISOString().split("T")[0];
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split("T")[0];

  let current = 0;
  let best365 = 0;
  let currentStreak = 0;
  const last30: number[] = new Array(30).fill(0);

  const todayIdx = days.findIndex((d) => d.date === todayStr);
  const yesterdayIdx = days.findIndex((d) => d.date === yesterdayStr);

  let startIdx = 0;
  if (todayIdx >= 0 && days[todayIdx].count > 0) {
    startIdx = todayIdx;
  } else if (yesterdayIdx >= 0 && days[yesterdayIdx].count > 0) {
    startIdx = yesterdayIdx;
  } else {
    startIdx = -1;
  }

  if (startIdx >= 0) {
    for (let i = startIdx; i >= 0; i--) {
      if (days[i].count > 0) current++;
      else break;
    }
  }

  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      currentStreak++;
      best365 = Math.max(best365, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - (29 - i) * 86400000).toISOString().split("T")[0];
    const day = days.find((d) => d.date === date);
    last30[i] = day?.contributionCount ?? 0;
  }

  return { current, best365, last30 };
}

const StreaksMetric: Metric<"streaks"> = {
  key: "streaks",
  compute(friends: FriendData[], ctx: MetricContext): Streak[] {
    return friends
      .map((f) => {
        const { current, best365, last30 } = computeStreak(f.contributionCalendar.weeks, ctx.now);
        return { login: f.login, avatarUrl: f.avatarUrl, current, best365, last30 };
      })
      .sort((a, b) => b.current - a.current || b.best365 - a.best365 || a.login.localeCompare(b.login))
      .slice(0, 5);
  },
};

export default StreaksMetric;