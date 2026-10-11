export interface FriendData {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  totalCommitContributions: number;
  repositories: RepositoryData[];
  topRepositories: TopRepositoryData[];
  contributionCalendar: ContributionCalendar;
  rateLimit: RateLimitInfo;
}

export interface RepositoryData {
  name: string;
  url: string;
  stargazerCount: number;
  pushedAt: string;
  primaryLanguage: LanguageData | null;
  languages: LanguageEdge[];
  defaultBranchRef: DefaultBranchRef | null;
}

export interface TopRepositoryData {
  name: string;
  url: string;
  stargazerCount: number;
  primaryLanguage: LanguageData | null;
}

export interface LanguageData {
  name: string;
  color: string | null;
}

export interface LanguageEdge {
  size: number;
  node: LanguageData;
}

export interface DefaultBranchRef {
  target: CommitHistory | null;
}

export interface CommitHistory {
  nodes: CommitNode[];
}

export interface CommitNode {
  oid: string;
  messageHeadline: string;
  committedDate: string;
  url: string;
  author: CommitAuthor;
}

export interface CommitAuthor {
  user: { login: string } | null;
}

export interface ContributionCalendar {
  weeks: ContributionWeek[];
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionDay {
  date: string;
  contributionCount: number;
}

export interface RateLimitInfo {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface DashboardResponse {
  user: string;
  fetchedAt: string;
  stale: boolean;
  truncated: boolean;
  totalFollowing: number;
  friendsCount: number;
  kpis: KPIs;
  topCommitters: TopCommitter[];
  streaks: Streak[];
  recentCommits: RecentCommit[];
  languages: LanguageMix[];
  languageOfWeek: LanguageOfWeek | null;
  topRepos: TopRepo[];
}

export interface KPIs {
  commits30d: number;
  activeNow: number;
  languages: number;
  friendsCount: number;
}

export interface TopCommitter {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
  commits30d: number;
}

export interface Streak {
  login: string;
  avatarUrl: string;
  current: number;
  best365: number;
  last30: number[];
}

export interface RecentCommit {
  login: string;
  avatarUrl: string;
  repo: string;
  message: string;
  url: string;
  committedAt: string;
  live: boolean;
}

export interface LanguageMix {
  name: string;
  color: string;
  bytes: number;
  share: number;
}

export interface LanguageOfWeek {
  name: string;
  color: string;
}

export interface TopRepo {
  owner: string;
  name: string;
  url: string;
  stars: number;
  language: string | null;
  color: string | null;
}

export interface MetricContext {
  now: Date;
  since30d: string;
  since7d: string;
  hiddenUsers: Set<string>;
}

export type MetricKey =
  | "kpis"
  | "topCommitters"
  | "streaks"
  | "recentCommits"
  | "languages"
  | "topRepos"
  | "languageOfWeek";

export interface Metric<K extends MetricKey> {
  key: K;
  compute(friends: FriendData[], ctx: MetricContext): DashboardResponse[K];
}