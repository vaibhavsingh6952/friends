import type { Metric, MetricContext } from "../domain/types.js";
import { KPIsMetric } from "./kpis.js";
import { TopCommittersMetric } from "./leaderboard.js";
import { StreaksMetric } from "./streaks.js";
import { RecentCommitsMetric } from "./recentCommits.js";
import { LanguagesMetric, LanguageOfWeekMetric } from "./languages.js";
import { TopReposMetric } from "./topRepos.js";

export const metricRegistry: Metric<MetricKey>[] = [
  KPIsMetric,
  TopCommittersMetric,
  StreaksMetric,
  RecentCommitsMetric,
  LanguagesMetric,
  LanguageOfWeekMetric,
  TopReposMetric,
];

export type MetricKey = Metric<MetricKey>["key"];